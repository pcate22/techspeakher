import { describe, it, expect, vi, beforeEach } from "vitest";

const query = vi.fn();
vi.mock("@/lib/db", () => ({ pool: { query: (...a: unknown[]) => query(...a) } }));

import {
  getTalksByProfileId,
  getPublicTalksByProfileId,
  getPublicTalkTextByProfile,
  getPublicTalkTitlesByProfile,
  getTalkById,
  addTalk,
  updateTalk,
  deleteTalk,
  addOccurrence,
  updateOccurrence,
  removeOccurrence,
  getOccurrenceById,
  getOccurrenceSuggestions,
  TALK_SOURCE_TREMPLIN,
} from "@/lib/talks";
import { ensureProfileId } from "@/lib/profiles";

beforeEach(() => query.mockReset());

/** Identité d'un talk : les SEULS champs écrits par addTalk / updateTalk. */
const identite = {
  titre: "Mon talk",
  type: "Conférence",
  description: null,
};

/** Une occurrence complète (conférence datée + liens), pour les writes. */
const occurrence = {
  conferenceId: 7,
  editionId: 12,
  conference: "DevFest",
  ville: "Toulouse",
  codeInsee: "31555",
  region: "Occitanie",
  pays: "France",
  date: "2026-11-19",
  lienConf: "https://conf",
  lienSlides: null,
  lienVideo: "https://video",
  lienFeedback: null,
};

/**
 * AUTANT DE VALEURS QUE DE PLACEHOLDERS — la garde qui manquait.
 *
 * Le pool est simulé dans ces tests : une requête qui annonce `$15` en n'en
 * fournissant que 13 passe ici sans broncher, et c'est POSTGRES qui la refuse,
 * en production, au moment où quelqu'un enregistre. C'est exactement ce qui est
 * arrivé à `updateOccurrence` (migration 072) : `code_insee` et `region`
 * oubliés du tableau, tous les paramètres suivants décalés d'un cran, et une
 * assertion `toContain` qui restait verte.
 *
 * On vérifie donc la FORME de l'appel, pas seulement son contenu : chaque
 * `$n` de 1 au plus grand doit exister, et le tableau doit en compter autant.
 */
function verifieParametres(sql: string, params: readonly unknown[]) {
  const numeros = [...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
  const max = Math.max(...numeros);
  expect(params).toHaveLength(max);
  const manquants = Array.from({ length: max }, (_, i) => i + 1).filter(
    (n) => !numeros.includes(n),
  );
  expect(manquants).toEqual([]);
}

/** Ligne du LEFT JOIN talk ⋈ occurrence, surchargeable champ par champ. */
function joinRow(over: Record<string, unknown> = {}) {
  return {
    id: 5,
    speaker_profile_id: 2,
    titre: "T",
    type: "Meetup",
    description: null,
    occ_id: null,
    conference_id: null,
    edition_id: null,
    conference: null,
    ville: null,
    pays: null,
    date: null,
    lien_conf: null,
    lien_slides: null,
    lien_video: null,
    lien_feedback: null,
    ...over,
  };
}

describe("lectures publiques : exclusion des propositions backfillées (source tremplin)", () => {
  it("getPublicTalksByProfileId exclut source = 'tremplin' sur l'IDENTITÉ", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await getPublicTalksByProfileId(2);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/t\.source is null or t\.source <> \$2/i);
    expect(params).toEqual([2, TALK_SOURCE_TREMPLIN]);
  });

  it("getPublicTalkTextByProfile (recherche) exclut source = 'tremplin'", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await getPublicTalkTextByProfile();
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/source is distinct from \$1/i);
    expect(params).toEqual([TALK_SOURCE_TREMPLIN]);
  });

  it("getPublicTalkTitlesByProfile (carte) exclut source = 'tremplin'", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await getPublicTalkTitlesByProfile();
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/source is distinct from \$1/i);
    expect(params).toEqual([TALK_SOURCE_TREMPLIN]);
  });
});

