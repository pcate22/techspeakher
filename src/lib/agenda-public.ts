import { pool } from "@/lib/db";
import { TALK_SOURCE_TREMPLIN } from "@/lib/talks";
import { OCCURRENCE_PUBLIABLE } from "@/lib/occurrence-visibilite";
import { speakeuseHref } from "@/lib/profiles";
import {
  estPasseTalkDate,
  finDePeriodeTalk,
  formatTalkDate,
  isExactTalkDate,
} from "@/lib/talk-date";
import { formatDateFr } from "@/lib/format";
import { grouperPar } from "@/lib/groupement";
import { cleConference, libelleConference } from "@/lib/agenda-conference";
import { regionAffichee } from "@/lib/lieu-occurrence";

/**
 * AGENDA PUBLIC DES SPEAKEUSES : où la communauté prend la parole, toutes fiches
 * confondues. L'annuaire dit QUI ; l'agenda dit QUAND et OÙ — la même matière
 * (les conférences d'un talk), lue en travers au lieu d'une fiche à la fois.
 *
 * PÉRIMÈTRE PUBLIC, strictement :
 * - seules les fiches PUBLIÉES (`sp.status = 'publie'`) — une fiche en
 *   brouillon, en relecture ou retirée reste invisible, y compris ses dates ;
 * - pas les propositions issues du backfill Tremplin (`source <> tremplin`),
 *   comme sur la fiche publique : ce sont des sujets pitchés, pas des dates ;
 * - une date est requise (un talk sans date n'est pas un agenda).
 *
 * Le DTO ne porte QUE de l'affichable : ni e-mail, ni statut, ni identifiant
 * interne au-delà du lien vers la fiche.
 */
export interface ScenePublique {
  occurrenceId: number;
  /** Date triable à précision variable : « 2026 », « 2026-11 », « 2026-11-19 ». */
  date: string;
  /** Libellé FIGÉ à la saisie : ce qu'on affiche sur la carte, tel qu'annoncé. */
  conference: string | null;
  /**
   * Clé de regroupement d'une facette « conférence » — issue du REGISTRE quand
   * l'occurrence y est rattachée, d'un repli sur le libellé sinon. Jamais le
   * libellé brut : deux saisies du même événement divergent (« DevFest » et
   * « DevFest Toulouse » le même jour, mesuré en prod le 16/08/2026, cf. §4.1
   * de `docs/audit-ux-agenda-2026-08.md`). Voir `lib/agenda-conference.ts`.
   */
  conferenceCle: string | null;
  /** Nom à afficher pour cette facette (registre d'abord, saisie sinon). */
  conferenceLibelle: string | null;
  ville: string | null;
  /**
   * Région dans le vocabulaire de l'annuaire (migration 072) — toujours
   * renseignée : une ville française donne sa région, une ville étrangère
   * « International », une intervention sans lieu « À distance (visio) ».
   * La règle vit dans `lib/lieu-occurrence.ts`, jamais dans une vue.
   */
  region: string;
  pays: string | null;
  lienConf: string | null;
  talkTitre: string;
  talkType: string;
  speakeuseNom: string;
  /** Lien vers sa fiche d'annuaire (slug si elle en a un, sinon id). */
  speakeuseHref: string;
  /** Fiche propriétaire (lot N4 : jamais de bouton Bravo sur SA carte). */
  profileId: number;
  /** Photo du compte (les cartes du fil sont incarnées), sinon initiales. */
  image: string | null;
}

interface SceneRow {
  occ_id: number;
  date: string;
  conference: string | null;
  conf_slug: string | null;
  conf_nom: string | null;
  ville: string | null;
  region: string | null;
  pays: string | null;
  lien_conf: string | null;
  talk_titre: string;
  talk_type: string;
  profile_id: number;
  slug: string | null;
  nom: string;
  image: string | null;
}

/**
 * Jointures du périmètre des scènes (alias o/t/sp/u), partagées par les
 * lectures d'ici ET par les bravos (lot N4) — une seule copie de « qu'est-ce
 * qu'une scène », jamais une réécriture qui divergerait.
 */
