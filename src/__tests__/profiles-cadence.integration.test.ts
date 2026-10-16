import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { schemaForPgMem } from "./schema-pgmem";

/**
 * LA CADENCE CHOISIE PAR LA SPEAKEUSE, éprouvée contre le `db/schema.sql` réel
 * (`pg-mem`). C'est la seule couche où la promesse du réglage se vérifie : elle
 * vit dans des clauses `WHERE`, pas dans des `if` d'écran.
 *
 * Les deux flux sont couverts ensemble parce qu'ils font une seule promesse :
 * « à quelle fréquence j'accepte d'être rappelée ». Un test qui n'en garderait
 * qu'un laisserait l'autre écrire dans le dos de la personne.
 */

const h = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { newDb } = require("pg-mem");
  const mem = newDb();
  const pg = mem.adapters.createPg();
  const pool = new pg.Pool();
  return { mem, pool };
});

vi.mock("@/lib/db", () => ({ pool: h.pool }));

import {
  getProfilesEnSommeil,
  getProfilesEnSommeilBrefs,
  getFicheARelancer,
  getProfilesDueForReminder,
  getRappelCadence,
  setRappelCadence,
} from "@/lib/profiles";
import type { CadenceRappel } from "@/lib/cadence-rappels";

let backup: { restore: () => void };

beforeAll(() => {
  h.mem.public.none(schemaForPgMem());
  backup = h.mem.backup();
});

beforeEach(() => backup.restore());

const ilYA = (jours: number) => new Date(Date.now() - jours * 86_400_000);

