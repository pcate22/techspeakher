import { pool } from "@/lib/db";
import { aujourdhuiParis } from "@/lib/tremplin-statut";
import { hhmm } from "@/lib/tremplin-ateliers";

/**
 * « Mes prochains ateliers » (lot C2) : les ateliers À VENIR d'un compte, qu'il
 * y PARTICIPE (membre via son inscription) ou qu'il les ANIME (coach), fusionnés
 * dans une seule liste triée par proximité. Lecture seule, pour /mon-espace.
 */
export interface ProchainAtelier {
  atelierId: number;
  titre: string;
  /** DATE en chaîne YYYY-MM-DD (type parser global, cf. db.ts). */
  date: string;
  /** Fin de période (activité « à faire entre deux dates »), sinon null. */
  dateFin: string | null;
  heureDebut: string | null;
  heureFin: string | null;
  /** Lieu physique (présentiel), sinon null. */
  lieu: string | null;
  lienVisio: string | null;
  /** `organise` : l'atelier vient du programme des éditions actives (orga). */
  role: "participe" | "anime" | "organise";
  editionId: number;
  editionNom: string;
}

/** Normalisation partagée d'une ligne d'atelier (date en chaîne, heures hh:mm)
 * quel que soit le driver (type parser réel ; pg-mem rend des Date). */
function normaliserProchain(brut: ProchainAtelier): ProchainAtelier {
  const dateIso = (v: unknown): string =>
    v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  return {
    ...brut,
    date: dateIso(brut.date),
    dateFin: brut.dateFin == null ? null : dateIso(brut.dateFin),
    heureDebut: hhmm(brut.heureDebut),
    heureFin: hhmm(brut.heureFin),
  };
}

/**
 * Le PROGRAMME côté orga : tous les ateliers datés encore à venir (fenêtres en
 * cours comprises) des éditions actives — l'orga a le calendrier de ce qu'elle
 * organise, pas seulement de ce qu'elle anime. Libellés et nombres seulement.
 */
export async function getProgrammeOrga(
  aujourdhui: string = aujourdhuiParis(),
  depuis: string = aujourdhui,
): Promise<ProchainAtelier[]> {
  const { rows } = await pool.query(
    `SELECT a.id AS "atelierId", a.titre, a.date, a.date_fin AS "dateFin",
            a.heure_debut AS "heureDebut", a.heure_fin AS "heureFin",
            a.lieu, a.lien_visio AS "lienVisio", 'organise' AS role,
            e.id AS "editionId", e.nom AS "editionNom"
       FROM tremplin_ateliers a
       JOIN tremplin_editions e ON e.id = a.edition_id
      WHERE a.date IS NOT NULL AND ${fenetreSql(1)}
        AND ${archiveSql(2)}
      ORDER BY a.date`,
    [depuis, aujourdhui],
  );
  return (rows as ProchainAtelier[]).map(normaliserProchain);
}

/**
 * Une seule requête (UNION participation + animation). La participation suit
 * l'AUDIENCE de l'atelier, et rien d'autre — les trois branches « participe »
 * sont exclusives entre elles, exactement comme `atelierVisiblePour` :
 * désignée (`selection`), inscrite (`toutes`), ou rattachée à sa phase
 * (`phase`). Sans cette exclusivité, une ligne de PRÉSENCE sur un atelier de
 * phase ferait apparaître la séance dans l'agenda de quelqu'un à qui sa page
 * répondrait « introuvable ». Les ateliers
 * sans date sont exclus (rien à annoncer) — une activité À PÉRIODE reste « à
 * venir » tant que sa FIN n'est pas passée (`COALESCE(date_fin, date)`, lot A :
 * la revue « du 7 au 13 » ne disparaît plus le 8). Si la personne participe ET
 * anime le même atelier, une seule ligne : « anime » l'emporte (c'est son rôle
 * actif ce jour-là).
 *
 * `depuis` borne le PASSÉ : par défaut aujourd'hui (donc « à venir » seulement,
 * ce que veut la home), relâché par l'agenda pour qu'on puisse remonter le fil.
 */
