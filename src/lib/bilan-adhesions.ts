import { pool } from "@/lib/db";
import { ecrireValeurReglage } from "@/lib/reglages";
import type { BilanSynchro, ResultatSynchro } from "@/lib/adhesions";

/**
 * Le bilan de la DERNIÈRE synchro HelloAsso, gardé en base pour la page orga
 * « Adhésions ». Vercel ne garde qu'une heure de logs : la ligne `[adhesions]`
 * du cron du soir avait disparu quand on venait la lire (2026-10-15).
 *
 * Rangé dans `plateforme_reglages` (clé-valeur) sous une clé que `getReglages`
 * ignore : aucune migration. Des COMPTEURS seulement — jamais une adresse ni
 * un nom (minimisation) — et un message d'erreur tronqué.
 */

const CLE_BILAN_ADHESIONS = "adhesions_derniere_synchro";

const ORIGINES = ["cron", "notification", "invitation", "manuelle"] as const;
export type OrigineSynchro = (typeof ORIGINES)[number];

export interface BilanAdhesions {
  /** Date du passage (ISO). */
  le: string;
  origine: OrigineSynchro;
  resultat: ResultatSynchro;
}

/** Ne garde que ce qui doit l'être : les compteurs, ou une erreur tronquée. */
function epure(r: ResultatSynchro): ResultatSynchro {
  if (r === "non_configuree") return r;
  if ("erreur" in r) return { erreur: String(r.erreur).slice(0, 200) };
  const n = (v: unknown) => Number(v) || 0;
  return {
    articles: n(r.articles),
    comptes: n(r.comptes),
    // Absent des bilans d'avant le 2026-10-15 : il se déduit.
    articlesRelies: r.articlesRelies === undefined ? n(r.articles) - n(r.sansCompte) : n(r.articlesRelies),
    sansCompte: n(r.sansCompte),
    expirees: n(r.expirees),
    fichesReprises: n(r.fichesReprises),
  };
}

/**
 * Enregistre le bilan d'un passage. Ne lève JAMAIS : la synchro a déjà eu
 * lieu, une écriture de bilan ratée ne doit pas la faire passer pour un échec.
 */
export async function enregistrerBilanAdhesions(
  resultat: ResultatSynchro,
  origine: OrigineSynchro,
  maintenant: Date = new Date(),
): Promise<void> {
  const valeur = JSON.stringify({ le: maintenant.toISOString(), origine, resultat: epure(resultat) });
  try {
    await ecrireValeurReglage(CLE_BILAN_ADHESIONS, valeur);
  } catch (err) {
    console.error("Bilan de synchro des adhésions non enregistré", err);
  }
}

/**
 * Le dernier bilan, ou null : aucun passage, valeur illisible, ou base en
 * panne (la page « Adhésions » reste debout, sa liste dira la panne).
 */
export async function lireBilanAdhesions(): Promise<BilanAdhesions | null> {
  try {
    const { rows } = await pool.query(`SELECT valeur FROM plateforme_reglages WHERE cle = $1`, [
      CLE_BILAN_ADHESIONS,
    ]);
    const brut = (rows[0] as { valeur: string } | undefined)?.valeur;
    if (!brut) return null;
    const b = JSON.parse(brut) as Partial<BilanAdhesions>;
    if (
      typeof b.le !== "string" ||
      Number.isNaN(Date.parse(b.le)) ||
      !ORIGINES.includes(b.origine as OrigineSynchro) ||
      !b.resultat
    )
      return null;
    return { le: b.le, origine: b.origine as OrigineSynchro, resultat: epure(b.resultat) };
  } catch (err) {
    console.error("Bilan de synchro des adhésions illisible", err);
    return null;
  }
}
