import { unstable_update } from "@/auth";
import { setUserImage } from "@/lib/users";

/**
 * Poser une nouvelle photo de profil sur un compte — les DEUX écritures que ce
 * geste demande, ensemble et jamais l'une sans l'autre.
 *
 * La ligne `users.image` suffit à la fiche, mais pas à l'avatar du header : il
 * vient du jeton de session, qui garderait l'ancienne photo jusqu'à la
 * prochaine connexion. Les deux chemins qui posent une photo (envoi d'un
 * fichier via `/api/mon-espace/avatar`, reprise LinkedIn via
 * `reprendrePhotoLinkedInAction`) recopiaient ce couple ; ici, en oublier une
 * moitié demande de réécrire la fonction.
 *
 * Les deux écritures sont indépendantes (toutes deux ne dépendent que de
 * `url`) : en parallèle.
 */
export async function appliquerNouvelAvatar(userId: number, url: string): Promise<void> {
  await Promise.all([setUserImage(userId, url), unstable_update({ user: { image: url } })]);
}

/** Cadence anti-abus PARTAGÉE par les deux chemins : chaque photo posée coûte
 * réellement (stockage et bande passante du store Blob, appel au provider). Le
 * réglage est une décision unique, pas deux nombres recopiés. */
export const CADENCE_AVATAR = { envois: 10, fenetreMs: 10 * 60_000 } as const;