/**
 * FENÊTRE de l'agenda, sur la FIN effective (période sinon date) : miroir de
 * `estPasse` (src/lib/tremplin-statut.ts), borne complémentaire (`>=`/`<`).
 *
 * L'agenda ne regardait QUE devant. Une coach perdait donc toute la phase 1
 * qu'elle avait animée dès le lendemain de la dernière séance — un calendrier
 * qui ne remonte pas n'est pas un calendrier, c'est une liste de tâches. La
 * borne basse est donc un paramètre : la home la cale sur aujourd'hui (« à
 * venir »), l'agenda la relâche pour laisser remonter l'historique.
 */
const fenetreSql = (borne: number) => `COALESCE(a.date_fin, a.date) >= $${borne}`;

/**
 * Une édition ARCHIVÉE n'annonce rien : on l'exclut du futur. Mais son passé
 * s'est bien produit, et c'est justement là que vit l'historique d'une coach —
 * on ne l'efface pas. D'où la règle asymétrique.
 */
const archiveSql = (aujourdhui: number) =>
  `(COALESCE(a.date_fin, a.date) < $${aujourdhui} OR e.statut <> 'archive')`;

export async function getMesProchainsAteliers(
  userId: number,
  aujourdhui: string = aujourdhuiParis(),
  depuis: string = aujourdhui,
): Promise<ProchainAtelier[]> {
  const { rows } = await pool.query(
    `SELECT a.id AS "atelierId", a.titre, a.date, a.date_fin AS "dateFin",
            a.heure_debut AS "heureDebut", a.heure_fin AS "heureFin",
            a.lieu, a.lien_visio AS "lienVisio", 'participe' AS role,
            e.id AS "editionId", e.nom AS "editionNom"
       FROM tremplin_atelier_membres m
       JOIN tremplin_registrations r ON r.id = m.registration_id
       JOIN tremplin_ateliers a ON a.id = m.atelier_id
       JOIN tremplin_editions e ON e.id = a.edition_id
      WHERE r."userId" = $1 AND ${fenetreSql(2)}
        AND ${archiveSql(3)}
        AND a.audience = 'selection'
     UNION ALL
     SELECT a.id, a.titre, a.date, a.date_fin, a.heure_debut, a.heure_fin,
            a.lieu, a.lien_visio, 'participe', e.id, e.nom
       FROM tremplin_registrations r
       JOIN tremplin_ateliers a ON a.edition_id = r.edition_id
       JOIN tremplin_editions e ON e.id = a.edition_id
      WHERE r."userId" = $1 AND ${fenetreSql(2)}
        AND ${archiveSql(3)}
        AND a.audience = 'toutes'
     UNION ALL
     SELECT a.id, a.titre, a.date, a.date_fin, a.heure_debut, a.heure_fin,
            a.lieu, a.lien_visio, 'participe', e.id, e.nom
       FROM tremplin_registrations r
       JOIN tremplin_registration_phases rp ON rp.registration_id = r.id
       JOIN tremplin_ateliers a
         ON a.edition_id = r.edition_id AND a.phase = rp.phase
       JOIN tremplin_editions e ON e.id = a.edition_id
      WHERE r."userId" = $1 AND ${fenetreSql(2)}
        AND ${archiveSql(3)}
        AND a.audience = 'phase'
     UNION ALL
     SELECT a.id, a.titre, a.date, a.date_fin, a.heure_debut, a.heure_fin,
            a.lieu, a.lien_visio, 'anime', e.id, e.nom
       FROM tremplin_atelier_coachs c
       JOIN tremplin_ateliers a ON a.id = c.atelier_id
       JOIN tremplin_editions e ON e.id = a.edition_id
      WHERE c.user_id = $1 AND ${fenetreSql(2)}
        AND ${archiveSql(3)}`,
    [userId, depuis, aujourdhui],
  );

  // Dédoublonnage (« anime » gagne) et tri en mémoire : quelques lignes max.
  const parAtelier = new Map<number, ProchainAtelier>();
  for (const brut of rows as ProchainAtelier[]) {
    const r = normaliserProchain(brut);
    const deja = parAtelier.get(r.atelierId);
    if (!deja || r.role === "anime") parAtelier.set(r.atelierId, r);
  }
  return [...parAtelier.values()].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      String(a.heureDebut ?? "").localeCompare(String(b.heureDebut ?? "")),
  );
}
