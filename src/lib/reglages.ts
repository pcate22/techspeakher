import { pool } from "@/lib/db";

/**
 * Réglages de la plateforme (lot C4) : table clé-valeur `plateforme_reglages`
 * (migration 030) + VALEURS PAR DÉFAUT dans le code, source unique pour le
 * moteur de tâches et les crons. Une ligne en base par réglage MODIFIÉ
 * seulement ; table absente ou valeur illisible → défauts (rien ne casse).
 *
 * La table garde aussi une clé qui N'EST PAS un réglage :
 * `adhesions_derniere_synchro` (`bilan-adhesions.ts`), un JSON que
 * `getReglages` ignore puisqu'elle est absente de `REGLAGES_DEFAUT`.
 */
export const REGLAGES_DEFAUT = {
  /** Engagement orga : une fiche speakeuse soumise est validée sous N jours. */
  validation_fiche_jours: 15,
  /** Fenêtre d'alerte : un atelier incomplet sonne à N jours de sa date. */
  alerte_atelier_jours: 7,
  /** Rappel de mise à jour d'une fiche publiée, tous les N jours. */
  rappel_fiche_jours: 180,
  /**
   * Une fiche en brouillon est « en sommeil » après N jours sans modification :
   * elle entre alors dans la liste de relance de l'orga. Fenêtre AUSSI utilisée
   * comme anti-doublon (deux relances espacées d'au moins N jours).
   */
  relance_brouillon_jours: 30,
} as const;

export type CleReglage = keyof typeof REGLAGES_DEFAUT;

/** Bornes de saisie (page /admin/reglages) : des jours, raisonnables. */
export const REGLAGE_MIN = 1;
export const REGLAGE_MAX = 365;

/** Libellés de la page /admin/reglages (une sous-page par clé). */
export const REGLAGE_INFOS: Record<
  CleReglage,
  { titre: string; description: string }
> = {
  validation_fiche_jours: {
    titre: "Délai de validation d'une fiche",
    description:
      "Nombre de jours pour valider une fiche speakeuse soumise. C'est l'échéance affichée dans « À faire » (engagement de l'équipe organisatrice).",
  },
  alerte_atelier_jours: {
    titre: "Fenêtre d'alerte des ateliers",
    description:
      "Nombre de jours avant la date d'un atelier pendant lesquels les tâches (lien visio manquant, coach à trouver) apparaissent sur les tableaux de bord.",
  },
  rappel_fiche_jours: {
    titre: "Rappel de mise à jour des fiches",
    description:
      "Nombre de jours entre deux rappels par e-mail aux speakeuses publiées pour mettre à jour leur fiche et leurs talks.",
  },
  relance_brouillon_jours: {
    titre: "Fiches en sommeil",
    description:
      "Nombre de jours sans modification à partir desquels une fiche en brouillon entre dans la liste de relance. Ce délai sépare aussi deux relances d'une même personne.",
  },
};

/**
 * Réglages effectifs : défauts du code, écrasés par les lignes de la table.
 * Un seul SELECT ; table absente (migration pas jouée) ou valeur illisible →
 * défauts, sans casser les tableaux de bord ni les crons.
 */
export async function getReglages(): Promise<Record<CleReglage, number>> {
  const reglages: Record<CleReglage, number> = { ...REGLAGES_DEFAUT };
  try {
    const { rows } = await pool.query(`SELECT cle, valeur FROM plateforme_reglages`);
    for (const r of rows as { cle: string; valeur: string }[]) {
      // Object.hasOwn : `in` accepterait les clés du prototype (toString…).
      if (!Object.hasOwn(reglages, r.cle)) continue; // clé inconnue : ignorée
      const n = Number(r.valeur);
      if (Number.isInteger(n) && n >= REGLAGE_MIN && n <= REGLAGE_MAX) {
        reglages[r.cle as CleReglage] = n;
      } else {
        console.warn(`Réglage ${r.cle} illisible ou hors bornes (« ${r.valeur} »), défaut conservé`);
      }
    }
  } catch (e) {
    console.error("Réglages indisponibles (migration 030 ?), défauts utilisés", e);
  }
  return reglages;
}

/** Écrit une valeur de la table (upsert) : le seul `INSERT` qui la vise. */
export async function ecrireValeurReglage(cle: string, valeur: string): Promise<void> {
  await pool.query(
    `INSERT INTO plateforme_reglages (cle, valeur)
     VALUES ($1, $2)
     ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, updated_at = now()`,
    [cle, valeur],
  );
}

/** Enregistre UN réglage (upsert). La validation des bornes vit dans l'action. */
export async function setReglage(cle: CleReglage, valeur: number): Promise<void> {
  await ecrireValeurReglage(cle, String(valeur));
}
