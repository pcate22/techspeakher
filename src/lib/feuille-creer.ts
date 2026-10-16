import { getProfileByUserId } from "@/lib/profiles";
import { getTitresTalks } from "@/lib/talks";
import { getEditionsActives } from "@/lib/tremplin-editions";
import { getCompte, peutCreerFiche } from "@/lib/users";

/**
 * Données de la feuille ➕ « Créer » (conception N1 §2.4) : quel premier
 * geste proposer, et à une orga, vers quelles éditions raccourcir. Calculées
 * côté serveur (NavEspaceServeur) : la capacité dépend de la base, jamais du
 * client.
 */
export interface FeuilleDonnees {
  /** Le geste de création proposé : un talk (fiche existante), la fiche
   * (compte éligible sans fiche), ou aucun (genre « homme » sans fiche —
   * jamais de CTA impossible, même garde que l'onboarding de Mon espace). */
  creation: "talk" | "fiche" | null;
  orga: boolean;
  /** Éditions actives (ordonnées) pour « Ajouter un atelier » : une seule →
   * lien direct, plusieurs → choix. Vide hors rôle orga. */
  editions: { id: number; nom: string }[];
  /** Les talks de la fiche, pour « Ajouter une date à un talk » : un seul → lien
   * direct vers sa fenêtre de date, plusieurs → choix du talk. Vide sans
   * fiche. */
  talks: { id: number; titre: string }[];
}

/** Construit les données de la feuille pour la personne connectée. */
export async function getFeuilleDonnees(user: {
  id: string;
  isOrga: boolean;
}): Promise<FeuilleDonnees> {
  const uid = Number(user.id);
  const [profile, editions, talks] = await Promise.all([
    getProfileByUserId(uid),
    user.isOrga ? getEditionsActives() : Promise.resolve([]),
    getTitresTalks(uid),
  ]);

  if (profile) return { creation: "talk", orga: user.isOrga, editions, talks };
  // Sans fiche seulement : le genre décide si la fiche peut être créée.
  const creation = peutCreerFiche((await getCompte(uid))?.genre) ? ("fiche" as const) : null;
  return { creation, orga: user.isOrga, editions, talks: [] };
}
