import { describe, it, expect } from "vitest";
import { construirePlan, type RegistreIndex, type TalkExistant } from "@/lib/import-talks";

/**
 * Le PLAN d'import : quelle écriture pour chaque talk et chaque occurrence,
 * décidée AVANT d'écrire — c'est lui que la prévisualisation affiche et que la
 * confirmation exécute, donc une seule vérité pour les deux écrans. Pure :
 * le répertoire et les talks existants sont des entrées.
 */

const REGISTRE: RegistreIndex = [
  {
    id: 7,
    nom: "Devoxx Belgium",
    slug: "devoxx-belgium",
    editions: [{ id: 42, annee: 2025, dateDebut: null, dateFin: null }],
  },
  { id: 8, nom: "Cloud Nord", slug: "cloud-nord", editions: [] },
];

const AUCUN_EXISTANT: TalkExistant[] = [];

function talk(titre: string, occurrences: object[] = []) {
  return {
    titre,
    description: null,
    occurrences: occurrences.map((o) => ({
      conference: null,
      date: null,
      ville: null,
      pays: null,
      lien: null,
      evenementNotist: null,
      ...o,
    })),
  };
}

describe("construirePlan — rapprochement au répertoire", () => {
  it("conférence connue + édition de l'année → rattachée, libellé recomposé", () => {
    const plan = construirePlan(
      [talk("T", [{ conference: "Devoxx Belgium", date: "2025-10-06" }])],
      REGISTRE,
      AUCUN_EXISTANT,
    );
    expect(plan[0].occurrences[0]).toMatchObject({
      action: "registre",
      conferenceId: 7,
      editionId: 42,
      libelle: "Devoxx Belgium 2025",
    });
  });

  it("conférence connue SANS édition de l'année → conferenceId seul, libellé = nom", () => {
    const plan = construirePlan(
      [talk("T", [{ conference: "Cloud Nord", date: "2025-10" }])],
      REGISTRE,
      AUCUN_EXISTANT,
    );
    expect(plan[0].occurrences[0]).toMatchObject({
      action: "registre",
      conferenceId: 8,
      editionId: null,
      libelle: "Cloud Nord",
    });
  });

  it("« Devoxx Belgium 2025 » (année collée au nom) matche la conf, l'année sert de date de repli", () => {
    const plan = construirePlan(
      [talk("T", [{ conference: "Devoxx Belgium 2025" }])],
      REGISTRE,
      AUCUN_EXISTANT,
    );
    expect(plan[0].occurrences[0]).toMatchObject({
      action: "registre",
      conferenceId: 7,
      editionId: 42,
      date: "2025",
    });
  });

  it("la casse et les accents du nom candidat sont tolérés (slug identique)", () => {
    const plan = construirePlan(
      [talk("T", [{ conference: "  DEVOXX bélgium ", date: "2025" }])],
      REGISTRE,
      AUCUN_EXISTANT,
    );
    expect(plan[0].occurrences[0].action).toBe("registre");
  });

  it("conférence inconnue → à proposer, avec nom débarrassé de l'année et année extraite", () => {
    const plan = construirePlan(
      [talk("T", [{ conference: "KCD Helsinki 2026", ville: "Helsinki" }])],
      REGISTRE,
      AUCUN_EXISTANT,
    );
    expect(plan[0].occurrences[0]).toMatchObject({
      action: "proposition",
      nomPropose: "KCD Helsinki",
      annee: 2026,
    });
  });

  it("occurrence sans conférence : écartée du plan (le site exige une conférence par scène)", () => {
    const plan = construirePlan(
      [talk("T", [{ date: "2025-10-06", ville: "Lille" }])],
      REGISTRE,
      AUCUN_EXISTANT,
    );
    expect(plan[0].occurrences[0].action).toBe("ignoree");
  });
});

