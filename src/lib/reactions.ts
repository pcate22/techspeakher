import { pool } from "@/lib/db";
import { getSession } from "@/lib/auth-guards";
import { siTableAbsente } from "@/lib/pg-errors";
import { TALK_SOURCE_TREMPLIN } from "@/lib/talks";
import { aujourdhuiParis } from "@/lib/tremplin-editions";
import { SCENES_FROM, scenesVisiblesWhere } from "@/lib/agenda-public";
import { VENUES_FROM, VENUES_VISIBLES } from "@/lib/fil-communaute";
import { CONTENU_AU_FIL } from "@/lib/contenus";
import { cleCarte, type CarteFil } from "@/lib/fil-cartes";

/**
 * LES BRAVOS 👏 (lot N4, docs/conception-lot-n4-reactions.md) : un
 * applaudissement NOMINATIF par membre et par carte du fil — un geste, pas un
 * texte. Interne à l'espace connecté : la lecture est GARDÉE par la session
 * dans cette lib même (aucun écran public ne peut la réutiliser par
 * accident).
 *
 * Sécurité / RGPD :
 * - POSER est borné en SQL aux cartes INCARNÉES que le fil peut montrer —
 *   les règles EXACTES des trois sources, partagées (`scenesVisiblesWhere`,
 *   `VENUES_VISIBLES`, `CONTENU_AU_FIL`), jamais re-dérivées — et jamais sa
 *   propre carte. Une actualité de l'ASSO n'est pas applaudissable : le
 *   bravo va à une personne, pas à une annonce. Cible invisible,
 *   inexistante, sienne ou non incarnée : zéro ligne, MÊME silence (aucun
 *   oracle d'existence des brouillons).
 * - RETIRER marche TOUJOURS (aucune borne de visibilité) : la base légale
 *   « retirable à tout moment » en dépend.
 * - Le retrait rétroactif PURGE (withdrawOwnProfile, setStatut) ; les
 *   cascades du schéma font le reste.
 */

export type TypeCible = "scene" | "venue" | "asso";

export interface CibleReaction {
  type: TypeCible;
  id: number;
}

/** Ce que la rangée d'une carte affiche : compte, première donneuse nommée,
 * et « moi » (ai-je applaudi cette carte). */
export interface ReactionsCarte {
  nb: number;
  premiere: string | null;
  moi: boolean;
}

const COLONNE: Record<TypeCible, "occurrence_id" | "profile_id" | "contenu_id"> = {
  scene: "occurrence_id",
  venue: "profile_id",
  asso: "contenu_id",
};

/** LA liste fermée des types vit ici (une copie) : l'action s'en sert comme
 * garde — ajouter une source au fil se voit du compilateur, jamais d'un Set
 * oublié. */
export function estTypeCible(s: string): s is TypeCible {
  return Object.hasOwn(COLONNE, s);
}

/**
 * Pose le bravo de `userId` sur la cible — si et seulement si la cible est
 * une carte visible du fil ET n'est pas la sienne. L'EXISTS vit DANS l'INSERT
 * (pas de fenêtre entre vérification et écriture) ; l'`ON CONFLICT … DO
 * UPDATE` (no-op) rend le geste idempotent ET dit si l'état « applaudi » est
 * ATTEINT : `false` = rien à applaudir ici (cible invisible, inexistante ou
 * sienne — MÊME réponse, zéro oracle), à dire à l'utilisatrice.
 */
