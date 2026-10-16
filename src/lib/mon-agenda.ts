import { pool } from "@/lib/db";
import { aujourdhuiParis, estPasse } from "@/lib/tremplin-statut";
import { isExactTalkDate } from "@/lib/talk-date";
import { grouperPar } from "@/lib/groupement";
import {
  getMesProchainsAteliers,
  getProgrammeOrga,
  type ProchainAtelier,
} from "@/lib/mes-ateliers";

/**
 * MON AGENDA : l'échéancier personnel d'un compte, toutes casquettes
 * confondues — ateliers Tremplin (participation, animation, et pour une orga
 * le programme des éditions actives) ET talks à venir de la speakeuse. Une
 * speakeuse hors Tremplin a donc un agenda qui vit, avec ses conférences.
 *
 * Une carte d'agenda se tape, où qu'elle s'affiche (home, onglet Agenda) :
 * `hrefEcheance` donne l'écran où l'on agit — l'espace de l'édition, l'espace
 * coaching, la fiche atelier admin, ou la page du talk.
 */

/** Un talk à venir : une OCCURRENCE datée (précision jour) d'un de ses talks. */
export interface ProchainTalk {
  occurrenceId: number;
  talkId: number;
  titre: string;
  /** Date EXACTE (YYYY-MM-DD) : les dates imprécises restent hors agenda. */
  date: string;
  conference: string | null;
  ville: string | null;
  lienConf: string | null;
}

export type EcheanceAgenda =
  | ({ genre: "atelier" } & ProchainAtelier)
  | ({ genre: "talk" } & ProchainTalk);

/** Clé React stable d'une échéance (les ids d'atelier et d'occurrence se recoupent). */
export function cleEcheance(e: EcheanceAgenda): string {
  return e.genre === "atelier" ? `a${e.atelierId}` : `t${e.occurrenceId}`;
}

/**
 * PAGE d'un atelier, selon la casquette — convention UNIQUE, partagée par les
 * cartes d'agenda et par les listes de chaque espace.
 *
 * Les trois rôles ont désormais leur page de détail, comme l'orga en avait déjà
 * une. Auparavant, participante et coach n'avaient qu'une rangée dans une longue
 * page : la carte d'agenda pointait une ANCRE, on atterrissait au milieu d'une
 * liste de quinze et il fallait se repérer. Une carte mène à une page.
 */
export function hrefAtelier(
  role: ProchainAtelier["role"],
  editionId: number,
  atelierId: number,
): string {
  if (role === "anime") return `/mon-espace/coaching/${editionId}/ateliers/${atelierId}`;
  if (role === "organise") return `/admin/tremplins/${editionId}/ateliers/${atelierId}`;
  return `/mon-espace/tremplin/${editionId}/ateliers/${atelierId}`;
}

/** Le détail d'une échéance : l'écran où l'on agit, selon la casquette.
 * (Consommé par `EcheanceCard` — la table des routes vit près de l'UI.) */
export function hrefEcheance(e: EcheanceAgenda): string {
  if (e.genre === "talk") return `/mon-espace/talks/${e.talkId}`;
  return hrefAtelier(e.role, e.editionId, e.atelierId);
}

/**
 * Occurrences futures des talks du compte (jointes par SON profil : impossible
 * de lire celles d'une autre personne). La date des talks est à précision
 * variable (« 2026 », « 2026-11 », « 2026-11-19 ») : seule une date EXACTE va
 * à l'agenda (`isExactTalkDate` — la comparaison texte `>=` reste correcte sur
 * ce format triable). L'e-mail et le reste du profil ne sont pas sélectionnés.
 */
export async function getMesProchainsTalks(
  userId: number,
  aujourdhui: string = aujourdhuiParis(),
  depuis: string = aujourdhui,
): Promise<ProchainTalk[]> {
  const { rows } = await pool.query(
    `SELECT o.id AS "occurrenceId", t.id AS "talkId", t.titre, o.date,
            o.conference, o.ville, o.lien_conf AS "lienConf"
       FROM talk_occurrences o
       JOIN speaker_talks t ON t.id = o.talk_id
       JOIN speaker_profiles sp ON sp.id = o.speaker_profile_id
      WHERE sp."userId" = $1 AND o.date >= $2
      ORDER BY o.date, o.id`,
    [userId, depuis],
  );
  return (rows as ProchainTalk[]).filter((t) => isExactTalkDate(t.date));
}

/**
 * L'agenda fusionné, trié par proximité (date, puis heure — les talks, sans
 * heure, ouvrent leur journée). `orga: true` ajoute le programme des éditions
 * actives (rôle `organise`) ; un atelier déjà présent à titre personnel
 * (participation, animation) garde sa casquette personnelle.
 *
 * `avecPasse` ouvre la fenêtre vers l'arrière : l'agenda est un CALENDRIER, on
 * doit pouvoir y remonter (une coach retrouve la phase 1 qu'elle a animée). La
 * home garde le défaut « à venir » — c'est une carte « ce qui t'attend », pas un
 * calendrier. Aucune borne basse : les lignes se comptent en dizaines par
 * personne, et tronquer l'historique n'apporterait rien à ce volume.
 */
