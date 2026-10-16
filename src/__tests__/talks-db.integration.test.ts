import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { schemaForPgMem } from "./schema-pgmem";

/**
 * VRAIS tests d'intégration BDD du flux « talks » : on exécute le SQL réel
 * contre un Postgres en mémoire (pg-mem), en chargeant `db/schema.sql`, puis on
 * fait tourner les vraies fonctions d'accès ET la Server Action.
 *
 * Pourquoi ce fichier existe : le flux d'ajout de talk n'était couvert que par
 * des tests à pool MOCKÉ (talks.test.ts, actions-espace.test.ts). Ils vérifient
 * la chaîne SQL et l'orchestration, mais jamais qu'un talk saisi atterrit et
 * reste en base, ni que la page le relit avec le bon profil. C'est ce niveau
 * qui aurait attrapé « le talk disparaît à chaque fois ».
 *
 * Depuis la migration 044, un talk = une IDENTITÉ (titre, type, description)
 * et ses conférences vivent dans `talk_occurrences` (addOccurrence) : le flux
 * couvert ici est donc addTalk + addOccurrence → relecture.
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
vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn(), signOut: vi.fn() }));

import { auth } from "@/auth";
import {
  addTalk,
  getTalksByProfileId,
  getPublicTalksByProfileId,
  updateTalk,
  deleteTalk,
  addOccurrence,
  removeOccurrence,
} from "@/lib/talks";
import { ensureProfileId, getProfileByUserId } from "@/lib/profiles";
import { parseTalkIdentityForm, DESCRIPTION_MAX } from "@/lib/talk-form";
import { addTalkAction } from "@/app/mon-espace/actions";

let backup: { restore: () => void };

beforeAll(() => {
  h.mem.public.none(schemaForPgMem());
  backup = h.mem.backup();
});
beforeEach(() => {
  backup.restore();
  vi.clearAllMocks();
});

async function newUser(email: string): Promise<number> {
  const { rows } = await h.pool.query(
    "INSERT INTO users(name, email) VALUES('Clara', $1) RETURNING id",
    [email],
  );
  return (rows[0] as { id: number }).id;
}

function browserFd(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** Une occurrence complète (conférence datée + liens), surchargeable. */
function occurrence(over: Partial<Parameters<typeof addOccurrence>[2]> = {}) {
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

describe("flux talks — écriture puis relecture réelle", () => {
  it("addTalk (identité) + addOccurrence (conférence datée) persistent tous les champs, relus par getTalksByProfileId", async () => {
    const profileId = await ensureProfileId(await newUser("a@ex.fr"));
    const talkId = await addTalk(profileId, {
      titre: "Mon talk DevFest",
      type: "Conférence",
      description: "Un retour d'expérience.",
    });
    const occId = await addOccurrence(
      talkId,
      profileId,
      occurrence({ lienConf: "https://devfest.gdgtoulouse.fr" }),
    );
    expect(occId).not.toBeNull();

    const [talk] = await getTalksByProfileId(profileId);
    expect(talk).toMatchObject({
      titre: "Mon talk DevFest",
      type: "Conférence",
      description: "Un retour d'expérience.",
    });
    expect(talk.occurrences).toHaveLength(1);
    expect(talk.occurrences[0]).toMatchObject({
      conference: "DevFest",
      ville: "Toulouse",
      pays: "France",
      date: "2026-11-19",
      lienConf: "https://devfest.gdgtoulouse.fr",
    });
  });

  it("update puis delete sont scopés au profil (ownership) et effectifs", async () => {
    const mien = await ensureProfileId(await newUser("moi@ex.fr"));
    const autre = await ensureProfileId(await newUser("autre@ex.fr"));
    await addTalk(mien, { titre: "V1", type: "Meetup", description: null });
    const [t] = await getTalksByProfileId(mien);

    // Un autre profil ne peut ni modifier ni supprimer mon talk.
    await updateTalk(t.id, autre, { titre: "Piraté", type: t.type, description: t.description });
    expect((await getTalksByProfileId(mien))[0].titre).toBe("V1");
    await deleteTalk(t.id, autre);
    expect(await getTalksByProfileId(mien)).toHaveLength(1);

    // Le propriétaire, lui, modifie puis supprime.
    await updateTalk(t.id, mien, { titre: "V2", type: t.type, description: t.description });
    expect((await getTalksByProfileId(mien))[0].titre).toBe("V2");
    await deleteTalk(t.id, mien);
    expect(await getTalksByProfileId(mien)).toHaveLength(0);
  });

  it("plusieurs talks et occurrences manuels coexistent (external_id NULL, pas de collision d'index unique)", async () => {
    const profileId = await ensureProfileId(await newUser("multi@ex.fr"));
    const a = await addTalk(profileId, { titre: "Talk A", type: "Conférence", description: null });
    const b = await addTalk(profileId, { titre: "Talk B", type: "Conférence", description: null });
    // L'index unique partiel (profil, source, external_id) vit désormais sur
    // talk_occurrences : deux occurrences manuelles (external_id NULL) du même
    // profil doivent coexister aussi.
    expect(await addOccurrence(a, profileId, occurrence())).not.toBeNull();
    expect(await addOccurrence(b, profileId, occurrence())).not.toBeNull();
    const talks = await getTalksByProfileId(profileId);
    expect(talks).toHaveLength(2);
    expect(talks.every((t) => t.occurrences.length === 1)).toBe(true);
  });
});

describe("occurrences — ownership, cascade, dernière occurrence", () => {
  it("un autre profil ne peut ni rattacher ni retirer une occurrence sur mon talk", async () => {
    const mien = await ensureProfileId(await newUser("proprio@ex.fr"));
    const autre = await ensureProfileId(await newUser("intrus@ex.fr"));
    const talkId = await addTalk(mien, { titre: "T", type: "Conférence", description: null });

    // addOccurrence refuse (null) : rien n'est inséré sur le talk d'autrui.
    expect(await addOccurrence(talkId, autre, occurrence({ conference: "Pirate" }))).toBeNull();
    expect((await getTalksByProfileId(mien))[0].occurrences).toHaveLength(0);

    // removeOccurrence par un autre profil : no-op, mon occurrence reste.
    const occId = await addOccurrence(talkId, mien, occurrence());
    expect(occId).not.toBeNull();
    await removeOccurrence(occId!, autre);
    expect((await getTalksByProfileId(mien))[0].occurrences).toHaveLength(1);
  });

  it("supprimer un talk supprime ses occurrences en cascade", async () => {
    const profileId = await ensureProfileId(await newUser("cascade@ex.fr"));
    const talkId = await addTalk(profileId, { titre: "T", type: "Conférence", description: null });
    await addOccurrence(talkId, profileId, occurrence());
    await addOccurrence(talkId, profileId, occurrence({ conference: "Sunny Tech", date: "2025-06-26" }));

    await deleteTalk(talkId, profileId);

    expect(await getTalksByProfileId(profileId)).toHaveLength(0);
    const { rows } = await h.pool.query("SELECT COUNT(*)::int AS n FROM talk_occurrences");
    expect((rows[0] as { n: number }).n).toBe(0);
  });

  it("retirer la dernière occurrence laisse le talk (il redevient un sujet proposé)", async () => {
    const profileId = await ensureProfileId(await newUser("sujet@ex.fr"));
    const talkId = await addTalk(profileId, { titre: "T", type: "Conférence", description: null });
    const occId = await addOccurrence(talkId, profileId, occurrence());

    await removeOccurrence(occId!, profileId);

    const talks = await getTalksByProfileId(profileId);
    expect(talks).toHaveLength(1);
    expect(talks[0].occurrences).toEqual([]);
  });
});

describe("régression : le talk ne doit plus disparaître", () => {
  it("un abstract réaliste (long) est accepté et persiste", async () => {
    const profileId = await ensureProfileId(await newUser("long@ex.fr"));
    // Abstract de conférence typique : ~1800 caractères (dépassait l'ancienne
    // limite de 1000 → rejet silencieux → « le talk disparaît »).
    const abstract = "A".repeat(1800);
    expect(abstract.length).toBeGreaterThan(1000);
    expect(abstract.length).toBeLessThanOrEqual(DESCRIPTION_MAX);

    const parsed = parseTalkIdentityForm(
      browserFd({
        titre: "Mon talk DevFest",
        type: "Conférence",
        description: abstract,
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await addTalk(profileId, parsed.data);
    const [talk] = await getTalksByProfileId(profileId);
    expect(talk.description).toBe(abstract);
  });

  it("chemin complet action → relecture page : le talk apparaît dans la liste", async () => {
    const uid = await newUser("clara@ex.fr");
    vi.mocked(auth).mockResolvedValue({ user: { id: String(uid) } } as never);

    // L'action ne lit plus que l'identité, puis ouvre la page du talk créé
    // (pour y rattacher des conférences) : redirection vers /talks/<id>.
    await expect(
      addTalkAction(
        {},
        browserFd({
          titre: "Mon talk DevFest",
          type: "Conférence",
          description: "B".repeat(1500),
        }),
      ),
    ).rejects.toThrow(/^REDIRECT:\/mon-espace\/talks\/\d+\?ok=talk_ajoute$/);

    // Exactement ce que fait la page /mon-espace pour afficher les talks.
    const profile = await getProfileByUserId(uid);
    expect(profile).not.toBeNull();
    const talks = await getTalksByProfileId(profile!.id);
    expect(talks).toHaveLength(1);
    expect(talks[0].titre).toBe("Mon talk DevFest");
  });
});

/**
 * La garantie publique du correctif (migration 068), jouée en vrai SQL : une
 * conférence en attente d'arbitrage ne sort JAMAIS sur la fiche publique, mais
 * le talk qui la porte, lui, reste affiché comme sujet proposé. C'est ce
 * deuxième point qu'un filtre posé en WHERE (au lieu du ON) casserait en
 * silence : la speakeuse perdrait le talk entier de sa fiche.
 */
describe("conférence en attente d'arbitrage — visibilité publique", () => {
  async function talkAvecOccurrences(email: string) {
    const profileId = await ensureProfileId(await newUser(email));
    const talkId = await addTalk(profileId, {
      titre: "Mon talk",
      type: "Conférence",
      description: null,
    });
    return { profileId, talkId };
  }

  it("l'espace perso la montre (avec son état), la fiche publique la tait", async () => {
    const { profileId, talkId } = await talkAvecOccurrences("attente@ex.fr");
    const { rows } = await h.pool.query(
      `INSERT INTO conference_propositions (nom, statut) VALUES ('Cloud Nord', 'en_attente') RETURNING id`,
    );
    await addOccurrence(
      talkId,
      profileId,
      occurrence({ conference: "Cloud Nord", propositionId: Number((rows[0] as { id: number }).id) }),
    );

    const [perso] = await getTalksByProfileId(profileId);
    expect(perso.occurrences).toHaveLength(1);
    expect(perso.occurrences[0].etat).toBe("en_attente");

    const [publie] = await getPublicTalksByProfileId(profileId);
    // Le TALK reste (sujet proposé) ; seule la conférence en attente est tue.
    expect(publie).toBeDefined();
    expect(publie.titre).toBe("Mon talk");
    expect(publie.occurrences).toEqual([]);
  });

  it("une conférence écartée reste tue elle aussi, et son état le dit", async () => {
    const { profileId, talkId } = await talkAvecOccurrences("ecartee@ex.fr");
    const { rows } = await h.pool.query(
      `INSERT INTO conference_propositions (nom, statut) VALUES ('Conf Bidon', 'refusee') RETURNING id`,
    );
    await addOccurrence(
      talkId,
      profileId,
      occurrence({ conference: "Conf Bidon", propositionId: Number((rows[0] as { id: number }).id) }),
    );

    const [perso] = await getTalksByProfileId(profileId);
    expect(perso.occurrences[0].etat).toBe("ecartee");
    const [publie] = await getPublicTalksByProfileId(profileId);
    expect(publie.occurrences).toEqual([]);
  });

  it("les conférences validées du même talk restent publiques (rien d'autre n'est emporté)", async () => {
    const { profileId, talkId } = await talkAvecOccurrences("melange@ex.fr");
    const { rows } = await h.pool.query(
      `INSERT INTO conference_propositions (nom, statut) VALUES ('Cloud Nord', 'en_attente') RETURNING id`,
    );
    await addOccurrence(talkId, profileId, occurrence({ conference: "DevFest Toulouse" }));
    await addOccurrence(
      talkId,
      profileId,
      occurrence({ conference: "Cloud Nord", propositionId: Number((rows[0] as { id: number }).id) }),
    );

    const [publie] = await getPublicTalksByProfileId(profileId);
    expect(publie.occurrences.map((o) => o.conference)).toEqual(["DevFest Toulouse"]);
  });
});