describe("getPublicTalkTitlesByProfile", () => {
  it("regroupe titre + type par profil (Map), en préservant l'ordre — une ligne par talk (identité, pas d'occurrence)", async () => {
    query.mockResolvedValueOnce({
      rows: [
        { profile_id: 2, titre: "Scaling Istio", type: "Conférence" },
        { profile_id: 2, titre: "Kubernetes 101", type: "Meetup" },
        { profile_id: 5, titre: "RGAA en pratique", type: "Atelier" },
      ],
    });
    const map = await getPublicTalkTitlesByProfile();
    // La requête lit l'identité seule : un titre par talk, jamais dupliqué par occurrence.
    expect(String(query.mock.calls[0][0])).not.toMatch(/talk_occurrences/i);
    expect(map.get(2)).toEqual([
      { titre: "Scaling Istio", type: "Conférence" },
      { titre: "Kubernetes 101", type: "Meetup" },
    ]);
    expect(map.get(5)).toEqual([{ titre: "RGAA en pratique", type: "Atelier" }]);
    // Un profil sans talk n'a pas d'entrée (le consommateur retombe sur []).
    expect(map.get(99)).toBeUndefined();
  });
});

describe("getTalksByProfileId", () => {
  it("LEFT JOIN talk_occurrences par speaker_profile_id, occurrences triées date DESC", async () => {
    query.mockResolvedValueOnce({
      rows: [
        joinRow({ occ_id: 11, conference: "GDG", ville: "Lyon", date: "2026-01-10" }),
        joinRow({ occ_id: 9, conference: "DevFest", ville: "Toulouse", date: "2025-11-19" }),
        joinRow({ id: 6, titre: "Sujet proposé", type: "Conférence" }),
      ],
    });
    const talks = await getTalksByProfileId(2);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/from speaker_talks/i);
    expect(String(sql)).toMatch(/left join talk_occurrences/i);
    expect(String(sql)).toMatch(/where t\.speaker_profile_id = \$1/i);
    expect(String(sql)).toMatch(/order by t\.id, o\.date desc nulls last, o\.id desc/i);
    expect(params).toEqual([2]);
    // Regroupement : 2 talks, le premier porte ses 2 occurrences (récente d'abord).
    expect(talks).toHaveLength(2);
    expect(talks[0].type).toBe("Meetup");
    expect(talks[0].occurrences.map((o) => o.conference)).toEqual(["GDG", "DevFest"]);
    expect(talks[0].occurrences[0].ville).toBe("Lyon");
    // Un talk sans occurrence reste listé (sujet proposé).
    expect(talks[1].titre).toBe("Sujet proposé");
    expect(talks[1].occurrences).toEqual([]);
  });
});

describe("getTalkById", () => {
  it("SELECT filtré par id ET speaker_profile_id (ownership), regroupe les occurrences", async () => {
    query.mockResolvedValueOnce({
      rows: [
        joinRow({
          type: "Conférence",
          occ_id: 9,
          conference: "DevFest",
          ville: "Toulouse",
          pays: "France",
        }),
      ],
    });
    const talk = await getTalkById(5, 2);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/from speaker_talks/i);
    expect(String(sql)).toMatch(/where t\.id = \$1 and t\.speaker_profile_id = \$2/i);
    expect(params).toEqual([5, 2]);
    expect(talk?.titre).toBe("T");
    expect(talk?.occurrences[0]).toMatchObject({ id: 9, conference: "DevFest" });
  });

  it("renvoie null si le talk n'appartient pas au profil", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await getTalkById(5, 999)).toBeNull();
  });
});

describe("addTalk", () => {
  it("INSERT de l'IDENTITÉ seule (speaker_profile_id, titre, type, description), renvoie l'id", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 42 }] });
    const id = await addTalk(2, identite);
    expect(id).toBe(42);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/insert into speaker_talks/i);
    expect(String(sql)).toMatch(/returning id/i);
    // Plus AUCUN champ d'occurrence sur le talk (conference, ville, liens…).
    expect(String(sql)).not.toMatch(/conference|ville|pays|lien_/i);
    expect(params).toEqual([2, "Mon talk", "Conférence", null]);
  });
});