export const SCENES_FROM = `FROM talk_occurrences o
       JOIN speaker_talks t ON t.id = o.talk_id
       JOIN speaker_profiles sp ON sp.id = o.speaker_profile_id
       JOIN users u ON u.id = sp."userId"
       -- LEFT : une occurrence peut rester en texte libre (saisie antérieure au
       -- registre, ou conférence encore absente du catalogue). Un INNER JOIN la
       -- ferait disparaître de l'agenda, ce qui serait pire que de la ranger
       -- dans une facette de repli.
       LEFT JOIN conferences c ON c.id = o.conference_id`;

/**
 * Conditions du périmètre d'une scène VISIBLE (une seule copie) : fiche
 * publiée, talk hors backfill tremplin, date posée, nom présent — et, pour le
 * FIL, strictement passée à date exacte. `p` donne les numéros de paramètres
 * de la requête appelante (`$1`, `$2`…) : tremplin toujours, jour si fil.
 */
export function scenesVisiblesWhere(p: { tremplin: string; jour?: string }): string {
  // Défense en profondeur : ces valeurs s'interpolent dans du SQL — seuls des
  // PLACEHOLDERS ($1, $2…) sont admis, jamais une donnée.
  if (!/^\$\d+$/.test(p.tremplin) || (p.jour && !/^\$\d+$/.test(p.jour)))
    throw new Error("scenesVisiblesWhere attend des placeholders ($n)");
  return (
    `sp.status = 'publie'
        AND (t.source IS NULL OR t.source <> ${p.tremplin})
        -- Conférence encore en proposition (migration 068) : la scène n'existe
        -- publiquement qu'une fois la conférence validée par une orga.
        AND ${OCCURRENCE_PUBLIABLE}
        AND o.date IS NOT NULL
        AND u.name IS NOT NULL` +
    (p.jour
      ? `
        AND o.date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        AND o.date < ${p.jour}`
      : "")
  );
}

const SCENES_COLONNES = `SELECT o.id AS occ_id, o.date, o.conference,
            c.slug AS conf_slug, c.nom AS conf_nom, o.ville, o.region, o.pays,
            o.lien_conf, t.titre AS talk_titre, t.type AS talk_type,
            sp.id AS profile_id, sp.slug, u.name AS nom, u.image`;

/** Colonnes et jointures partagées par les deux lectures (public + fil). */
const SELECT_SCENES = `${SCENES_COLONNES}
       ${SCENES_FROM}
      WHERE ${scenesVisiblesWhere({ tremplin: "$1" })}`;

function mapScene(r: SceneRow): ScenePublique {
  // Identité de conférence tranchée ICI, une fois : le registre d'abord, le
  // libellé figé en repli (§7 des principes de conception — normaliser au point
  // de lecture, pas dans chaque vue qui l'affiche).
  const identite = { slug: r.conf_slug, nom: r.conf_nom, snapshot: r.conference };
  return {
    occurrenceId: r.occ_id,
    date: r.date,
    conference: r.conference,
    conferenceCle: cleConference(identite),
    conferenceLibelle: libelleConference(identite),
    ville: r.ville,
    // Tranchée au bord, comme l'identité de conférence : une vue affiche, elle
    // ne décide pas où ranger une intervention.
    region: regionAffichee({ ville: r.ville, region: r.region }),
    pays: r.pays,
    lienConf: r.lien_conf,
    talkTitre: r.talk_titre,
    talkType: r.talk_type,
    speakeuseNom: r.nom,
    speakeuseHref: speakeuseHref({ id: r.profile_id, slug: r.slug }),
    profileId: r.profile_id,
    image: r.image,
  };
}

/**
 * Toutes les interventions datées des speakeuses publiées, au plus tôt d'abord.
 * Le volume se compte en dizaines (une communauté, pas un catalogue) : on trie
 * et on découpe ensuite en mémoire, sans deuxième aller-retour.
 */
