// Speakeuses d'une conférence — lecture publique dérivée du répertoire
// (migration 040). Une speakeuse remonte sur la page d'une conférence dès
// qu'elle a un talk avec une occurrence rattachée à l'édition
// (talk_occurrences.edition_id, migration 044) ET que sa fiche est publiée dans
// l'annuaire. Plus de line-up codé en dur : la donnée vit dans l'annuaire
// (fiche + talk + occurrence), la page ne fait que la refléter.

import { pool } from "@/lib/db";
import { siTableAbsente } from "@/lib/pg-errors";
import {
  toPublicSpeaker,
  mapRow as mapProfileRow,
  PROFILE_COLUMNS,
  type PublicSpeaker,
  type ProfileRow,
} from "@/lib/profiles";
import { type PublicTalkPreview, TALK_SOURCE_TREMPLIN } from "@/lib/talks";

/** Une speakeuse (vue publique annuaire) et ses talks sur l'édition. */
export interface ConferenceSpeaker {
  speaker: PublicSpeaker;
  talks: PublicTalkPreview[];
}

type Row = ProfileRow & { talk_titre: string; talk_type: string };

/**
 * Speakeuses PUBLIÉES de l'annuaire ayant au moins un talk rattaché à cette
 * édition de conférence — une entrée par speakeuse, avec ses talks sur
 * l'édition. Règles publiques :
 * - `sp.status = 'publie'` : une fiche en brouillon/masquée/refusée ne remonte
 *   jamais (la personne reste maîtresse de sa visibilité) ;
 * - talks `source = 'tremplin'` exclus (propositions du backfill non
 *   confirmées, comme sur la fiche publique) ;
 * - la sérialisation passe par `toPublicSpeaker` (la MÊME frontière que
 *   l'annuaire) : jamais l'e-mail, le userId ni le statut — et si un champ
 *   public évolue, les deux listes restent alignées.
 * Résilient : si la référence des conférences n'est pas migrée, on renvoie [].
 * Tri par nom (comme l'annuaire) ; les talks suivent l'ordre de saisie (id).
 */
export async function getPublicSpeakersByConferenceEdition(
  editionId: number,
): Promise<ConferenceSpeaker[]> {
  const { rows } = await pool
    .query(
      `SELECT ${PROFILE_COLUMNS}, st.titre AS talk_titre, st.type AS talk_type
         FROM speaker_talks st
         JOIN speaker_profiles sp ON sp.id = st.speaker_profile_id
         JOIN users u ON u.id = sp."userId"
        WHERE EXISTS (
                SELECT 1 FROM talk_occurrences o
                 WHERE o.talk_id = st.id AND o.edition_id = $1
              )
          AND sp.status = 'publie'
          AND st.source IS DISTINCT FROM $2
          AND st.titre IS NOT NULL AND st.titre <> ''
        ORDER BY u.name, st.id`,
      [editionId, TALK_SOURCE_TREMPLIN],
    )
    .catch(siTableAbsente({ rows: [] as Row[] }));

  // Une entrée par profil ; la Map conserve l'ordre d'insertion (donc l'ordre
  // du tri SQL par nom), pas besoin d'un index d'ordre séparé.
  const parProfil = new Map<number, ConferenceSpeaker>();
  for (const r of rows as Row[]) {
    let entree = parProfil.get(r.id);
    if (!entree) {
      entree = { speaker: toPublicSpeaker(mapProfileRow(r)), talks: [] };
      parProfil.set(r.id, entree);
    }
    entree.talks.push({ titre: r.talk_titre, type: r.talk_type });
  }
  return [...parProfil.values()];
}

// ─── Index public « Conférences et assos partenaires » (/conferences) ───

/** Une conf/asso partenaire, pour l'index public /conferences. */
export interface PartnerConference {
  slug: string;
  nom: string;
  type: string; // 'conference' | 'asso'
  ville: string | null;
  pays: string | null;
  siteUrl: string | null;
  /** Nombre d'éditions de cette conf/asso reliées à TSH (indication). */
  nbEvenements: number;
}

type PartnerRow = {
  slug: string; nom: string; type: string;
  ville: string | null; pays: string | null; site_url: string | null;
  nb_evenements: number | string;
};

/**
 * Conf/assos « partenaires » DÉRIVÉES (aucun flag admin) : une conf/asso
 * apparaît dès qu'au moins une de ses éditions a un lien réel avec TSH —
 *   (a) une speakeuse PUBLIÉE y a un talk dont une occurrence pointe l'édition,
 *       avec les MÊMES règles publiques que getPublicSpeakersByConferenceEdition
 *       ci-dessus (fiche publiée, talk hors source Tremplin, titre non vide) ;
 *   (b) un article PUBLIÉ y est rattaché (contenus.conference_edition_id) ;
 *   (c) une édition de Tremplin s'y tient (tremplin_editions.conference_edition_id).
 * Le lien fait foi (« ceux qui nous accueillent, nous, nos meetups, nos tremplins »).
 * Co-localisée avec sa sœur : même module, donc la constante partagée
 * `TALK_SOURCE_TREMPLIN` est réutilisée (pas de littéral, pas de cycle d'import).
 * Résilient : référence des conférences non migrée → [].
 */
export async function listPartnerConferences(): Promise<PartnerConference[]> {
  const { rows } = await pool
    .query(
      `WITH edition_liee AS (
         SELECT o.edition_id AS edition_id
           FROM talk_occurrences o
           JOIN speaker_talks st ON st.id = o.talk_id
           JOIN speaker_profiles sp ON sp.id = st.speaker_profile_id
          WHERE o.edition_id IS NOT NULL
            AND sp.status = 'publie'
            AND st.source IS DISTINCT FROM $1
            AND st.titre IS NOT NULL AND st.titre <> ''
         UNION
         SELECT co.conference_edition_id
           FROM contenus co
          WHERE co.conference_edition_id IS NOT NULL AND co.statut = 'publie'
         UNION
         SELECT te.conference_edition_id
           FROM tremplin_editions te
          WHERE te.conference_edition_id IS NOT NULL
       )
       SELECT c.slug, c.nom, c.type, c.ville, c.pays, c.site_url,
              COUNT(DISTINCT e.id) AS nb_evenements
         FROM conferences c
         JOIN conference_editions e ON e.conference_id = c.id
         JOIN edition_liee el ON el.edition_id = e.id
        GROUP BY c.id
        ORDER BY c.type, c.nom`,
      [TALK_SOURCE_TREMPLIN],
    )
    .catch(siTableAbsente({ rows: [] as PartnerRow[] }));
  return (rows as PartnerRow[]).map((r) => ({
    slug: r.slug,
    nom: r.nom,
    type: r.type,
    ville: r.ville,
    pays: r.pays,
    siteUrl: r.site_url,
    nbEvenements: Number(r.nb_evenements),
  }));
}