/** Un compte + sa fiche : ancienneté, dernier rappel, et cadence choisie. */
async function fiche(opts: {
  nom: string;
  jours: number;
  relanceeIlYA?: number;
  cadence?: CadenceRappel | null;
  status?: string;
}): Promise<{ id: number; userId: number }> {
  const { rows: u } = await h.pool.query(
    `INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id`,
    [opts.nom, `${opts.nom.toLowerCase()}@test.fr`],
  );
  const userId = u[0].id as number;
  const { rows } = await h.pool.query(
    `INSERT INTO speaker_profiles ("userId", status, updated_at, last_reminder_at, rappel_cadence)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      userId,
      opts.status ?? "brouillon",
      ilYA(opts.jours),
      opts.relanceeIlYA === undefined ? null : ilYA(opts.relanceeIlYA),
      opts.cadence ?? null,
    ],
  );
  return { id: rows[0].id as number, userId };
}

/** Défauts de l'équipe : 30 j pour la relance de brouillon, 180 j pour le rappel. */
const BROUILLON = 30;
const PUBLIEE = 180;

describe("« Aucun » coupe vraiment", () => {
  it("retire la fiche du lot de relance", async () => {
    await fiche({ nom: "Refuse", jours: 200, cadence: "aucun" });
    await fiche({ nom: "Ouverte", jours: 200, cadence: null });
    const liste = await getProfilesEnSommeil(BROUILLON);
    expect(liste.map((f) => f.profile.name)).toEqual(["Ouverte"]);
  });

  it("ferme AUSSI le geste manuel de l'orga depuis la fiche", async () => {
    // Le point le plus important du réglage : un choix que l'équipe peut
    // contourner d'un clic vaut moins que pas de réglage du tout.
    const { id } = await fiche({ nom: "Refuse", jours: 200, cadence: "aucun" });
    expect(await getFicheARelancer(id, BROUILLON)).toBeNull();
  });

  it("coupe le rappel de mise à jour d'une fiche publiée", async () => {
    await fiche({ nom: "Refuse", jours: 400, cadence: "aucun", status: "publie" });
    await fiche({ nom: "Ouverte", jours: 400, cadence: null, status: "publie" });
    const dus = await getProfilesDueForReminder(PUBLIEE);
    expect(dus.map((d) => d.name)).toEqual(["Ouverte"]);
  });

  it("sort la fiche des DEUX lectures de relance, pas seulement de l'envoi", async () => {
    // La liste de l'orga porte un seul CTA, « Relancer les N » : y laisser
    // quelqu'un d'injoignable ferait mentir le compte et le lot le sauterait.
    // L'orga reste informée là où c'est utile — sur la fiche elle-même, où le
    // panneau nomme le refus (couvert par `moderation-panel.test.tsx`).
    await fiche({ nom: "Refuse", jours: 200, cadence: "aucun" });
    expect(await getProfilesEnSommeil(BROUILLON)).toEqual([]);
    expect(await getProfilesEnSommeilBrefs(BROUILLON)).toEqual([]);
  });
});

describe("une cadence longue espace vraiment les envois", () => {
  it("écarte une speakeuse relancée il y a 40 jours qui a choisi 6 mois", async () => {
    // Sans son choix, 40 jours suffiraient (défaut 30) : c'est bien SA cadence
    // qui décide, pas celle de l'équipe.
    await fiche({ nom: "Patiente", jours: 200, relanceeIlYA: 40, cadence: "semestriel" });
    expect(await getProfilesEnSommeil(BROUILLON)).toEqual([]);
  });

  it("la reprend une fois les 6 mois écoulés", async () => {
    await fiche({ nom: "Patiente", jours: 400, relanceeIlYA: 200, cadence: "semestriel" });
    const liste = await getProfilesEnSommeil(BROUILLON);
    expect(liste.map((f) => f.profile.name)).toEqual(["Patiente"]);
  });

  it("accepte un rappel mensuel plus tôt que le défaut de l'équipe", async () => {
    // Fiche PUBLIÉE : le défaut de l'équipe est 180 j, elle a demandé 30.
    await fiche({ nom: "Pressee", jours: 400, relanceeIlYA: 40, cadence: "mensuel", status: "publie" });
    const dus = await getProfilesDueForReminder(PUBLIEE);
    expect(dus.map((d) => d.name)).toEqual(["Pressee"]);
  });

  it("distingue bien les trois durées", async () => {
    // Relancées il y a 45 jours : « mensuel » (30 j) repasse, les deux autres non.
    await fiche({ nom: "Mensuelle", jours: 200, relanceeIlYA: 45, cadence: "mensuel" });
    await fiche({ nom: "Bimestrielle", jours: 200, relanceeIlYA: 45, cadence: "bimestriel" });
    await fiche({ nom: "Semestrielle", jours: 200, relanceeIlYA: 45, cadence: "semestriel" });
    const liste = await getProfilesEnSommeil(BROUILLON);
    expect(liste.map((f) => f.profile.name)).toEqual(["Mensuelle"]);
  });
});

describe("sans choix, le délai de l'équipe s'applique (rien ne change)", () => {
  it("relance de brouillon : la fenêtre de 30 jours vaut toujours", async () => {
    await fiche({ nom: "Fraiche", jours: 200, relanceeIlYA: 5, cadence: null });
    await fiche({ nom: "Ancienne", jours: 200, relanceeIlYA: 60, cadence: null });
    const liste = await getProfilesEnSommeil(BROUILLON);
    expect(liste.map((f) => f.profile.name)).toEqual(["Ancienne"]);
  });

  it("rappel des publiées : la fenêtre de 180 jours vaut toujours", async () => {
    await fiche({ nom: "Fraiche", jours: 400, relanceeIlYA: 100, cadence: null, status: "publie" });
    await fiche({ nom: "Ancienne", jours: 400, relanceeIlYA: 300, cadence: null, status: "publie" });
    const dus = await getProfilesDueForReminder(PUBLIEE);
    expect(dus.map((d) => d.name)).toEqual(["Ancienne"]);
  });

  it("suit l'équipe si elle change son délai", async () => {
    await fiche({ nom: "Ada", jours: 200, relanceeIlYA: 45, cadence: null });
    // Fenêtre à 60 j : trop tôt. Fenêtre à 30 j : c'est bon.
    expect(await getProfilesEnSommeil(60)).toEqual([]);
    expect((await getProfilesEnSommeil(30)).length).toBe(1);
  });
});

describe("la vue brève reste alignée sur la liste", () => {
  it("écarte les mêmes personnes que le lot complet", async () => {
    await fiche({ nom: "Refuse", jours: 200, cadence: "aucun" });
    await fiche({ nom: "Patiente", jours: 200, relanceeIlYA: 40, cadence: "semestriel" });
    await fiche({ nom: "Ouverte", jours: 200, cadence: null });
    const brefs = await getProfilesEnSommeilBrefs(BROUILLON);
    const complets = await getProfilesEnSommeil(BROUILLON);
    expect(brefs.map((b) => b.nom)).toEqual(["Ouverte"]);
    expect(brefs.map((b) => b.id)).toEqual(complets.map((c) => c.profile.id));
  });
});

describe("lire et écrire le choix", () => {
  it("rend null tant que rien n'est choisi, puis le choix enregistré", async () => {
    const { userId } = await fiche({ nom: "Ada", jours: 10 });
    expect(await getRappelCadence(userId)).toBeNull();
    await setRappelCadence(userId, "semestriel");
    expect(await getRappelCadence(userId)).toBe("semestriel");
  });

  it("revient au délai de l'équipe quand on repose null", async () => {
    const { userId } = await fiche({ nom: "Ada", jours: 10, cadence: "aucun" });
    await setRappelCadence(userId, null);
    expect(await getRappelCadence(userId)).toBeNull();
  });

  it("ne touche QUE la fiche du compte visé", async () => {
    // L'écriture est bornée par sa clause WHERE : aucune façon de régler la
    // préférence de quelqu'un d'autre, même en trafiquant un champ.
    const ada = await fiche({ nom: "Ada", jours: 10 });
    const grace = await fiche({ nom: "Grace", jours: 10 });
    await setRappelCadence(ada.userId, "aucun");
    expect(await getRappelCadence(ada.userId)).toBe("aucun");
    expect(await getRappelCadence(grace.userId)).toBeNull();
  });

  it("dit si l'écriture a porté : vrai avec une fiche, faux sans", async () => {
    // C'est ce booléen qui empêche l'écran d'annoncer « Choix enregistré »
    // pour un UPDATE qui n'a touché aucune ligne.
    const { userId } = await fiche({ nom: "Ada", jours: 10 });
    expect(await setRappelCadence(userId, "mensuel")).toBe(true);
    const { rows } = await h.pool.query(
      `INSERT INTO users (name, email) VALUES ('Nue', 'nue@test.fr') RETURNING id`,
    );
    expect(await setRappelCadence(rows[0].id as number, "mensuel")).toBe(false);
  });

  it("rend null pour un compte sans fiche", async () => {
    const { rows } = await h.pool.query(
      `INSERT INTO users (name, email) VALUES ('Sans', 'sans@test.fr') RETURNING id`,
    );
    expect(await getRappelCadence(rows[0].id as number)).toBeNull();
  });
});