describe("construirePlan — face aux talks déjà sur la fiche", () => {
  const EXISTANTS: TalkExistant[] = [
    {
      id: 5,
      titre: "Understanding Kubernetes in a visual way",
      occurrences: [{ conference: "Devoxx Belgium 2025", date: "2025-10-06" }],
    },
  ];

  it("titre inconnu de la fiche → talk NOUVEAU", () => {
    const plan = construirePlan([talk("Un autre talk")], REGISTRE, EXISTANTS);
    expect(plan[0]).toMatchObject({ statut: "nouveau", talkIdExistant: null });
  });

  it("même titre (casse ignorée) → COMPLÉMENT du talk existant, jamais un doublon de fiche", () => {
    const plan = construirePlan(
      [talk("UNDERSTANDING kubernetes in a visual way", [
        { conference: "Cloud Nord", date: "2026" },
      ])],
      REGISTRE,
      EXISTANTS,
    );
    expect(plan[0]).toMatchObject({ statut: "complement", talkIdExistant: 5 });
    expect(plan[0].occurrences[0].action).toBe("registre");
  });

  it("occurrence déjà sur le talk (même conférence, même année) → doublon, rien à écrire", () => {
    const plan = construirePlan(
      [talk("Understanding Kubernetes in a visual way", [
        { conference: "Devoxx Belgium", date: "2025-10-06" },
      ])],
      REGISTRE,
      EXISTANTS,
    );
    expect(plan[0].occurrences[0].action).toBe("doublon");
  });

  it("talk existant dont TOUTES les occurrences sont des doublons → statut inchangé", () => {
    const plan = construirePlan(
      [talk("Understanding Kubernetes in a visual way", [
        { conference: "Devoxx Belgium 2025", date: "2025" },
      ])],
      REGISTRE,
      EXISTANTS,
    );
    expect(plan[0].statut).toBe("inchange");
  });

  it("même conférence, ANNÉE différente → pas un doublon (il l'a redonné un an après)", () => {
    const plan = construirePlan(
      [talk("Understanding Kubernetes in a visual way", [
        { conference: "Devoxx Belgium", date: "2026-10-05" },
      ])],
      REGISTRE,
      EXISTANTS,
    );
    expect(plan[0].occurrences[0].action).toBe("registre");
  });
});

describe("construirePlan — les pièges trouvés en revue", () => {
  it("deux lignes identiques dans le MÊME fichier → une seule écriture (doublon intra-lot)", () => {
    const plan = construirePlan(
      [talk("T", [
        { conference: "Devoxx Belgium", date: "2025-10-06" },
        { conference: "Devoxx Belgium 2025" },
      ])],
      REGISTRE,
      AUCUN_EXISTANT,
    );
    expect(plan[0].occurrences.map((o) => o.action)).toEqual(["registre", "doublon"]);
  });

  it("un nom qui ne peut pas devenir une conférence (slug vide) est écarté dès le plan", () => {
    const plan = construirePlan(
      [talk("T", [{ conference: "☆☆☆", date: "2025" }])],
      REGISTRE,
      AUCUN_EXISTANT,
    );
    expect(plan[0].occurrences[0].action).toBe("ignoree");
  });

  it("date imprécise + édition datée → hérite du jour exact, comme la saisie manuelle", () => {
    const registre: RegistreIndex = [
      {
        id: 7, nom: "Devoxx Belgium", slug: "devoxx-belgium",
        editions: [{ id: 42, annee: 2025, dateDebut: "2025-10-06", dateFin: null }],
      },
    ];
    const plan = construirePlan(
      [talk("T", [{ conference: "Devoxx Belgium 2025" }])],
      registre,
      AUCUN_EXISTANT,
    );
    expect(plan[0].occurrences[0].date).toBe("2025-10-06");
  });

  it("édition MULTI-JOURS : le mois est hérité, jamais un faux jour (même règle que la saisie)", () => {
    const registre: RegistreIndex = [
      {
        id: 7, nom: "Devoxx Belgium", slug: "devoxx-belgium",
        editions: [{ id: 42, annee: 2025, dateDebut: "2025-10-06", dateFin: "2025-10-09" }],
      },
    ];
    const plan = construirePlan(
      [talk("T", [{ conference: "Devoxx Belgium 2025" }])],
      registre,
      AUCUN_EXISTANT,
    );
    expect(plan[0].occurrences[0].date).toBe("2025-10");
  });

  it("date déjà EXACTE : jamais écrasée par celle de l'édition (autre jour du même événement)", () => {
    const registre: RegistreIndex = [
      {
        id: 7, nom: "Devoxx Belgium", slug: "devoxx-belgium",
        editions: [{ id: 42, annee: 2025, dateDebut: "2025-10-06", dateFin: null }],
      },
    ];
    const plan = construirePlan(
      [talk("T", [{ conference: "Devoxx Belgium", date: "2025-10-08" }])],
      registre,
      AUCUN_EXISTANT,
    );
    expect(plan[0].occurrences[0].date).toBe("2025-10-08");
  });
});