export async function poserReaction(userId: number, cible: CibleReaction): Promise<boolean> {
  if (cible.type === "scene") {
    const { rows } = await pool.query(
      `INSERT INTO fil_reactions (user_id, occurrence_id)
       SELECT $1, $2
        WHERE EXISTS (SELECT 1 ${SCENES_FROM}
                WHERE o.id = $2
                  AND ${scenesVisiblesWhere({ tremplin: "$3", jour: "$4" })}
                  AND sp."userId" <> $1)
       ON CONFLICT (occurrence_id, user_id) WHERE occurrence_id IS NOT NULL
       DO UPDATE SET user_id = fil_reactions.user_id
       RETURNING id`,
      [userId, cible.id, TALK_SOURCE_TREMPLIN, aujourdhuiParis()],
    );
    return rows.length > 0;
  }
  if (cible.type === "venue") {
    const { rows } = await pool.query(
      `INSERT INTO fil_reactions (user_id, profile_id)
       SELECT $1, $2
        WHERE EXISTS (SELECT 1 ${VENUES_FROM}
                WHERE sp.id = $2
                  AND ${VENUES_VISIBLES}
                  AND sp."userId" <> $1)
       ON CONFLICT (profile_id, user_id) WHERE profile_id IS NOT NULL
       DO UPDATE SET user_id = fil_reactions.user_id
       RETURNING id`,
      [userId, cible.id],
    );
    return rows.length > 0;
  }
  // asso : SEUL l'article d'une MEMBRE s'applaudit (`auteur_user_id` posé) —
  // un bravo va à une PERSONNE pour son geste, jamais à une annonce de
  // l'association, qui n'a personne à féliciter. Et jamais par son autrice.
  const { rows } = await pool.query(
    `INSERT INTO fil_reactions (user_id, contenu_id)
     SELECT $1, $2
      WHERE EXISTS (SELECT 1 FROM contenus c
              WHERE c.id = $2
                AND ${CONTENU_AU_FIL}
                AND c.auteur_user_id IS NOT NULL
                AND c.auteur_user_id <> $1)
     ON CONFLICT (contenu_id, user_id) WHERE contenu_id IS NOT NULL
     DO UPDATE SET user_id = fil_reactions.user_id
     RETURNING id`,
    [userId, cible.id],
  );
  return rows.length > 0;
}

/** Retire SON bravo — toujours possible (RGPD), borné à `user_id` seul. */
export async function retirerReaction(userId: number, cible: CibleReaction): Promise<void> {
  await pool.query(
    `DELETE FROM fil_reactions WHERE user_id = $1 AND ${COLONNE[cible.type]} = $2`,
    [userId, cible.id],
  );
}

/**
 * Les bravos de TOUT le fil, en une requête, indexés par la clé de carte
 * (`scene-12`…). GARDE interne : hors session, la lib rend une Map vide —
 * cette donnée ne sort jamais vers un écran public. Le nom cité est celui du
 * PREMIER bravo AYANT un nom et qui N'EST PAS le mien (ordre d'arrivée par
 * id : déterministe, re-applaudir ne fait gagner aucune place, et le libellé
 * « Toi, {citée}… » ne se cite jamais deux fois).
 */
export async function getReactionsPourFil(
  cartes: CarteFil[],
): Promise<Map<string, ReactionsCarte>> {
  const session = await getSession();
  const uid = Number(session?.user?.id);
  if (!uid || cartes.length === 0) return new Map();

  const ids = (type: TypeCible) =>
    cartes.filter((c) => c.type === type).map((c) => c.id);

  const { rows } = await pool
    .query(
      `SELECT b.occurrence_id, b.profile_id, b.contenu_id,
              COUNT(*)::int AS nb,
              (array_agg(u.name ORDER BY b.id)
                 FILTER (WHERE u.name IS NOT NULL AND b.user_id <> $1))[1]
                AS premiere,
              bool_or(b.user_id = $1) AS moi
         FROM fil_reactions b
         LEFT JOIN users u ON u.id = b.user_id
        WHERE b.occurrence_id = ANY($2::int[])
           OR b.profile_id = ANY($3::int[])
           OR b.contenu_id = ANY($4::int[])
        GROUP BY b.occurrence_id, b.profile_id, b.contenu_id`,
      [uid, ids("scene"), ids("venue"), ids("asso")],
    )
    // Table du lot N4 : une base pas encore migrée n'a rien applaudi.
    .catch(siTableAbsente({ rows: [] }));

  const infos = new Map<string, ReactionsCarte>();
  for (const r of rows as {
    occurrence_id: number | null;
    profile_id: number | null;
    contenu_id: number | null;
    nb: number;
    premiere: string | null;
    moi: boolean;
  }[]) {
    // LA même clé que les cartes (cleCarte) : les deux producteurs du format
    // sont le même code, un désaccord est impossible.
    const cle =
      r.occurrence_id != null
        ? cleCarte("scene", r.occurrence_id)
        : r.profile_id != null
          ? cleCarte("venue", r.profile_id)
          : cleCarte("asso", r.contenu_id as number);
    infos.set(cle, { nb: r.nb, premiere: r.premiere, moi: r.moi === true });
  }
  return infos;
}
