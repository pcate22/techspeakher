import { describe, it, expect } from "vitest";
import { finDePeriodeTalk, estPasseTalkDate } from "@/lib/talk-date";
import {
  grouperScenesParPeriode,
  libelleDateScene,
  prochainesScenesExtrait,
  separerScenes,
  type ScenePublique,
} from "@/lib/agenda-public";

/**
 * AGENDA PUBLIC : « où nos speakeuses prennent la parole », toutes fiches
 * confondues. La difficulté n'est pas la requête, c'est la PRÉCISION des dates :
 * une intervention peut être annoncée « 2026 », « novembre 2026 » ou
 * « 19 novembre 2026 ». Une date imprécise reste À VENIR jusqu'à la fin de sa
 * période — sinon « courant 2026 » basculerait dans le passé dès janvier.
 */

const scene = (date: string, o: Partial<ScenePublique> = {}): ScenePublique => ({
  occurrenceId: 1,
  date,
  conference: "DevFest Toulouse",
  conferenceCle: "devfest-toulouse",
  conferenceLibelle: "DevFest Toulouse",
  ville: "Toulouse",
  region: "Occitanie",
  pays: null,
  lienConf: null,
  talkTitre: "Accessibilité sans excuse",
  talkType: "Conférence",
  speakeuseNom: "Léa Dubois",
  image: null,
  speakeuseHref: "/speakeuses/lea-dubois",
  profileId: 5,
  ...o,
});

describe("finDePeriodeTalk — jusqu'où court une date imprécise", () => {
  it("une date exacte est sa propre fin", () => {
    expect(finDePeriodeTalk("2026-11-19")).toBe("2026-11-19");
  });

  it("un mois court jusqu'à son dernier jour (février bissextile compris)", () => {
    expect(finDePeriodeTalk("2026-11")).toBe("2026-11-30");
    expect(finDePeriodeTalk("2026-02")).toBe("2026-02-28");
    expect(finDePeriodeTalk("2024-02")).toBe("2024-02-29");
  });

  it("une année court jusqu'au 31 décembre", () => {
    expect(finDePeriodeTalk("2026")).toBe("2026-12-31");
  });

  it("une valeur libre historique reste elle-même (aucune invention)", () => {
    expect(finDePeriodeTalk("bientôt")).toBe("bientôt");
  });
});

describe("estPasseTalkDate", () => {
  it("hier est passé, aujourd'hui reste à l'affiche", () => {
    expect(estPasseTalkDate("2026-07-30", "2026-07-31")).toBe(true);
    expect(estPasseTalkDate("2026-07-31", "2026-07-31")).toBe(false);
  });

  it("« courant 2026 » reste à venir jusqu'au 31 décembre", () => {
    expect(estPasseTalkDate("2026", "2026-07-31")).toBe(false);
    expect(estPasseTalkDate("2026", "2027-01-01")).toBe(true);
  });

  it("« novembre 2026 » reste à venir pendant tout novembre", () => {
    expect(estPasseTalkDate("2026-11", "2026-11-30")).toBe(false);
    expect(estPasseTalkDate("2026-11", "2026-12-01")).toBe(true);
  });
});

describe("separerScenes — à venir d'un côté, déjà en scène de l'autre", () => {
  it("les prochaines d'abord (au plus tôt), les passées ensuite (au plus récent)", () => {
    const { aVenir, passees } = separerScenes(
      [
        scene("2026-05-01", { occurrenceId: 1 }),
        scene("2026-11-19", { occurrenceId: 2 }),
        scene("2026-09-10", { occurrenceId: 3 }),
        scene("2025-11-20", { occurrenceId: 4 }),
      ],
      "2026-07-31",
    );
    expect(aVenir.map((s) => s.occurrenceId)).toEqual([3, 2]);
    expect(passees.map((s) => s.occurrenceId)).toEqual([1, 4]);
  });

  it("les passées sont plafonnées (la vitrine montre le récent, pas les archives)", () => {
    const vieilles = Array.from({ length: 20 }, (_, i) =>
      scene(`2025-01-${String(i + 1).padStart(2, "0")}`, { occurrenceId: 100 + i }),
    );
    const { passees } = separerScenes(vieilles, "2026-07-31", { maxPassees: 6 });
    expect(passees).toHaveLength(6);
    // Les plus récentes, donc les derniers jours de janvier.
    expect(passees[0].date).toBe("2025-01-20");
  });
});

