// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * VRAIS tests d'intégration BDD des LECTURES aujourd'hui couvertes seulement par
 * des tests à pool mocké : on exécute le SQL réel contre un vrai Postgres
 * (PGlite), en chargeant `db/schema.sql`.
 *
 * Portée volontairement complémentaire de talks-db.integration.test.ts (flux
 * d'écriture des talks) et de cfp-suggestions-db.integration.test.ts (upsert,
 * acceptation, rafraîchissement). Ici on cible les fonctions de LECTURE :
 *   - talks : getTalkById (ownership), getOccurrenceSuggestions (registre du
 *     formulaire d'occurrence + auto-complétion des lieux) ;
 *   - cfp-suggestions : getActiveCfpEvents, getMatchableProfiles,
 *     getSuggestionEmailTargets (filtres de consentement et de joignabilité).
 *
 * Chaque filtre est vérifié par un CAS NÉGATIF : la ligne qui NE doit PAS
 * remonter (talk d'un autre profil, événement inactif, profil en « aucun »,
 * user sans e-mail) est insérée, puis on vérifie son exclusion.
 *
 * PGlite et non pg-mem (comme cfp-suggestions-db.integration.test.ts) : ces
 * lectures utilisent des constructions que pg-mem ne restitue pas fidèlement —
 * `to_char(date_debut, 'YYYY-MM-DD')` dans getActiveCfpEvents et le `= ANY($1)`
 * sur tableau d'entiers de getSuggestionEmailTargets. PGlite est un moteur
 * Postgres réel, comme dans db-schema-drift.test.ts.
 */

const h = vi.hoisted(() => {
  const holder: { db: import("@electric-sql/pglite").PGlite | null } = { db: null };
  const pool = {
    query: async (text: string, params?: unknown[]) => {
      const r = await holder.db!.query(text, params);
      return { ...r, rowCount: (r as { affectedRows?: number }).affectedRows };
    },
  };
  return { holder, pool };
});

vi.mock("@/lib/db", () => ({ pool: h.pool }));

import {
  getTalkById,
  addTalk,
  addOccurrence,
  getTalksByProfileId,
  getOccurrenceSuggestions,
} from "@/lib/talks";
import {
  getActiveCfpEvents,
  getMatchableProfiles,
  getSuggestionEmailTargets,
} from "@/lib/cfp-suggestions";
import { ensureProfileId } from "@/lib/profiles";

beforeAll(async () => {
  h.holder.db = new PGlite();
  await h.holder.db.exec(fs.readFileSync("db/schema.sql", "utf8"));
}, 60_000);
beforeEach(async () => {
  await h.holder.db!.exec(
    "TRUNCATE talk_suggestions, talk_occurrences, speaker_talks, conference_editions, conferences, cfp_events, speaker_profiles, users RESTART IDENTITY CASCADE",
  );
  vi.clearAllMocks();
});

async function newUser(email: string | null, name = "Clara"): Promise<number> {
  const { rows } = await h.pool.query(
    "INSERT INTO users(name, email) VALUES($1, $2) RETURNING id",
    [name, email],
  );
  return (rows[0] as { id: number }).id;
}

/** Identité d'un talk (le reste vit dans les occurrences), surchargeable. */
function identite(over: Partial<Parameters<typeof addTalk>[1]> = {}) {
  return { titre: "Mon talk", type: "Conférence", description: null, ...over };
}

/** Une occurrence (conférence datée d'un talk), surchargeable champ par champ. */
function occ(over: Partial<Parameters<typeof addOccurrence>[2]> = {}) {
  return {
    conferenceId: null,
    editionId: null,
    conference: "DevFest",
    ville: "Toulouse",
    codeInsee: null,
    region: null,
    pays: "France",
    date: "2026-11-19",
    lienConf: null,
    lienSlides: null,
    lienVideo: null,
    lienFeedback: null,
    ...over,
  };
}

/** Crée un talk (identité) et lui rattache une occurrence. Renvoie l'id du talk. */
async function addTalkAvecOccurrence(
  profileId: number,
  over: Partial<Parameters<typeof addOccurrence>[2]> = {},
): Promise<number> {
  const talkId = await addTalk(profileId, identite());
  await addOccurrence(talkId, profileId, occ(over));
  return talkId;
}

describe("getTalkById (ownership)", () => {
  it("le bon profil lit son talk (et son occurrence) ; un AUTRE profil obtient null", async () => {
    const mien = await ensureProfileId(await newUser("moi@ex.fr"));
    const autre = await ensureProfileId(await newUser("autre@ex.fr"));
    const talkId = await addTalk(mien, identite({ titre: "Talk à moi" }));
    await addOccurrence(talkId, mien, occ());
    const [t] = await getTalksByProfileId(mien);

    // Le propriétaire relit bien son talk, occurrence comprise.
    const lu = await getTalkById(t.id, mien);
    expect(lu).not.toBeNull();
    expect(lu!.titre).toBe("Talk à moi");
    expect(lu!.occurrences).toHaveLength(1);
    expect(lu!.occurrences[0].conference).toBe("DevFest");

    // CAS NÉGATIF : un autre profil ne voit pas le talk (ownership en SQL).
    expect(await getTalkById(t.id, autre)).toBeNull();
  });

  it("renvoie null pour un id de talk inexistant", async () => {
    const mien = await ensureProfileId(await newUser("seule@ex.fr"));
    expect(await getTalkById(999999, mien)).toBeNull();
  });
});

describe("getOccurrenceSuggestions (auto-complétion des lieux)", () => {
  it("renvoie villes/pays DISTINCT des occurrences, triés, en excluant NULL et chaînes vides", async () => {
    const p1 = await ensureProfileId(await newUser("s1@ex.fr"));
    const p2 = await ensureProfileId(await newUser("s2@ex.fr"));

    // Doublons (DISTINCT) et ordre volontairement mélangé (ORDER BY v).
    await addTalkAvecOccurrence(p1, { ville: "Montpellier", pays: "France" });
    await addTalkAvecOccurrence(p1, { ville: "Toulouse", pays: "France" });
    await addTalkAvecOccurrence(p2, { ville: "Toulouse", pays: "Belgique" });

    // CAS NÉGATIFS : une occurrence sans ville (NULL) et une avec chaîne vide
    // ne doivent contribuer à aucune liste.
    await addTalkAvecOccurrence(p2, { conference: null, ville: "", pays: null });
    await addTalkAvecOccurrence(p2, { conference: "", ville: null, pays: "" });

    // CAS NÉGATIF : les colonnes legacy de speaker_talks ne sont PLUS lues (la
    // source de vérité des lieux est talk_occurrences).
    await h.pool.query(
      `INSERT INTO speaker_talks (speaker_profile_id, titre, type, ville, pays)
       VALUES ($1, 'Legacy', 'Conférence', 'Lyon', 'Suisse')`,
      [p2],
    );

    const { villes, pays } = await getOccurrenceSuggestions();
    expect(villes).toEqual(["Montpellier", "Toulouse"]);
    expect(pays).toEqual(["Belgique", "France"]);
  });

  it("renvoie registre et listes vides quand aucune valeur exploitable", async () => {
    const p = await ensureProfileId(await newUser("vide@ex.fr"));
    await addTalkAvecOccurrence(p, { conference: null, ville: "", pays: null });
    const s = await getOccurrenceSuggestions();
    expect(s).toEqual({ registre: [], villes: [], pays: [] });
  });
});

/**
 * Insère un événement moissonnable de la référence (conference + edition,
 * migration 027), actif par défaut. Renvoie l'id d'ÉDITION.
 */
async function newEvent(
  nom: string,
  over: {
    actif?: boolean;
    endpoint?: string;
    dateDebut?: string | null;
    annee?: number | null;
    villeEdition?: string | null;
  } = {},
): Promise<number> {
  const conf = await h.pool.query(
    `INSERT INTO conferences(slug, nom, ville, pays)
     VALUES(lower($1), $1, 'Toulouse', 'France')
     ON CONFLICT (slug) DO UPDATE SET nom = EXCLUDED.nom
     RETURNING id`,
    [nom],
  );
  const { rows } = await h.pool.query(
    `INSERT INTO conference_editions
       (conference_id, annee, source, endpoint, url, ville, pays, date_debut, actif)
     VALUES($1, $2, 'sessionize', $3, 'https://ex.example', $4, 'France', $5, $6)
     RETURNING id`,
    [
      (conf.rows[0] as { id: number }).id,
      over.annee ?? null,
      over.endpoint ?? nom,
      over.villeEdition === undefined ? "Toulouse" : over.villeEdition,
      over.dateDebut ?? null,
      over.actif ?? true,
    ],
  );
  return (rows[0] as { id: number }).id;
}

describe("getActiveCfpEvents", () => {
  it("ne renvoie que les événements actifs (exclut les inactifs), triés par id", async () => {
    const actif1 = await newEvent("DevFest", { dateDebut: "2026-11-19" });
    // CAS NÉGATIF : un événement inactif ne doit jamais remonter.
    await newEvent("Ancien", { actif: false });
    const actif2 = await newEvent("Sunny Tech");

    const events = await getActiveCfpEvents();
    expect(events.map((e) => e.id)).toEqual([actif1, actif2]);
    expect(events.map((e) => e.nom)).toEqual(["DevFest", "Sunny Tech"]);
    // date_debut renvoyée formatée YYYY-MM-DD, null si absente.
    expect(events[0].dateDebut).toBe("2026-11-19");
    expect(events[1].dateDebut).toBeNull();
  });

  it("recompose le libellé avec l'année et applique le fallback ville édition → conf", async () => {
    const avecAnnee = await newEvent("DevFest Toulouse", {
      annee: 2026,
      endpoint: "ep-annee",
      villeEdition: null, // pas de ville d'édition → celle de la conf (Toulouse)
    });

    const events = await getActiveCfpEvents();
    const e = events.find((ev) => ev.id === avecAnnee)!;
    // Libellé = conf.nom + année : identique à l'ex-cfp_events.nom (les
    // libellés déjà écrits dans les occurrences ne bougent pas).
    expect(e.nom).toBe("DevFest Toulouse 2026");
    expect(e.ville).toBe("Toulouse");
  });
});

/** Positionne le mode de consentement au moissonnage d'un profil. */
async function setSyncMode(profileId: number, mode: string): Promise<void> {
  await h.pool.query("UPDATE speaker_profiles SET cfp_sync_mode = $2 WHERE id = $1", [
    profileId,
    mode,
  ]);
}

describe("getMatchableProfiles", () => {
  it("respecte le consentement : exclut cfp_sync_mode = 'aucun'", async () => {
    // 'suggestions' (défaut) et 'auto' consentent au matching.
    const suggest = await ensureProfileId(await newUser("sug@ex.fr", "Sug"));
    const auto = await ensureProfileId(await newUser("auto@ex.fr", "Auto"));
    await setSyncMode(auto, "auto");
    await h.pool.query("UPDATE speaker_profiles SET linkedin = $2 WHERE id = $1", [
      suggest,
      "https://linkedin.com/in/sug",
    ]);

    // CAS NÉGATIF : un profil en « aucun » n'est pas candidat au matching.
    const optout = await ensureProfileId(await newUser("no@ex.fr", "NoMatch"));
    await setSyncMode(optout, "aucun");

    const profiles = await getMatchableProfiles();
    expect(profiles.map((p) => p.id).sort((a, b) => a - b)).toEqual(
      [suggest, auto].sort((a, b) => a - b),
    );
    expect(profiles.some((p) => p.id === optout)).toBe(false);
    const sug = profiles.find((p) => p.id === suggest)!;
    expect(sug).toMatchObject({ name: "Sug", linkedin: "https://linkedin.com/in/sug" });
  });
});

describe("getSuggestionEmailTargets", () => {
  it("renvoie e-mail + nom, en excluant 'aucun' ET les users sans e-mail", async () => {
    const joignable = await ensureProfileId(await newUser("cible@ex.fr", "Cible"));

    // CAS NÉGATIF 1 : profil en « aucun » (consentement retiré).
    const optout = await ensureProfileId(await newUser("optout@ex.fr", "Optout"));
    await setSyncMode(optout, "aucun");

    // CAS NÉGATIF 2 : user sans e-mail (non joignable).
    const sansEmail = await ensureProfileId(await newUser(null, "SansEmail"));

    const ids = [joignable, optout, sansEmail];
    const targets = await getSuggestionEmailTargets(ids);

    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      id: joignable,
      email: "cible@ex.fr",
      name: "Cible",
    });
    expect(targets.some((t) => t.id === optout)).toBe(false);
    expect(targets.some((t) => t.id === sansEmail)).toBe(false);
  });

  it("renvoie [] pour une liste d'ids vide (court-circuit)", async () => {
    expect(await getSuggestionEmailTargets([])).toEqual([]);
  });
});

