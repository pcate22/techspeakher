import { put } from "@vercel/blob";

// Adaptateur isolé (docs/conception-articles.md §6) : migrer vers OVH Object
// Storage se fait ICI, sans toucher aux appelants (actions, éditeur, pages).
const MAX_SIZE = 4 * 1024 * 1024; // 4 Mo

const EXTENSION_PAR_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
};

export type UploadImageResult = { url: string } | { error: string };

/** Message unique de l'échec de récupération : recopié, il aurait fini par
 * différer d'un chemin à l'autre pour la même panne. */
const PHOTO_INACCESSIBLE = "La photo est restée inaccessible. Réessaie dans un instant.";
const TROP_LOURDE = "Image trop lourde (4 Mo maximum).";

/** Dossiers valides dans le store Blob (typé pour qu'une faute de frappe soit
 * une erreur de compilation, pas un nouveau dossier créé en silence). */
export type DossierMedia = "contenus" | "avatars";

/** Extrait le fichier envoyé (`FormData`, champ `file`), ou `null` si absent
 * ou mal formé. Partagé par les routes d'upload (contenus, avatar). */
export async function getUploadedFile(request: Request): Promise<File | null> {
  const formData = await request.formData();
  const file = formData.get("file");
  return file instanceof File ? file : null;
}

/**
 * `File.type` est déclaré par le CLIENT (renommer un fichier suffit à le
 * changer) : ne jamais lui faire confiance seul avant de servir le contenu
 * sous une extension d'image. On vérifie donc la signature binaire (les
 * premiers octets, format par format) avant le dépôt. AVIF (conteneur ISO
 * BMFF) n'est vérifié que sur la boîte `ftyp` + la marque `avif` — ça ne
 * distingue pas un AVIF d'un autre format ISO BMFF portant la même marque,
 * mais ça bloque déjà tout contenu qui n'est PAS un conteneur de ce type
 * (HTML, SVG, script...), la vraie menace ici.
 */