export async function getScenesPubliques(): Promise<ScenePublique[]> {
  const { rows } = await pool.query(
    `${SELECT_SCENES}
      ORDER BY o.date, o.id`,
    [TALK_SOURCE_TREMPLIN],
  );
  return (rows as SceneRow[]).map(mapScene);
}

/**
 * L'HORIZON : ce qui vient, jamais calé sur l'année civile.
 *
 * Décision du 2026-08-16 (docs/audit-ux-agenda-2026-08.md §8) : `/agenda` est
 * un HORIZON GLISSANT, pas une année. Une page d'atterrissage calée sur
 * l'année se viderait en décembre — défaut structurel qui n'apparaîtrait
 * qu'une semaine par an, donc qu'aucune revue ne verrait passer.
 *
 * Le plancher SQL est volontairement GROSSIER (l'année en cours, comparée en
 * texte) : il borne la lecture sans jamais rejouer en SQL la logique de
 * `estPasseTalkDate`. Une date imprécise (« 2026 », « 2026-11 ») reste donc
 * candidate, et c'est `separerScenes` — déjà écrit, déjà testé — qui tranche
 * précisément. Dupliquer cette logique ici la ferait diverger au premier
 * changement.
 */
export async function getScenesHorizon(aujourdhui: string): Promise<ScenePublique[]> {
  const anneeCourante = aujourdhui.slice(0, 4);
  const { rows } = await pool.query(
    `${SCENES_COLONNES}
       ${SCENES_FROM}
      WHERE ${scenesVisiblesWhere({ tremplin: "$1" })}
        AND o.date >= $2
      ORDER BY o.date, o.id`,
    [TALK_SOURCE_TREMPLIN, anneeCourante],
  );
  const scenes = (rows as SceneRow[]).map(mapScene);
  return separerScenes(scenes, aujourdhui).aVenir;
}

/**
 * LE COMPTE RENDU D'UNE ANNÉE : tout ce que la communauté y a porté.
 *
 * Une année révolue est un document FINI et citable, contrairement à
 * l'horizon. Elle se lit par son préfixe de date, ce qui ramasse aussi les
 * annonces imprécises de l'année (« 2025 », « 2025-06 »).
 *
 * Le périmètre public s'applique ici comme ailleurs : une fiche retirée
 * disparaît de l'archive, rétroactivement. La mémoire est complète, elle n'est
 * pas un instantané figé — retirer son accord reste souverain (RGPD art. 7-3).
 */
export async function getScenesDeLAnnee(
  annee: number,
  limite = 500,
): Promise<ScenePublique[]> {
  const { rows } = await pool.query(
    `${SCENES_COLONNES}
       ${SCENES_FROM}
      WHERE ${scenesVisiblesWhere({ tremplin: "$1" })}
        AND o.date LIKE $2
      ORDER BY o.date DESC, o.id DESC
      LIMIT $3`,
    [TALK_SOURCE_TREMPLIN, `${annee}%`, limite],
  );
  return (rows as SceneRow[]).map(mapScene);
}

/** Une année d'archive et ce qu'elle porte. */
export interface AnneeArchive {
  annee: number;
  nombre: number;
}

/**
 * Les années qui portent au moins une intervention PASSÉE, la plus récente
 * d'abord — de quoi construire les liens vers les comptes rendus.
 *
 * AUCUN SEUIL (décision du 16/08) : une année existe dès UNE intervention. Le
 * passé se remplit à retardement, à mesure que les speakeuses complètent leur
 * fiche ; masquer une année maigre reviendrait à cacher la page pendant
 * précisément la période où elle grandit, et une adresse qui apparaît puis
 * disparaît est le pire cas pour les liens entrants et les moteurs.
 *
 * « Passée » se juge sur la FIN de période, comme partout ailleurs : une
 * annonce « courant 2026 » n'entre dans l'archive qu'une fois l'année close.
 */
