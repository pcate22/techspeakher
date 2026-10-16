import { pool } from "@/lib/db";
import { sqlDansListe } from "@/lib/sql-liste";
import { ADHESION_STATUTS_PERIMES } from "@/lib/adhesion";
import {
  DUREE_INACTIVITE_JOURS,
  PREAVIS_SUPPRESSION_JOURS,
  PAS_SIGNE_DE_VIE_JOURS,
  VALIDITE_AVERTISSEMENT_JOURS,
} from "@/lib/conservation-comptes";

/**
 * QUI est un compte dormant, et que devient-il (cf.
 * `docs/conception-conservation-comptes.md`).
 *
 * Tout le champ d'application vit dans UNE clause `WHERE` partagée par les deux
 * lectures (avertir, supprimer) : une exclusion oubliée dans une branche
 * supprimerait quelqu'un qu'on avait promis d'épargner, et un `if` en tête de
 * fonction s'oublie là où une clause `WHERE` ne s'oublie pas.
 */

export interface CompteDormant {
  id: number;
  email: string;
  name: string | null;
  /** Instant de l'avertissement (null tant qu'il n'est pas parti). */
  annonceeLe: string | null;
}

/** Un instant daté d'il y a N jours. Le calcul vit en JS, et pas en SQL
 *  (`now() - N * interval '1 day'`) : `pg-mem`, le Postgres en mémoire de nos
 *  tests d'intégration, refuse l'arithmétique `integer * interval`, et une
 *  protection qu'on ne peut pas faire crier ne protège rien
 *  (`docs/principes-tests.md` § 3). */
export function ilYA(jours: number): Date {
  return new Date(Date.now() - jours * 86_400_000);
}

/**
 * Le champ d'application. `$1` = seuil d'inactivité, `$2` = maintenant.
 *
 * Chaque exclusion porte sa raison : sans elle, la personne suivante la défait
 * de bonne foi.
 */
const CONDITIONS_DORMANT = `
        -- Aucun signe de vie : ni passage (last_seen_at), ni mouvement de fiche
        -- (updated_at, talks compris). Un compte sans fiche n'a que le premier.
        --
        -- « IS NOT NULL » est la condition la plus importante du fichier : une
        -- mesure ABSENTE ne vaut pas une inactivité prouvée. Sans elle, un
        -- compte créé par une voie qui ne passe pas par la connexion (invitation
        -- Tremplin) naissait dormant, et disparaissait un mois plus tard. La
        -- colonne a un DEFAULT now() pour que le cas ne se présente pas ; ceci
        -- est la ceinture qui va avec les bretelles.
        u.last_seen_at IS NOT NULL
        AND u.last_seen_at < $1
        AND (sp.updated_at IS NULL OR sp.updated_at < $1)
        -- JOIGNABLE. On ne supprime JAMAIS quelqu'un qu'on n'a pas pu avertir :
        -- le préavis n'est pas une formalité, c'est la contrepartie de
        -- l'automatisme. Le suffixe « .invalid » marque la cohorte migrée sans
        -- adresse connue ; le sort de ces fiches est un autre sujet.
        AND u.email IS NOT NULL
        AND u.email NOT LIKE '%.invalid'
        -- Comptes OPÉRATIONNELS : supprimer une orga casserait des attributions
        -- (validated_by d'une fiche validée), une coach ses missions. Peu
        -- nombreux, traités à la main.
        AND u.is_orga = false
        AND u.is_coach = false
        -- ADHÉSION À JOUR : la base de conservation est la relation
        -- d'association, pas l'usage de la plateforme. Une adhérente qui paie
        -- sans jamais se connecter n'est pas une donnée en trop.
        -- Le statut est lu par une liste EXPLICITE — celle des statuts qui ne
        -- protègent PLUS (ADHESION_STATUTS_PERIMES) — jamais en négatif. La
        -- 073 a fermé la liste en base, ce qui règle la valeur ILLISIBLE —
        -- mais pas le statut qu'on ajoutera LÉGITIMEMENT demain : lu en
        -- négatif, il rangerait aussitôt ces comptes du côté de la suppression,
        -- en silence. Ici, ce qu'on ne sait pas lire est GARDÉ. Le seul geste
        -- irréversible du produit doit se tromper du côté qui n'efface rien.
        -- Re-juger ADHESION_STATUTS_PERIMES à chaque extension de
        -- MEMBERSHIP_STATUSES (HelloAsso est le déclencheur annoncé).
        AND (m.id IS NULL
             OR ${sqlDansListe("m.status", ADHESION_STATUTS_PERIMES)}
             OR m.expires_at <= $2)`;

/** `user_memberships."userId"` est UNIQUE : la jointure ramène au plus une ligne. */
const DORMANT_FROM = `FROM users u
       LEFT JOIN speaker_profiles sp ON sp."userId" = u.id
       LEFT JOIN user_memberships m ON m."userId" = u.id`;

