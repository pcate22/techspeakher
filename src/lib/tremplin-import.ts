import { pool } from "@/lib/db";
import { buildTremplin1Seed } from "@/lib/tremplin-seed";
import { listEditions, createEdition } from "@/lib/tremplin-editions";
import { createAtelier } from "@/lib/tremplin-ateliers";
import { createRegistration } from "@/lib/tremplin-registrations";

/**
 * Importe la reprise du Tremplin 1 de façon **atomique** (transaction).
 *
 * Idempotent PAR ENTITÉ : si l'édition existe déjà, on ne la recrée pas, mais on
 * **complète les ateliers manquants** (comparés par titre) — sans toucher aux
 * inscriptions, qui appartiennent à l'orga (saisies, consentements, éditions).
 * C'est le cas réel où « Reprendre » avait tourné mais où les 5 ateliers du
 * parcours manquaient : re-cliquer les récupère au lieu de ne rien faire.
 *
 * En cas d'échec d'une insertion (table manquante, contrainte…), on ROLLBACK :
 * aucune donnée à moitié écrite. L'erreur réelle est propagée à l'appelant
 * (l'action la remonte à l'UI au lieu d'une page « oups »).
 *
 * `ateliersAjoutes` : nombre d'ateliers réellement insérés (0 si tous présents).
 */
export async function importTremplin1(): Promise<{
  created: boolean;
  editionId: number;
  ateliersAjoutes: number;
}> {
  const { edition, ateliers, registrations } = buildTremplin1Seed();

  const existing = (await listEditions()).find(
    (e) => e.nom === edition.nom && e.annee === edition.annee,
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (existing) {
      // Édition déjà là : on ne complète QUE les ateliers absents (par titre),
      // pour ne jamais dupliquer un atelier ni écraser les inscriptions.
      const { rows } = await client.query(
        `SELECT titre FROM tremplin_ateliers WHERE edition_id = $1`,
        [existing.id],
      );
      const dejaLa = new Set((rows as { titre: string }[]).map((r) => r.titre));
      const manquants = ateliers.filter((a) => !dejaLa.has(a.titre));
      for (const a of manquants) await createAtelier(existing.id, a, client);
      await client.query("COMMIT");
      return { created: false, editionId: existing.id, ateliersAjoutes: manquants.length };
    }

    const editionId = await createEdition(edition, client);
    for (const a of ateliers) await createAtelier(editionId, a, client);
    for (const r of registrations) await createRegistration(editionId, r, client);
    await client.query("COMMIT");
    return { created: true, editionId, ateliersAjoutes: ateliers.length };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