export async function getAnneesArchive(aujourdhui: string): Promise<AnneeArchive[]> {
  const parAnnee = new Map<number, number>();
  for (const scene of await lireScenesPassees(aujourdhui)) {
    const annee = Number(scene.date.slice(0, 4));
    parAnnee.set(annee, (parAnnee.get(annee) ?? 0) + 1);
  }
  return [...parAnnee.entries()]
    .map(([annee, nombre]) => ({ annee, nombre }))
    .sort((a, b) => b.annee - a.annee);
}

/**
 * TOUTES les scènes passées, la plus récente d'abord — la matière commune de
 * l'archive (`getAnneesArchive`) et de son aperçu (`getApercuPasse`).
 *
 * UNE SEULE LECTURE, DONC UN SEUL VERDICT SUR « PASSÉ ». C'est ce qui rend vrai
 * l'invariant du 18/08 : *l'aperçu voit exactement ce que l'archive compte*.
 * Tant que les deux posaient leur propre requête et appliquaient leur propre
 * règle, l'invariant tenait par coïncidence — et c'est précisément en divergeant
 * qu'ils ont fait annoncer à la page une carte qu'elle ne montrait pas.
 *
 * SANS PLAFOND, et ce n'est pas un oubli : « mémoire complète, aucun plafond
 * silencieux » est une décision produit du 16/08. Le `maxPassees` de
 * `separerScenes` (12 par défaut) appartient à l'AFFICHAGE, pas à la lecture —
 * c'est l'appelante qui borne ce qu'elle montre. La garde qui tient cette
 * frontière est `e2e/agenda.spec.ts` (« MÉMOIRE COMPLÈTE ») : le décor porte
 * SEIZE interventions passées, donc un plafond de douze réintroduit ici la fait
 * tomber. Vérifié en le remettant.
 *
 * Le SQL pose un plancher grossier (`o.date < $2`, lexicographique) ; une date
 * imprécise reste « à venir » jusqu'au bout de sa période, et c'est
 * `separerScenes` — déjà écrit, déjà testé — qui tranche et ordonne.
 */
async function lireScenesPassees(aujourdhui: string): Promise<ScenePublique[]> {
  const { rows } = await pool.query(
    `${SELECT_SCENES}
        AND o.date < $2
      ORDER BY o.date DESC, o.id DESC`,
    [TALK_SOURCE_TREMPLIN, aujourdhui],
  );
  return separerScenes((rows as SceneRow[]).map(mapScene), aujourdhui, {
    maxPassees: Number.POSITIVE_INFINITY,
  }).passees;
}

/**
 * L'APERÇU DU PASSÉ de `/agenda` : les dernières interventions portées, la plus
 * récente d'abord, plafonnées.
 *
 * POURQUOI CE N'EST PAS `getScenesRecentes` (juste en dessous). Le fil de
 * l'espace connecté exige une date EXACTE — un fil chronologique n'a pas de jour
 * où ranger « courant 2026 ». L'agenda, lui, COMPTE ces dates dans son archive
 * (`getAnneesArchive`, qui juge sur la fin de période) et les AFFICHE sur
 * `/agenda/[annee]`. L'aperçu avait emprunté la fonction du fil : la page
 * annonçait donc « 2 interventions depuis 2025. Voici la plus récente. »
 * au-dessus de RIEN, ses deux dates passées étant au mois près (constat de prod
 * du 18/08). Deux surfaces, deux règles : chacune a sa fonction.
 *
 * L'INVARIANT à garder : cet aperçu voit exactement ce que l'archive compte. Il
 * ne tient plus par coïncidence — les deux lisent `lireScenesPassees`, donc il
 * n'y a plus qu'un verdict sur « passé ». Ne restait ici que la BORNE
 * d'affichage, et c'est bien la seule chose qui distingue l'aperçu de l'archive.
 */
export async function getApercuPasse(
  limite: number,
  aujourdhui: string,
): Promise<ScenePublique[]> {
  return (await lireScenesPassees(aujourdhui)).slice(0, limite);
}