export async function getMonAgenda(
  userId: number,
  {
    orga = false,
    aujourdhui = aujourdhuiParis(),
    avecPasse = false,
  }: { orga?: boolean; aujourdhui?: string; avecPasse?: boolean } = {},
): Promise<EcheanceAgenda[]> {
  // `depuis` = la borne basse. Sans passé, elle vaut aujourd'hui ; avec, une
  // date antérieure à toute donnée du projet (le Tremplin est né en 2025).
  const depuis = avecPasse ? "1970-01-01" : aujourdhui;
  const [ateliers, talks, programme] = await Promise.all([
    getMesProchainsAteliers(userId, aujourdhui, depuis),
    getMesProchainsTalks(userId, aujourdhui, depuis),
    orga ? getProgrammeOrga(aujourdhui, depuis) : Promise.resolve([]),
  ]);
  const persos = new Set(ateliers.map((a) => a.atelierId));
  const bruts = [
    ...ateliers.map((a) => ({ genre: "atelier" as const, ...a })),
    ...programme
      .filter((a) => !persos.has(a.atelierId))
      .map((a) => ({ genre: "atelier" as const, ...a })),
    ...talks.map((t) => ({ genre: "talk" as const, ...t })),
  ];
  return bruts.sort(
      (x, y) =>
        x.date.localeCompare(y.date) ||
        String((x.genre === "atelier" && x.heureDebut) || "").localeCompare(
          String((y.genre === "atelier" && y.heureDebut) || ""),
        ),
    );
}

/**
 * Coupe l'agenda en deux : le passé (fil remontant) et l'à-venir. Une activité
 * à PÉRIODE reste au présent tant que sa fin n'est pas passée (`estPasse`) —
 * et comme la liste est triée par DÉBUT, le passé n'est PAS un préfixe : deux
 * filtres complémentaires, jamais une coupure par index (même règle que
 * `agendaAteliers` côté orga).
 */
export function separerEcheances(
  items: readonly EcheanceAgenda[],
  aujourdhui: string,
): { passees: EcheanceAgenda[]; aVenir: EcheanceAgenda[] } {
  const passee = (e: EcheanceAgenda) =>
    estPasse({ date: e.date, dateFin: e.genre === "atelier" ? e.dateFin : null }, aujourdhui);
  return {
    passees: items.filter(passee),
    aVenir: items.filter((e) => !passee(e)),
  };
}

/** Un jour d'agenda : sa date (YYYY-MM-DD) et ses échéances. */
export interface JourAgenda {
  date: string;
  echeances: EcheanceAgenda[];
}

/** Un mois d'agenda : sa clé (YYYY-MM) et ses jours, pour l'en-tête collant. */
export interface MoisAgenda {
  mois: string;
  jours: JourAgenda[];
}

/**
 * Regroupe l'agenda façon app calendrier : mois → jours (une activité à
 * période se range sous son jour de DÉBUT ; sa fenêtre reste dite sur la
 * carte). Pur : la liste arrive déjà triée de `getMonAgenda`, ce qui est
 * exactement la condition de `grouperPar` (on ne rassemble que des voisins).
 */
export function grouperParMois(items: EcheanceAgenda[]): MoisAgenda[] {
  return grouperPar(items, (e) => e.date.slice(0, 7)).map((m) => ({
    mois: m.cle,
    jours: grouperPar(m.items, (e) => e.date).map((j) => ({
      date: j.cle,
      echeances: j.items,
    })),
  }));
}

/**
 * Garantit une ligne pour LE JOUR MÊME dans les mois À VENIR, même vide : dans
 * une app calendrier, aujourd'hui est une date du fil, avec son mois au-dessus,
 * pas une frontière entre deux zones (le défaut qui l'a imposé est au registre,
 * `docs/principes-conception-ui.md`, 16/08/2026).
 *
 * Insertion ORDONNÉE, jamais en tête : le premier jour à venir peut être
 * antérieur à aujourd'hui — une activité à période commencée reste au présent
 * tant que sa fin n'est pas passée (`separerEcheances`) et se range sous son
 * jour de début. Pur, et sans effet si le jour existe déjà (il porte alors ses
 * échéances, c'est la même ligne).
 *
 * À n'appeler QUE sur l'à-venir : sur les deux moitiés, la page porterait deux
 * lignes du jour, donc deux `id="aujourdhui"` (la page s'en garde par sa `zone`).
 */
export function avecAujourdhui(mois: MoisAgenda[], aujourdhui: string): MoisAgenda[] {
  if (mois.some((m) => m.jours.some((j) => j.date === aujourdhui))) return mois;
  const cle = aujourdhui.slice(0, 7);
  const jour: JourAgenda = { date: aujourdhui, echeances: [] };
  if (mois.some((m) => m.mois === cle)) {
    return mois.map((m) =>
      m.mois === cle
        ? { ...m, jours: [...m.jours, jour].sort((a, b) => a.date.localeCompare(b.date)) }
        : m,
    );
  }
  const i = mois.findIndex((m) => m.mois > cle);
  const nouveau: MoisAgenda = { mois: cle, jours: [jour] };
  return i === -1 ? [...mois, nouveau] : [...mois.slice(0, i), nouveau, ...mois.slice(i)];
}
