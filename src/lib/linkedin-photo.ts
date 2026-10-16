import { getLinkedProviders, getProviderAccess } from "@/lib/accounts";
import { isLinkedInEnabled } from "@/auth.config";
import { uploadImageDepuisUrl } from "@/lib/media";

/**
 * REPRENDRE SA PHOTO LINKEDIN, sans quitter le site.
 *
 * Avant, ce geste vivait sur « Mes connexions » et relançait une connexion
 * OAuth complète : on partait chez LinkedIn pour un simple changement
 * d'avatar, et l'URL renvoyée (signée, périssable) était stockée telle quelle.
 * Ici, on redemande le profil à LinkedIn avec le jeton d'accès déjà conservé au
 * rattachement, puis on COPIE la photo chez nous — même dossier `avatars` et
 * mêmes contrôles que l'envoi d'un fichier. Une seule notion de photo, deux
 * façons de la remplir.
 *
 * Le jeton d'accès LinkedIn vit ~60 jours et l'application n'a pas de jeton de
 * rafraîchissement : passé ce délai, il faut vraiment repasser par LinkedIn.
 * C'est le seul cas où l'on redemande une connexion (`raison: "reconnexion"`),
 * et il se dit à l'écran plutôt que de se produire par surprise.
 */

/** Endpoint OpenID Connect de LinkedIn (scope `profile`, déjà demandé par le
 * provider Auth.js). Il renvoie `picture` — l'URL de la photo du profil. */
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

/** Les seuls hôtes d'où l'on accepte de rapatrier une photo LinkedIn (CDN
 * média de LinkedIn). Liste blanche : la requête sortante part d'une URL
 * qu'on n'a pas écrite. */
export const HOTES_PHOTO_LINKEDIN = ["licdn.com"] as const;

/** Marge avant l'échéance : un jeton qui expire dans la seconde ferait échouer
 * l'appel juste après l'avoir jugé bon. */
const MARGE_EXPIRATION_S = 60;

export type PhotoLinkedIn =
  | { ok: true; url: string }
  /** Le jeton manque ou a expiré : seule une reconnexion à LinkedIn peut
   * rendre la photo accessible. */
  | { ok: false; raison: "reconnexion" }
  /** Tout le reste (LinkedIn indisponible, profil sans photo, dépôt refusé) :
   * le message est destiné à l'écran, tel quel. */
  | { ok: false; raison: "echec"; message: string };

/**
 * Y a-t-il une photo LinkedIn à aller chercher pour ce compte ? DEUX conditions,
 * et c'est le seul endroit qui les tient : LinkedIn rattaché (sans quoi il n'y
 * a rien à reprendre) ET configuré côté serveur (une ligne `accounts` survit au
 * retrait des identifiants en env — le bouton s'afficherait alors pour un
 * provider hors service).
 *
 * La règle était réécrite dans les trois pages qui affichent le champ Photo,
 * chacune dans un style différent : une quatrième en aurait oublié une moitié,
 * et l'échec ne se serait vu qu'au clic.
 */
export async function photoLinkedInReprenable(userId: number): Promise<boolean> {
  if (!isLinkedInEnabled()) return false;
  return (await getLinkedProviders(userId)).includes("linkedin");
}

/**
 * Le jeton est-il encore exploitable ? Un provider qui n'annonce aucune
 * échéance (`expiresAt` absent) est réputé valide : on tente l'appel, et c'est
 * LinkedIn qui tranchera par un 401 — mieux vaut un aller-retour inutile qu'une
 * reconnexion demandée pour rien.
 */
export function jetonUtilisable(
  acces: { expiresAt: number | null } | null,
  maintenantSecondes: number,
): boolean {
  if (!acces) return false;
  if (acces.expiresAt === null) return true;
  return acces.expiresAt > maintenantSecondes + MARGE_EXPIRATION_S;
}

/**
 * L'URL de photo portée par une réponse `userinfo`. Isolée et pure : c'est le
 * seul endroit qui décide de ce qu'on accepte comme photo, et il se teste sans
 * réseau. Une réponse sans photo (profil LinkedIn sans portrait) renvoie
 * `null` — pas une erreur.
 */
export function photoDeUserinfo(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const picture = (json as { picture?: unknown }).picture;
  if (typeof picture !== "string") return null;
  const url = picture.trim();
  return url ? url : null;
}

/**
 * Récupère la photo LinkedIn du compte et la dépose chez nous. Renvoie l'URL
 * de NOTRE copie — l'appelante n'a plus qu'à l'écrire sur le compte.
 */
export async function reprendrePhotoLinkedIn(userId: number): Promise<PhotoLinkedIn> {
  const acces = await getProviderAccess(userId, "linkedin");
  if (!acces || !jetonUtilisable(acces, Math.floor(Date.now() / 1000))) {
    return { ok: false, raison: "reconnexion" };
  }

  let reponse: Response;
  try {
    reponse = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${acces.accessToken}` },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return {
      ok: false,
      raison: "echec",
      message: "LinkedIn met du temps à répondre. Réessaie dans un instant.",
    };
  }
  // 401/403 : jeton révoqué ou périmé côté LinkedIn, malgré l'échéance
  // annoncée. Même issue que l'absence de jeton — une reconnexion.
  if (reponse.status === 401 || reponse.status === 403) {
    return { ok: false, raison: "reconnexion" };
  }
  if (!reponse.ok) {
    return {
      ok: false,
      raison: "echec",
      message: "LinkedIn met du temps à répondre. Réessaie dans un instant.",
    };
  }

  const photo = photoDeUserinfo(await reponse.json().catch(() => null));
  if (!photo) {
    return {
      ok: false,
      raison: "echec",
      message:
        "LinkedIn nous renvoie un profil sans photo. Envoie un fichier depuis ton appareil.",
    };
  }

  const depot = await uploadImageDepuisUrl(photo, {
    dossier: "avatars",
    hotesAutorises: HOTES_PHOTO_LINKEDIN,
  });
  if ("error" in depot) return { ok: false, raison: "echec", message: depot.error };
  return { ok: true, url: depot.url };
}