/**
 * Les scènes que la communauté VIENT DE FAIRE — la future carte « sur scène »
 * du fil connecté (conception v2 : docs/conception-espace-fil-navigation.md,
 * lot N2, seul consommateur prévu) : même périmètre public que l'agenda, plus
 * deux conditions propres au fil — strictement PASSÉES (le futur appartient à
 * « À venir » et à /agenda) et à date EXACTE (une annonce « courant 2026 » n'a
 * pas de jour où se ranger dans un fil). La plus récente d'abord, plafond en
 * SQL : le fil demande peu, la table peut être grande.
 *
 * Une fiche retirée disparaît du fil, rétroactivement : le filtre
 * `status = 'publie'` du périmètre partagé s'applique ici comme ailleurs.
 */
export async function getScenesRecentes(
  limite: number,
  aujourdhui: string,
): Promise<ScenePublique[]> {
  const { rows } = await pool.query(
    `${SCENES_COLONNES}
       ${SCENES_FROM}
      WHERE ${scenesVisiblesWhere({ tremplin: "$1", jour: "$2" })}
      ORDER BY o.date DESC, o.id DESC
      LIMIT $3`,
    [TALK_SOURCE_TREMPLIN, aujourdhui, limite],
  );
  return (rows as SceneRow[]).map(mapScene);
}

/** Clé de tranche d'une date : « 2026-11-19 » → « 2026-11 » ; « 2026 » reste
 * « 2026 » (une année sans mois est sa propre tranche). */
function clePeriode(date: string): string {
  return date.length >= 7 ? date.slice(0, 7) : date;
}

/**
 * Coupe l'agenda en deux : ce qui vient (au plus tôt d'abord, c'est l'essentiel
 * d'un agenda) et ce qui a eu lieu (au plus récent d'abord, plafonné — la
 * vitrine montre une communauté vivante, elle ne déroule pas ses archives).
 *
 * Une date imprécise reste du côté « à venir » jusqu'à la fin de sa période
 * (`estPasseTalkDate`), et se RANGE à cette fin de période : « courant 2026 »
 * veut dire « quelque part dans l'année », pas le 1ᵉʳ janvier — un tri sur le
 * texte brut la mettait en tête de l'agenda, soit l'inverse de ce qu'elle dit.
 */
export function separerScenes(
  scenes: readonly ScenePublique[],
  aujourdhui: string,
  { maxPassees = 12 }: { maxPassees?: number } = {},
): { aVenir: ScenePublique[]; passees: ScenePublique[] } {
  const aVenir: ScenePublique[] = [];
  const passees: ScenePublique[] = [];
  for (const s of scenes) {
    (estPasseTalkDate(s.date, aujourdhui) ? passees : aVenir).push(s);
  }
  const rang = (s: ScenePublique) => finDePeriodeTalk(s.date);
  // Départage à fin ÉGALE : « décembre 2026 » et « courant 2026 » finissent
  // tous deux le 31/12 — sans ce critère, l'année vague pouvait s'intercaler
  // entre deux dates de décembre et couper la tranche en deux (en-tête « décembre »
  // dupliqué, clés React et ids DOM en double). La clé la plus PRÉCISE d'abord.
  const precision = (a: ScenePublique, b: ScenePublique) =>
    clePeriode(b.date).localeCompare(clePeriode(a.date));
  // Dernier départage, à date ET précision égales : le NOM, pas l'id de ligne
  // en base — un détail d'implémentation n'a rien à faire dans un ordre
  // d'affichage, et l'alphabet reste lisible même quand on l'explique.
  const alpha = (a: ScenePublique, b: ScenePublique) =>
    a.speakeuseNom.localeCompare(b.speakeuseNom);
  aVenir.sort(
    (a, b) => rang(a).localeCompare(rang(b)) || precision(a, b) || alpha(a, b),
  );
  passees.sort(
    (a, b) => rang(b).localeCompare(rang(a)) || precision(a, b) || alpha(a, b),
  );
  return { aVenir, passees: passees.slice(0, maxPassees) };
}

/**
 * Date d'une intervention telle qu'on la lit dans un agenda. Une année seule
 * devient « courant 2026 » : sur une carte isolée (extrait de la home), « 2026 »
 * laisserait croire à une date perdue, alors que c'est une annonce imprécise.
 * Sert AUSSI d'en-tête de tranche — même clé, même libellé, aucune divergence.
 */
