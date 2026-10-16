/**
 * Lit l'image portée par un `unstable_update()` MANUEL — le seul chemin qui
 * change une photo de profil : envoi d'un fichier (`/api/mon-espace/avatar`) ou
 * reprise de la photo LinkedIn (`reprendrePhotoLinkedInAction`). Les deux
 * déposent la photo chez nous puis rafraîchissent le jeton par ici.
 *
 * Le callback `jwt` reçoit `session` tel qu'envoyé par l'appelant, non fiable
 * en soi (« note : valider ces données », doc Auth.js), d'où la validation de
 * forme ici plutôt qu'un cast direct dans `auth.ts`.
 *
 * Ce module portait aussi la reprise de photo PAR ALLER-RETOUR OAuth (cookie
 * d'intention + lecture de `profile.picture`). Elle a disparu avec le bouton
 * qui la déclenchait : la photo se choisit là où elle s'affiche, et l'URL d'un
 * provider — signée, périssable — n'est plus stockée telle quelle.
 */
export function pickManualImageUpdate(session: unknown): string | null {
  if (!session || typeof session !== "object") return null;
  const user = (session as { user?: unknown }).user;
  if (!user || typeof user !== "object") return null;
  const image = (user as { image?: unknown }).image;
  if (typeof image !== "string") return null;
  const trimmed = image.trim();
  return trimmed ? trimmed : null;
}
