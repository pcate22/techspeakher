import { withTransaction } from "@/lib/db";
import { getEditionById, createEdition } from "@/lib/tremplin-editions";
import { getAteliersByEdition, createAtelier } from "@/lib/tremplin-ateliers";

/**
 * Cible d'une duplication : la nouvelle identité publique (conf, année) et les
 * champs éditoriaux qu'on garde. Tout le reste (dates, description) est vidé, et
 * AUCUNE donnée personnelle ne traverse — cf. `docs/tremplin-duplication-edition.md`.
 */
export interface DuplicateTarget {
  /** = conf de la source (nouvelle année) ou saisie (autre conférence). */
  confSlug: string;
  annee: number;
  /** Nom proposé, éditable (dérivé de conf + année côté UI). */
  nom: string;
  confNom: string | null;
  /** Lieu de la conf (ville OU pays) : repris de la source pour que le nom
   * affiché reste « DevFest Toulouse » (et pas « DevFest ») sur la copie.
   * Facultatif : `null` si absent. */
  confLieu?: string | null;
  confLien: string | null;
}

/**
 * Duplique une édition vers une NOUVELLE édition en `preparation`, à partir
 * d'une source prise comme modèle. Recopie le squelette réutilisable — les
 * ateliers, `ordre`/`titre`/`description` SEULEMENT — et rien d'autre :
 *
 * - dates (conf, finale, inscriptions), horaires, lien visio, description de
 *   l'édition et champ texte `coachs` des ateliers → **vidés** (événementiel
 *   daté ou noms de personnes) ;
 * - inscriptions, photos, documents, récompenses, membres, coachs comptes,
 *   consentements → **jamais recopiés** (données personnelles).
 *
 * Atomique (transaction : tout ou rien). Le conflit d'unicité (conf, année)
 * remonte tel quel (code Postgres `23505`) : l'édition n'est alors PAS créée.
 * Renvoie l'id de la nouvelle édition, ou `null` si la source est introuvable.
 */
export async function duplicateEdition(
  sourceId: number,
  target: DuplicateTarget,
): Promise<number | null> {
  // Lectures de la source hors transaction (immuables pendant la copie) : si
  // elle n'existe pas, on n'ouvre aucune transaction et on ne crée rien.
  const source = await getEditionById(sourceId);
  if (!source) return null;
  const ateliers = await getAteliersByEdition(sourceId);

  return withTransaction(async (client) => {
    // Le conflit (conf, année) tombe ICI, sur le premier INSERT → rollback propre.
    const newId = await createEdition(
      {
        nom: target.nom,
        annee: target.annee,
        confSlug: target.confSlug,
        statut: "preparation",
        description: null,
        confNom: target.confNom,
        confLieu: target.confLieu ?? null,
        confDate: null,
        confLien: target.confLien,
        finaleDate: null,
        finaleLieu: null,
        inscriptionsDebut: null,
        inscriptionsFin: null,
      },
      client,
    );

    for (const a of ateliers) {
      await createAtelier(
        newId,
        {
          ordre: a.ordre,
          titre: a.titre,
          description: a.description,
          // La phase (avant / après la soirée) et la nature (collectif /
          // sous-groupes) font partie du squelette du parcours : on les
          // conserve. Dates, fenêtre, horaires, lieu, visio et coachs (noms de
          // personnes) sont, eux, vidés (non transmis → défauts null).
          // L'AUDIENCE et la VISIBILITÉ PUBLIQUE ne sont pas transmises non
          // plus : la copie naît fermée et hors vitrine. Reprendre l'état de la
          // source publierait le parcours de l'année suivante le jour où on
          // l'ébauche, alors qu'aucune de ses dates n'est encore vraie.
          phase: a.phase,
          nature: a.nature,
          date: null,
          heureDebut: null,
          heureFin: null,
          lienVisio: null,
          coachs: null,
        },
        client,
      );
    }

    return newId;
  });
}