export function libelleDateScene(date: string): string {
  return /^\d{4}$/.test(date) ? `courant ${date}` : formatTalkDate(date);
}

/**
 * Date d'une intervention rangée SOUS une tranche de période : la tranche dit
 * déjà le mois et l'année, la carte n'ajoute que le jour (« jeudi 3 »). Sans ça,
 * « SEPTEMBRE 2026 » surmontait des cartes répétant « 3 septembre 2026 ».
 *
 * `null` pour une annonce imprécise : la tranche EST déjà son libellé complet
 * (« octobre 2026 », « courant 2026 »), la répéter n'apprendrait rien.
 */
export function libelleJourScene(date: string): string | null {
  if (!isExactTalkDate(date)) return null;
  return formatDateFr(date, { weekday: "long", day: "numeric" });
}

/** Une tranche d'agenda : son en-tête (« novembre 2026 ») et ses interventions. */
export interface TrancheAgenda {
  /** Clé stable : « 2026-11 », ou « 2026 » pour une année sans mois. */
  cle: string;
  libelle: string;
  scenes: ScenePublique[];
}

/**
 * Regroupe des interventions DÉJÀ TRIÉES en tranches de période, façon
 * calendrier — via le groupeur partagé du projet (`grouperPar`). Une date sans
 * mois (« courant 2026 ») forme sa propre tranche : elle n'appartient à aucun
 * mois, et l'inventer serait mentir sur l'annonce.
 */
export function grouperScenesParPeriode(
  scenes: readonly ScenePublique[],
): TrancheAgenda[] {
  return grouperPar(scenes, (s) => clePeriode(s.date)).map((t) => ({
    cle: t.cle,
    libelle: libelleDateScene(t.cle),
    scenes: t.items,
  }));
}

/** Jour de calendrier depuis l'époque Unix (UTC) — une vraie date, jamais une
 * comparaison de caractères (qui saute au passage 09 → 10 ou de mois). */
function joursDepuisEpoque(date: string): number {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 86_400_000);
}

/**
 * Décalage circulaire d'un groupe daté, pour un jour donné : stable toute la
 * journée (même requête, même résultat), avance d'un cran chaque jour civil.
 * Le déphasage par la date du groupe (`cle`) évite que deux groupes-frontières
 * tournent en phase si cette fonction sert un jour à plusieurs extraits.
 */
function decalageRotation(aujourdhui: string, cle: string, taille: number): number {
  return (joursDepuisEpoque(aujourdhui) + joursDepuisEpoque(cle)) % taille;
}

/**
 * Un extrait borné de l'agenda (la home, qui n'en montre que quelques-unes) —
 * jamais au détriment de la chronologie : une tranche de date qui rentre
 * entière dans les places restantes n'est JAMAIS réordonnée. Seule la tranche
 * FRONTIÈRE (plus de speakeuses ce jour-là que de places restantes) tourne,
 * d'un jour civil sur l'autre, pour que le départage alphabétique de
 * `separerScenes` ne fige pas toujours les mêmes noms en tête d'un extrait
 * tronqué — sur plusieurs jours, chacune passe devant à son tour.
 */
export function prochainesScenesExtrait(
  aVenir: readonly ScenePublique[],
  aujourdhui: string,
  limite = 3,
): ScenePublique[] {
  if (aVenir.length <= limite) return [...aVenir];
  const resultat: ScenePublique[] = [];
  for (const { cle, items } of grouperPar(aVenir, (s) => s.date)) {
    const restant = limite - resultat.length;
    if (restant <= 0) break;
    if (items.length <= restant) {
      resultat.push(...items);
      continue;
    }
    const decalage = decalageRotation(aujourdhui, cle, items.length);
    const tournee = [...items.slice(decalage), ...items.slice(0, decalage)];
    resultat.push(...tournee.slice(0, restant));
    break;
  }
  return resultat;
}
