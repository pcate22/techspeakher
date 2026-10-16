/**
 * Lecture d'une URL de vidéo YouTube saisie dans l'éditeur de contenus.
 *
 * L'URL vient d'une saisie humaine : on la parse plutôt que de la filtrer à la
 * regex, et on n'accepte qu'un hôte YouTube connu (comparaison sur l'hôte
 * complet, pour qu'un « youtube.com.autre-domaine » soit rejeté). L'identifiant
 * doit avoir le format attendu — sinon on ne fabrique pas d'URL de vignette.
 */

/** Hôtes YouTube reconnus, comparés en entier (jamais en « se termine par »). */
const HOTES_VIDEO = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const HOTE_COURT = "youtu.be";

/** Segments de chemin qui précèdent l'identifiant sur youtube.com. */
const PREFIXES = ["embed", "live", "shorts"];

/** Un identifiant de vidéo : 11 caractères de l'alphabet base64 URL. */
const ID = /^[\w-]{11}$/;

/**
 * L'identifiant de la vidéo, ou null si l'URL n'en désigne pas une (autre site,
 * page de chaîne, schéma non http(s), identifiant malformé).
 */
export function youtubeId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;

  const segments = u.pathname.split("/").filter(Boolean);

  // youtu.be/<id>
  if (u.hostname === HOTE_COURT) {
    return segments.length === 1 && ID.test(segments[0]) ? segments[0] : null;
  }

  if (!HOTES_VIDEO.has(u.hostname)) return null;

  // youtube.com/watch?v=<id>
  if (segments[0] === "watch") {
    const v = u.searchParams.get("v") ?? "";
    return ID.test(v) ? v : null;
  }

  // youtube.com/{embed,live,shorts}/<id>
  if (segments.length === 2 && PREFIXES.includes(segments[0]) && ID.test(segments[1])) {
    return segments[1];
  }

  return null;
}

/**
 * L'URL de la miniature de la vidéo, ou null. On prend `hqdefault` : c'est la
 * seule taille générée pour toutes les vidéos (`maxresdefault` manque dès que
 * la source n'est pas en HD). Elle est au format 4/3, avec des bandes noires
 * autour de l'image 16/9 — le recadrage de la carte les fait disparaître.
 */
export function youtubeVignette(url: string): string | null {
  const id = youtubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}