function mapDormant(r: {
  id: number;
  email: string;
  name: string | null;
  suppression_annoncee_le: string | null;
}): CompteDormant {
  return {
    id: r.id,
    email: r.email,
    name: r.name ?? null,
    annonceeLe: r.suppression_annoncee_le ?? null,
  };
}

/**
 * À AVERTIR : dormants, et jamais avertis — OU avertis il y a si longtemps que
 * l'annonce est périmée. `suppression_annoncee_le` est le verrou d'idempotence
 * (un compte averti sort d'ici jusqu'à ce qu'il se réveille, le réveil remettant
 * la colonne à NULL) ; la péremption est la porte de sortie qui évite l'état
 * « avertie une fois, jamais supprimée, jamais réavertie ».
 */
export async function comptesAAvertir(
  inactiviteJours: number = DUREE_INACTIVITE_JOURS,
): Promise<CompteDormant[]> {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.suppression_annoncee_le
       ${DORMANT_FROM}
      WHERE ${CONDITIONS_DORMANT}
        AND (u.suppression_annoncee_le IS NULL OR u.suppression_annoncee_le < $3)
      ORDER BY u.id ASC`,
    [ilYA(inactiviteJours), new Date(), ilYA(VALIDITE_AVERTISSEMENT_JOURS)],
  );
  return (rows as Parameters<typeof mapDormant>[0][]).map(mapDormant);
}

/**
 * À SUPPRIMER : avertis il y a plus que le préavis, et TOUJOURS dormants.
 *
 * La condition d'inactivité est revérifiée ici, alors qu'un réveil efface déjà
 * l'avertissement : deux verrous pour le seul geste irréversible du produit.
 * Celui qui coûte le moins cher est celui qu'on n'aura pas à regretter.
 */
export async function comptesASupprimer(
  inactiviteJours: number = DUREE_INACTIVITE_JOURS,
  preavisJours: number = PREAVIS_SUPPRESSION_JOURS,
): Promise<CompteDormant[]> {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.suppression_annoncee_le
       ${DORMANT_FROM}
      WHERE ${CONDITIONS_DORMANT}
        AND u.suppression_annoncee_le IS NOT NULL
        -- Le préavis est écoulé…
        AND u.suppression_annoncee_le < $3
        -- … et l'annonce est encore VALIDE. Une annonce plus vieille que ça est
        -- périmée : le compte repart se faire avertir, il n'est pas supprimé sur
        -- la foi d'un courrier oublié.
        AND u.suppression_annoncee_le >= $4
      ORDER BY u.id ASC`,
    [
      ilYA(inactiviteJours),
      new Date(),
      ilYA(preavisJours),
      ilYA(VALIDITE_AVERTISSEMENT_JOURS),
    ],
  );
  return (rows as Parameters<typeof mapDormant>[0][]).map(mapDormant);
}

/**
 * Marque UN avertissement parti. Compte par compte, et sur les seuls envois
 * réussis : un incident Brevo ferait autrement courir un préavis que personne
 * n'a reçu, donc supprimerait sans avertissement — et un passage coupé en route
 * perdrait la trace de ce qui est déjà parti, pour réécrire aux mêmes personnes
 * le lendemain. Le coût est un UPDATE d'une ligne par envoi, face à un appel
 * réseau de cent fois sa durée dans la même itération.
 */
export async function marquerAvertissement(id: number): Promise<void> {
  await pool.query(`UPDATE users SET suppression_annoncee_le = now() WHERE id = $1`, [id]);
}

/**
 * LE SIGNE DE VIE. Horodate le passage et **efface l'avertissement** : sans
 * cette remise à zéro, une inactivité future supprimerait le compte sans que la
 * personne ait eu sa chance — elle aurait été avertie deux ans plus tôt, pour
 * une échéance qu'elle avait déjà annulée en revenant.
 *
 * Écriture bornée dans le temps (`PAS_SIGNE_DE_VIE_JOURS`) par sa propre clause
 * `WHERE` : le callback jwt tourne à chaque rafraîchi de jeton, on n'écrit donc
 * qu'une fois par semaine et par compte. La précision d'une semaine est sans
 * effet sur une échéance de deux ans.
 *
 * Rend VRAI si la ligne a bougé — l'appelant s'en sert pour ne pas réessayer.
 */
export async function toucherSigneDeVie(userId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE users
        SET last_seen_at = $2, suppression_annoncee_le = NULL
      WHERE id = $1
        AND (last_seen_at IS NULL OR last_seen_at < $3)`,
    [userId, new Date(), ilYA(PAS_SIGNE_DE_VIE_JOURS)],
  );
  return (rowCount ?? 0) > 0;
}