describe("updateTalk", () => {
  it("UPDATE de l'identité, filtré par id ET speaker_profile_id (ownership)", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await updateTalk(5, 2, identite);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/update speaker_talks/i);
    expect(String(sql)).toMatch(/where id = \$1 and speaker_profile_id = \$2/i);
    expect(params).toEqual([5, 2, "Mon talk", "Conférence", null]);
  });
});

describe("deleteTalk", () => {
  it("DELETE filtré par id ET speaker_profile_id (ownership)", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await deleteTalk(5, 2);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/delete from speaker_talks/i);
    expect(String(sql)).toMatch(/where id = \$1 and speaker_profile_id = \$2/i);
    expect(params).toEqual([5, 2]);
  });
});

describe("addOccurrence", () => {
  it("INSERT…SELECT scopé au talk du profil ; speaker_profile_id vient du talk parent", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 8 }] });
    const id = await addOccurrence(5, 2, occurrence);
    expect(id).toBe(8);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/insert into talk_occurrences/i);
    // Ownership par la forme même de la requête : rien n'est inséré si le talk
    // n'appartient pas au profil, et le speaker_profile_id est TOUJOURS celui
    // du talk parent (jamais un champ client).
    expect(String(sql)).toMatch(/select t\.id, t\.speaker_profile_id/i);
    expect(String(sql)).toMatch(/where t\.id = \$1 and t\.speaker_profile_id = \$2/i);
    expect(String(sql)).toMatch(/returning id/i);
    verifieParametres(String(sql), params);
    expect(params).toEqual([
      5, 2, 7, 12, "DevFest", "Toulouse",
      // Géographie exploitable (migration 072), entre la ville et le pays.
      "31555", "Occitanie",
      "France", "2026-11-19",
      // Dernier paramètre : proposition_id — null tant que la conférence vient
      // du registre (migration 068).
      "https://conf", null, "https://video", null, null,
    ]);
  });

  it("renvoie null quand le talk n'appartient pas au profil (aucune ligne insérée)", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await addOccurrence(5, 999, occurrence)).toBeNull();
  });
});

describe("updateOccurrence", () => {
  it("UPDATE filtré par id ET speaker_profile_id (ownership) avec tous les champs", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await updateOccurrence(8, 2, occurrence);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/update talk_occurrences/i);
    expect(String(sql)).toMatch(/where id = \$1 and speaker_profile_id = \$2/i);
    verifieParametres(String(sql), params);
    // Le tableau en ENTIER, dans l'ordre : une assertion « contient DevFest »
    // reste verte alors que chaque valeur est écrite dans la colonne du
    // voisin — c'est un décalage, pas une absence, qu'il faut voir tomber.
    expect(params).toEqual([
      8, 2, 7, 12, "DevFest", "Toulouse",
      // Géographie exploitable (migration 072), entre la ville et le pays.
      "31555", "Occitanie",
      "France", "2026-11-19",
      "https://conf", null, "https://video", null, null,
    ]);
  });
});

describe("removeOccurrence", () => {
  it("DELETE filtré par id ET speaker_profile_id (ownership)", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await removeOccurrence(8, 2);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/delete from talk_occurrences/i);
    expect(String(sql)).toMatch(/where id = \$1 and speaker_profile_id = \$2/i);
    expect(params).toEqual([8, 2]);
  });
});