function signatureValide(tete: Uint8Array, mime: string): boolean {
  const debute = (offset: number, octets: number[]) =>
    octets.every((o, i) => tete[offset + i] === o);
  switch (mime) {
    case "image/png":
      return debute(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/jpeg":
      return debute(0, [0xff, 0xd8, 0xff]);
    case "image/webp":
      return debute(0, [0x52, 0x49, 0x46, 0x46]) && debute(8, [0x57, 0x45, 0x42, 0x50]);
    case "image/avif":
      return debute(4, [0x66, 0x74, 0x79, 0x70]) && debute(8, [0x61, 0x76, 0x69, 0x66]);
    default:
      return false;
  }
}

/**
 * Les trois contrôles communs à TOUT dépôt d'image, quelle que soit sa
 * provenance (fichier envoyé depuis un formulaire, photo reprise chez un
 * provider) : type reconnu, taille bornée, signature binaire conforme au type
 * annoncé. Un seul endroit les tient — un deuxième chemin de dépôt qui les
 * réécrirait finirait par en oublier un.
 */
function verifierImage(
  mime: string,
  taille: number,
  tete: Uint8Array,
): { extension: string } | { error: string } {
  const extension = EXTENSION_PAR_MIME[mime];
  if (!extension) {
    return { error: "Format d'image non pris en charge (PNG, JPEG, WebP ou AVIF)." };
  }
  if (taille > MAX_SIZE) return { error: TROP_LOURDE };
  if (!signatureValide(tete, mime)) {
    return { error: "Format de fichier non reconnu." };
  }
  return { extension };
}

/**
 * Dépose une image sur le stockage de fichiers (Vercel Blob en v1), en accès
 * public. Type MIME déclaré, signature binaire et taille sont validés AVANT
 * le dépôt ; le nom de fichier est généré côté serveur (jamais celui envoyé
 * par le client). `dossier` distingue les usages dans le store (`contenus`
 * pour les articles/pages, `avatars` pour les photos de profil).
 */
export async function uploadImage(
  file: File,
  dossier: DossierMedia = "contenus",
): Promise<UploadImageResult> {
  const tete = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const verdict = verifierImage(file.type, file.size, tete);
  if ("error" in verdict) return verdict;
  return deposer(dossier, verdict.extension, file);
}

/** Le dépôt lui-même : nom généré côté serveur (jamais celui du client) et
 * accès public. Les deux provenances finissent ici — une politique de dépôt qui
 * change (accès, cache) se change à un seul endroit. */
async function deposer(
  dossier: DossierMedia,
  extension: string,
  contenu: File | Blob,
  contentType?: string,
): Promise<UploadImageResult> {
  const nom = `${dossier}/${crypto.randomUUID()}.${extension}`;
  const blob = await put(nom, contenu, { access: "public", ...(contentType ? { contentType } : {}) });
  return { url: blob.url };
}

/** Au-delà, on renonce : une photo de profil qui se fait attendre ne doit pas
 * tenir un rendu serveur en otage. */
const DELAI_RECUPERATION_MS = 8_000;

/**
 * Reprend une image HÉBERGÉE AILLEURS et la dépose chez nous (reprise de la
 * photo LinkedIn). On ne se contente PAS de garder l'URL du provider : les
 * URLs de photo LinkedIn (`media.licdn.com`) sont signées et expirent, ce qui
 * faisait retomber l'avatar sur les initiales quelques semaines plus tard sans
 * que personne comprenne pourquoi. Copiée ici, la photo tient.
 *
 * `hotesAutorises` n'est pas décoratif : cette fonction fait une requête
 * sortante depuis le serveur à partir d'une URL qu'on n'a pas écrite. Sans
 * liste blanche, une réponse d'API détournée dirigerait cette requête où elle
 * veut (réseau interne compris). D'où le paramètre OBLIGATOIRE, et le refus de
 * tout ce qui n'est pas https.
 */
export async function uploadImageDepuisUrl(
  url: string,
  options: { dossier: DossierMedia; hotesAutorises: readonly string[] },
): Promise<UploadImageResult> {
  let cible: URL;
  try {
    cible = new URL(url);
  } catch {
    return { error: "Adresse de photo illisible." };
  }
  const hoteAutorise = options.hotesAutorises.some(
    (h) => cible.hostname === h || cible.hostname.endsWith(`.${h}`),
  );
  if (cible.protocol !== "https:" || !hoteAutorise) {
    return { error: "On reprend seulement une photo hébergée par le service attendu." };
  }

  let reponse: Response;
  try {
    reponse = await fetch(cible, {
      // Une redirection sortirait de la liste blanche vérifiée ci-dessus.
      redirect: "error",
      signal: AbortSignal.timeout(DELAI_RECUPERATION_MS),
    });
  } catch {
    return { error: PHOTO_INACCESSIBLE };
  }
  if (!reponse.ok) return { error: PHOTO_INACCESSIBLE };

  // Taille ANNONCÉE d'abord : refuser avant de charger le corps en mémoire
  // (la borne d'après vaut toujours — un serveur peut mentir ou se taire).
  const annonce = Number(reponse.headers.get("content-length"));
  if (Number.isFinite(annonce) && annonce > MAX_SIZE) return { error: TROP_LOURDE };

  const mime = (reponse.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  // La lecture du corps peut échouer APRÈS des en-têtes valides (connexion
  // coupée en cours, délai atteint pendant le transfert) : sans ce garde, la
  // Server Action rejetait et l'écran restait muet.
  let octets: Uint8Array<ArrayBuffer>;
  try {
    octets = new Uint8Array(await reponse.arrayBuffer());
  } catch {
    return { error: PHOTO_INACCESSIBLE };
  }
  const verdict = verifierImage(mime, octets.byteLength, octets.subarray(0, 12));
  if ("error" in verdict) return verdict;

  return deposer(options.dossier, verdict.extension, new Blob([octets], { type: mime }), mime);
}