describe("getOccurrenceSuggestions — le registre (conf → éditions récentes)", () => {
  it("regroupe les éditions par conférence (libellés édition et meetup), borné à 18 mois ; une conf sans édition reste proposée", async () => {
    const p = await ensureProfileId(await newUser("union@ex.fr"));
    await addTalkAvecOccurrence(p, { ville: "Toulouse" });

    // Édition à venir (proposée, ville d'édition absente → fallback conf) +
    // meetup daté (proposé) + édition trop ancienne (exclue : borne 18 mois).
    const dansUnMois = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    await newEvent("Sunny Tech", {
      annee: 2026,
      endpoint: "sunny26x",
      dateDebut: dansUnMois,
      villeEdition: null,
    });
    await h.pool.query(
      `INSERT INTO conferences (slug, nom, type, ville, pays) VALUES ('gdg-toulouse', 'GDG Toulouse', 'asso', 'Toulouse', 'France')`,
    );
    await h.pool.query(
      `INSERT INTO conference_editions (conference_id, type, nom, date_debut, lieu, meetup_id)
       SELECT id, 'meetup', 'Apéro Web', $1::date, 'La Cantine', 'meetup-1' FROM conferences WHERE slug = 'gdg-toulouse'`,
      [dansUnMois],
    );
    await newEvent("Vieille Conf", { annee: 2020, endpoint: "old20xx", dateDebut: "2020-01-15" });

    const s = await getOccurrenceSuggestions();

    // Le registre liste TOUTES les conférences (triées par nom) : plus de
    // datalist de noms libres, une conf manquante passe par la demande d'ajout.
    expect(s.registre.map((c) => c.nom)).toEqual(["GDG Toulouse", "Sunny Tech", "Vieille Conf"]);

    // Éditions regroupées SOUS leur conférence, avec le libellé exact.
    const sunny = s.registre.find((c) => c.nom === "Sunny Tech")!;
    expect(sunny.editions).toHaveLength(1);
    expect(sunny.editions[0].libelle).toBe("Sunny Tech 2026");
    expect(sunny.editions[0].conferenceId).toBe(sunny.id);
    expect(sunny.editions[0].editionId).toBeGreaterThan(0);
    // Pré-remplissage : ville de l'édition absente → fallback sur celle de la conf.
    expect(sunny.editions[0].ville).toBe("Toulouse");

    const gdg = s.registre.find((c) => c.nom === "GDG Toulouse")!;
    const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
      new Date(`${dansUnMois}T00:00:00`),
    );
    expect(gdg.editions.map((e) => e.libelle)).toEqual([`GDG Toulouse · Apéro Web · ${dateFr}`]);

    // Bornage 18 mois : l'édition 2020 est exclue, MAIS sa conf reste proposée
    // (une conf sans édition récente apparaît avec editions = []).
    const vieille = s.registre.find((c) => c.nom === "Vieille Conf")!;
    expect(vieille.editions).toEqual([]);

    // Auto-complétion des lieux : les saisies passées (occurrences) remontent.
    expect(s.villes).toContain("Toulouse");
  });
});