describe("getOccurrenceById", () => {
  it("SELECT filtré par id ET speaker_profile_id (ownership), mappe la ligne", async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 8,
          conference_id: 7,
          edition_id: null,
          conference: "DevFest",
          ville: "Toulouse",
          code_insee: "31555",
          region: "Occitanie",
          pays: "France",
          date: "2026-11-19",
          lien_conf: "https://conf",
          lien_slides: null,
          lien_video: null,
          lien_feedback: null,
        },
      ],
    });
    const occ = await getOccurrenceById(8, 2);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/from talk_occurrences/i);
    expect(String(sql)).toMatch(/where o\.id = \$1 and o\.speaker_profile_id = \$2/i);
    expect(params).toEqual([8, 2]);
    expect(occ).toMatchObject({
      id: 8,
      conferenceId: 7,
      conference: "DevFest",
      lienConf: "https://conf",
      codeInsee: "31555",
      region: "Occitanie",
    });
  });

  /**
   * LA GÉOGRAPHIE DOIT REVENIR AVEC LE RESTE, sinon modifier une date efface
   * la commune.
   *
   * Le formulaire réenvoie TOUTE l'occurrence à chaque enregistrement. Si la
   * lecture ne rapporte pas `code_insee` / `region`, l'écran repart sans elles,
   * les repose vides, et l'`UPDATE` écrase ce que le rattrapage avait rempli —
   * sans message, sans erreur, en changeant juste un lien de slides.
   *
   * Un mock rend les colonnes même si le SELECT les oublie : le mapping est
   * vérifié au test précédent, la REQUÊTE l'est ici.
   */
  it("demande les colonnes de géographie au SELECT (migration 072)", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await getOccurrenceById(8, 2);
    const [sql] = query.mock.calls[0];
    expect(String(sql)).toMatch(/o\.code_insee/i);
    expect(String(sql)).toMatch(/o\.region/i);
  });

  it("renvoie null si l'occurrence n'appartient pas au profil", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await getOccurrenceById(8, 999)).toBeNull();
  });
});

describe("getOccurrenceSuggestions", () => {
  it("registre regroupé par conférence (conf sans édition proposée), villes/pays DISTINCT des occurrences", async () => {
    query
      // 1re requête : toutes les conférences du registre (triées par nom).
      .mockResolvedValueOnce({
        rows: [
          { id: 1, nom: "Devoxx France", ville: "Paris", pays: "France" },
          { id: 2, nom: "Sunny Tech", ville: "Montpellier", pays: "France" },
        ],
      })
      // 2e requête : les éditions datées récentes de la référence.
      .mockResolvedValueOnce({
        rows: [
          {
            edition_id: 12,
            conference_id: 2,
            conf_nom: "Sunny Tech",
            type: "edition",
            nom: null,
            annee: 2026,
            date_debut: "2026-06-25",
            ville: "Montpellier",
            pays: "France",
            url: "https://sunny-tech.io",
          },
        ],
      })
      // 3e et 4e requêtes : villes puis pays déjà saisis (auto-complétion lieu).
      .mockResolvedValueOnce({ rows: [{ v: "Toulouse" }] })
      .mockResolvedValueOnce({ rows: [{ v: "France" }] });

    const s = await getOccurrenceSuggestions();

    // Les éditions sont bornées aux récentes (18 mois) et plafonnées.
    const editionsSql = String(query.mock.calls[1][0]);
    expect(editionsSql).toMatch(/make_interval\(months => 18\)/i);
    expect(editionsSql).toMatch(/limit 500/i);
    // Villes/pays viennent des OCCURRENCES (plus de speaker_talks).
    expect(String(query.mock.calls[2][0])).toMatch(/select distinct ville .* from talk_occurrences/i);
    expect(String(query.mock.calls[3][0])).toMatch(/select distinct pays .* from talk_occurrences/i);

    // Une conf SANS édition reste proposée (editions vides) : pas de saisie
    // libre, une conf manquante passe par la demande d'ajout.
    expect(s.registre).toEqual([
      { id: 1, nom: "Devoxx France", ville: "Paris", pays: "France", editions: [] },
      {
        id: 2,
        nom: "Sunny Tech",
        ville: "Montpellier",
        pays: "France",
        editions: [
          {
            editionId: 12,
            conferenceId: 2,
            libelle: "Sunny Tech 2026",
            ville: "Montpellier",
            pays: "France",
            url: "https://sunny-tech.io",
            dateDebut: "2026-06-25",
          },
        ],
      },
    ]);
    expect(s.villes).toEqual(["Toulouse"]);
    expect(s.pays).toEqual(["France"]);
  });
});

describe("ensureProfileId", () => {
  it("retourne l'id du profil (créé si besoin) via INSERT ... ON CONFLICT RETURNING", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 42 }] });
    const id = await ensureProfileId(7);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/insert into speaker_profiles/i);
    expect(String(sql)).toMatch(/on conflict \("userId"\)/i);
    expect(String(sql)).toMatch(/returning id/i);
    expect(params).toEqual([7]);
    expect(id).toBe(42);
  });
});
