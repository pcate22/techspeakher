import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Détecteur d'endpoint Sessionize : l'orga colle l'ADRESSE de la page
 * programme d'une conf, le serveur en extrait `sessionize.com/api/v2/<ID>`.
 * Les ids sont introuvables à la main (il fallait lire le code source de la
 * page) : ce module est ce qui rend le registre de moisson nourrissable.
 *
 * C'est le SEUL endroit du dépôt où le serveur va chercher une URL fournie
 * par un humain — d'où la garde SSRF, vérifiée AVANT chaque requête et à
 * chaque saut de redirection : https seul, port standard, toute adresse
 * résolue publique, taille et temps bornés. L'id extrait repasse ensuite par
 * les défenses existantes (format `ENDPOINT_REGEX`, hôte sessionize.com codé
 * en dur, `testSessionizeEndpoint` avant écriture) : le détecteur ne les
 * remplace jamais, il s'y ajoute en amont.
 *
 * Restes, assumés : la résolution DNS de la garde et celle du `fetch` sont
 * deux résolutions distinctes (rebinding théorique entre les deux) ; et les
 * plages sans rien d'interne chez l'hébergeur passent (multicast, broadcast,
 * 240/4, 198.18/15 — un connect TLS y échoue de lui-même). L'écran est
 * derrière `requireOrgaId`, l'attaque suppose un DNS hostile ET une orga qui
 * colle son adresse : hors du modèle de menace de ce formulaire.
 */

const TAILLE_MAX_OCTETS = 2_000_000;
const DELAI_MS = 8_000;
/** Nombre maximal de requêtes émises (la première + les redirections suivies). */
const REQUETES_MAX = 3;

/** Même gabarit que `ENDPOINT_REGEX` (conference-form), en recherche globale. */
const ID_DANS_PAGE = /sessionize\.com\/api\/v2\/([a-z0-9]{6,32})/gi;

/** Les ids d'endpoint présents dans un HTML, dédoublonnés, dans l'ordre. */
export function extraireIdsSessionize(html: string): string[] {
  const ids: string[] = [];
  for (const m of html.matchAll(ID_DANS_PAGE)) {
    if (!ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}

/**
 * Une adresse IP qui a sa place sur un réseau interne, jamais au bout d'une
 * page programme publique : boucle locale, plages privées RFC 1918, lien
 * local (dont 169.254.169.254, l'adresse de métadonnées des clouds — la cible
 * classique du SSRF), CGNAT, et leurs équivalents IPv6 (y compris l'IPv4
 * privé déguisé en `::ffff:…`).
 */
export function adresseInterdite(ip: string): boolean {
  const basse = ip.toLowerCase();
  if (basse.includes(":")) {
    // IPv4 mappé en IPv6 : juger l'IPv4 qu'il transporte — sous ses DEUX
    // formes de sortie (pointée « ::ffff:127.0.0.1 » ou hexa « ::ffff:7f00:1 »,
    // au choix du résolveur : la garde juge la valeur, jamais le format).
    const pointee = basse.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (pointee) return adresseInterdite(pointee[1]);
    const hexa = basse.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexa) {
      const haut = parseInt(hexa[1], 16);
      const bas = parseInt(hexa[2], 16);
      return adresseInterdite(
        `${haut >> 8}.${haut & 255}.${bas >> 8}.${bas & 255}`,
      );
    }
    if (basse === "::" || basse === "::1") return true;
    if (basse.startsWith("fc") || basse.startsWith("fd")) return true; // ULA fc00::/7
    if (/^fe[89ab]/.test(basse)) return true; // lien local fe80::/10
    return false;
  }
  const octets = basse.split(".").map(Number);
  if (octets.length !== 4 || octets.some((o) => Number.isNaN(o))) return true;
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  return false;
}

type Refus = { ok: false; erreur: string };

export type DetectionEndpoint = { ok: true; endpoint: string } | Refus;

const refus = (erreur: string): Refus => ({ ok: false, erreur });

/**
 * La garde d'une étape : l'URL est bien formée, en https, sur le port
 * standard, et TOUTES les adresses derrière son hôte sont publiques.
 * Rend l'URL analysée, ou le refus à montrer.
 */
async function gardeUrl(adresse: string): Promise<URL | Refus> {
  let url: URL;
  try {
    url = new URL(adresse);
  } catch {
    return refus("Adresse illisible : colle l'adresse complète de la page programme (https://…).");
  }
  if (url.protocol !== "https:") {
    return refus("L'adresse de la page programme doit être en https.");
  }
  if (url.port !== "") {
    return refus("Le détecteur se limite au port https standard : colle l'adresse publique de la page.");
  }
  // Un littéral IPv6 garde ses crochets dans url.hostname (« [::1] ») : les
  // retirer AVANT de juger, sinon isIP rend 0 et le refus reposerait sur un
  // échec du résolveur — un effet de bord de plateforme, pas une garde.
  const hote = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hote)) {
    if (adresseInterdite(hote)) {
      return refus("Cette adresse pointe vers un réseau interne : colle l'adresse publique de la page programme.");
    }
    return url;
  }
  let adresses: { address: string }[];
  try {
    adresses = await lookup(hote, { all: true });
  } catch {
    return refus(`Hôte introuvable (${url.hostname}) : vérifie l'adresse.`);
  }
  if (adresses.length === 0 || adresses.some((a) => adresseInterdite(a.address))) {
    return refus("Cette adresse pointe vers un réseau interne : colle l'adresse publique de la page programme.");
  }
  return url;
}