describe("separerScenes — à date et précision égales, l'alphabet départage", () => {
  it("jamais l'id de ligne en base : le nom de la speakeuse", () => {
    const { aVenir } = separerScenes(
      [
        scene("2026-09-10", { occurrenceId: 42, speakeuseNom: "Zoé Martin" }),
        scene("2026-09-10", { occurrenceId: 3, speakeuseNom: "Amina Diallo" }),
      ],
      "2026-07-31",
    );
    expect(aVenir.map((s) => s.speakeuseNom)).toEqual(["Amina Diallo", "Zoé Martin"]);
  });
});

describe("separerScenes — une date imprécise se range à la FIN de sa période", () => {
  /**
   * « Courant 2026 » n'est pas le 1ᵉʳ janvier : c'est « quelque part dans
   * l'année ». Un tri sur le texte brut la plaçait avant toutes les dates de
   * 2026 — donc en tête d'agenda, ce qui est l'inverse de ce qu'elle dit.
   */
  it("« courant 2026 » passe après les dates connues de 2026", () => {
    const { aVenir } = separerScenes(
      [
        scene("2026", { occurrenceId: 1, talkTitre: "Courant 2026" }),
        scene("2026-09-03", { occurrenceId: 2, talkTitre: "3 septembre" }),
        scene("2026-11", { occurrenceId: 3, talkTitre: "Novembre" }),
        scene("2027-01-15", { occurrenceId: 4, talkTitre: "Janvier 2027" }),
      ],
      "2026-07-31",
    );
    expect(aVenir.map((s) => s.talkTitre)).toEqual([
      "3 septembre",
      "Novembre",
      "Courant 2026",
      "Janvier 2027",
    ]);
  });

  it("côté passé aussi, le plus récent d'abord se lit sur la FIN de période", () => {
    const { passees } = separerScenes(
      [
        scene("2025", { occurrenceId: 1, talkTitre: "Courant 2025" }),
        scene("2025-03-04", { occurrenceId: 2, talkTitre: "Mars 2025" }),
      ],
      "2026-07-31",
    );
    expect(passees.map((s) => s.talkTitre)).toEqual(["Courant 2025", "Mars 2025"]);
  });
});

describe("libelleDateScene — une carte isolée dit son imprécision", () => {
  it("une année seule s'annonce « courant 2026 », pas « 2026 »", () => {
    expect(libelleDateScene("2026")).toBe("courant 2026");
  });

  it("un mois et une date exacte gardent leur libellé français", () => {
    expect(libelleDateScene("2026-11")).toBe("novembre 2026");
    expect(libelleDateScene("2026-11-19")).toBe("19 novembre 2026");
  });
});