/** Lit le corps au plus jusqu'à la borne, en coupant le flux au dépassement. */
async function lireBorne(reponse: Response): Promise<string> {
  const lecteur = reponse.body?.getReader();
  if (!lecteur) {
    // Corps déjà matérialisé (ou environnement sans flux) : tronquer suffit.
    return (await reponse.text()).slice(0, TAILLE_MAX_OCTETS);
  }
  const decodeur = new TextDecoder();
  let lu = 0;
  let html = "";
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done || !value) break;
    lu += value.byteLength;
    html += decodeur.decode(value, { stream: true });
    if (lu > TAILLE_MAX_OCTETS) {
      await lecteur.cancel();
      break;
    }
  }
  return html.slice(0, TAILLE_MAX_OCTETS);
}

/**
 * Va chercher la page programme (redirections re-gardées, temps et taille
 * bornés) et en extrait l'unique id d'endpoint Sessionize.
 */
export async function detecterEndpointSessionize(adresse: string): Promise<DetectionEndpoint> {
  let cible = adresse.trim();

  for (let requete = 0; requete < REQUETES_MAX; requete++) {
    const garde = await gardeUrl(cible);
    if (!(garde instanceof URL)) return garde;

    let reponse: Response;
    try {
      reponse = await fetch(garde, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(DELAI_MS),
        headers: { accept: "text/html" },
      });
    } catch {
      return refus(`La page est restée injoignable (délai dépassé ou connexion impossible) : vérifie l'adresse (${garde.hostname}).`);
    }

    if ([301, 302, 303, 307, 308].includes(reponse.status)) {
      const suivante = reponse.headers.get("location");
      if (!suivante) return refus("La page redirige sans destination : colle l'adresse finale.");
      // Relative ou absolue : résolue contre l'étape courante, puis re-gardée
      // au prochain tour (une page publique peut rediriger vers du privé).
      try {
        cible = new URL(suivante, garde).href;
      } catch {
        return refus("La page redirige vers une adresse illisible : colle l'adresse finale.");
      }
      continue;
    }

    if (!reponse.ok) {
      return refus(`La page a répondu HTTP ${reponse.status} : vérifie l'adresse.`);
    }

    // Même écriture que media.ts : l'annonce est refusée quand elle dépasse…
    const annonce = Number(reponse.headers.get("content-length"));
    if (Number.isFinite(annonce) && annonce > TAILLE_MAX_OCTETS) {
      return refus("La page dépasse la taille que le détecteur accepte de lire : colle l'id directement.");
    }
    // … et la borne tient AUSSI pendant la lecture : un serveur peut mentir ou
    // taire content-length, et l'hôte est ici arbitraire. Le flux est coupé au
    // dépassement ; ce qui a été lu suffit (l'embed vit en tête de page).
    const html = await lireBorne(reponse);

    const ids = extraireIdsSessionize(html);
    if (ids.length === 1) return { ok: true, endpoint: ids[0] };
    if (ids.length > 1) {
      return refus(
        "Plusieurs ids Sessionize sur cette page : colle directement l'id de cette édition (sessionize.com/api/v2/ID).",
      );
    }
    return refus(
      "Aucun id d'endpoint Sessionize sur cette page : colle l'id directement (visible dans le code source, motif sessionize.com/api/v2/ID).",
    );
  }

  return refus("Trop de redirections : colle l'adresse finale de la page programme.");
}