describe("grouperScenesParPeriode — des en-têtes lisibles", () => {
  it("un en-tête par mois, dans l'ordre d'arrivée", () => {
    const tranches = grouperScenesParPeriode([
      scene("2026-09-10"),
      scene("2026-09-24"),
      scene("2026-11-19"),
    ]);
    expect(tranches.map((t) => t.libelle)).toEqual([
      "septembre 2026",
      "novembre 2026",
    ]);
    expect(tranches[0].scenes).toHaveLength(2);
  });

  it("une date sans mois a son propre en-tête, à la fin de son année", () => {
    const tranches = grouperScenesParPeriode([scene("2026-09-10"), scene("2026")]);
    expect(tranches.map((t) => t.libelle)).toEqual(["septembre 2026", "courant 2026"]);
  });

  it("chaque tranche a une clé stable (rendu React)", () => {
    const tranches = grouperScenesParPeriode([scene("2026-11-19"), scene("2026")]);
    expect(tranches.map((t) => t.cle)).toEqual(["2026-11", "2026"]);
  });

  /**
   * Revue post-prod du 31/07 : « décembre 2026 » et « courant 2026 » finissent
   * tous deux le 31/12. Le tri par fin de période pouvait intercaler l'année
   * seule ENTRE deux dates de décembre — et l'en-tête « décembre 2026 »
   * apparaissait deux fois (clés React et ids DOM dupliqués). Le tri garde donc
   * les items d'une même tranche contigus à fin égale.
   */
  it("à fin de période égale, une tranche reste d'un seul tenant (jamais deux « décembre »)", () => {
    const { aVenir } = separerScenes(
      [
        scene("2026-12", { occurrenceId: 1 }),
        scene("2026", { occurrenceId: 2 }),
        scene("2026-12-31", { occurrenceId: 3 }),
      ],
      "2026-07-31",
    );
    const tranches = grouperScenesParPeriode(aVenir);
    const cles = tranches.map((t) => t.cle);
    expect(new Set(cles).size).toBe(cles.length);
    // Et l'ordre reste lisible : le mois précis avant l'année vague.
    expect(cles).toEqual(["2026-12", "2026"]);
  });
});

describe("prochainesScenesExtrait — un extrait qui tourne sans jamais mentir sur les dates", () => {
  it("moins de scènes que la limite : tout passe, inchangé", () => {
    const aVenir = [scene("2026-09-10", { speakeuseNom: "A" })];
    expect(prochainesScenesExtrait(aVenir, "2026-08-01", 3)).toEqual(aVenir);
  });

  it("une tranche qui rentre entière n'est jamais réordonnée par la rotation", () => {
    // 2 sur la date la plus proche, 2 sur une date plus lointaine : les 2
    // premières sont CERTAINES (elles tiennent dans les 3 places), seule la
    // 3ᵉ place se dispute entre les 2 de la date lointaine.
    const aVenir = [
      scene("2026-09-01", { speakeuseNom: "A" }),
      scene("2026-09-01", { speakeuseNom: "B" }),
      scene("2026-09-10", { speakeuseNom: "C" }),
      scene("2026-09-10", { speakeuseNom: "D" }),
    ];
    const extrait = prochainesScenesExtrait(aVenir, "2026-08-01", 3);
    expect(extrait.map((s) => s.speakeuseNom).slice(0, 2)).toEqual(["A", "B"]);
    expect(["C", "D"]).toContain(extrait[2].speakeuseNom);
  });

  it("le groupe frontière tourne d'un jour civil sur l'autre (personne n'est jamais figée en tête)", () => {
    const aVenir = [
      scene("2026-09-10", { speakeuseNom: "A" }),
      scene("2026-09-10", { speakeuseNom: "B" }),
      scene("2026-09-10", { speakeuseNom: "C" }),
      scene("2026-09-10", { speakeuseNom: "D" }),
    ];
    const premiereChoisie = (aujourdhui: string) =>
      prochainesScenesExtrait(aVenir, aujourdhui, 3)[0].speakeuseNom;
    // Décalage vérifié par calcul (jours écoulés depuis l'époque) : 0,1,2,3,0…
    expect(premiereChoisie("2026-08-01")).toBe("A");
    expect(premiereChoisie("2026-08-02")).toBe("B");
    expect(premiereChoisie("2026-08-03")).toBe("C");
    expect(premiereChoisie("2026-08-04")).toBe("D");
    expect(premiereChoisie("2026-08-05")).toBe("A");
  });

  it("un jour donné, le résultat est stable (même requête, même extrait)", () => {
    const aVenir = Array.from({ length: 5 }, (_, i) =>
      scene("2026-09-10", { speakeuseNom: String.fromCharCode(65 + i) }),
    );
    const a = prochainesScenesExtrait(aVenir, "2026-08-01", 3).map((s) => s.speakeuseNom);
    const b = prochainesScenesExtrait(aVenir, "2026-08-01", 3).map((s) => s.speakeuseNom);
    expect(a).toEqual(b);
  });
});
