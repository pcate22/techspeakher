import { describe, it, expect } from "vitest";
import {
  recitEdition,
  resumeEdition,
  etapeEdition,
  semainesParcours,
  derniereSeance,
  aDesChiffresAAfficher,
  aUnTremplinADecrire,
  type RecitEntrees,
} from "@/lib/recit-edition";

/**
 * Lot G — les surfaces publiques d'une édition RACONTENT (refonte §8) : leur
 * rôle est de montrer ce qu'on fait aux futures candidates, aux sponsors, à la
 * communauté. Le kicker dit donc où en est l'aventure en une phrase, et
 * l'accompagnement se chiffre (« 29 semaines ») — c'est l'argument n° 1 du
 * Tremplin.
 *
 * Fonctions PURES, sans donnée interne : dates, nombres, titres seulement.
 */

const base = (o: Partial<RecitEntrees> = {}): RecitEntrees => ({
  annee: 2026,
  statut: "en_cours",
  finaleDate: "2026-06-04",
  confDate: "2026-11-19",
  confNom: "DevFest Toulouse",
  ateliers: [
    { date: "2026-04-28", dateFin: null },
    { date: "2026-10-06", dateFin: "2026-10-13" },
  ],
  inscriptionsDebut: "2026-03-12",
  inscriptionsFin: "2026-04-17",
  nbInscrites: 8,
  nbGagnantes: 3,
  aujourdhui: "2026-07-31",
  ...o,
});

describe("etapeEdition — UNE décision, cinq récits", () => {
  it("candidatures ouvertes : elles passent avant tout le reste", () => {
    expect(etapeEdition(base({ aujourdhui: "2026-04-01" }))).toBe("candidature");
  });

  it("fenêtre fermée, finale à venir : l'aventure court", () => {
    expect(etapeEdition(base({ aujourdhui: "2026-05-01" }))).toBe("en_cours");
  });

  it("finale passée, conférence à venir : en route vers la scène", () => {
    expect(etapeEdition(base())).toBe("vers_la_scene");
  });

  it("conférence passée : bouclée", () => {
    expect(etapeEdition(base({ aujourdhui: "2026-12-01" }))).toBe("bouclee");
  });

  it("rien de daté : en préparation", () => {
    expect(
      etapeEdition(
        base({
          finaleDate: null,
          confDate: null,
          inscriptionsDebut: null,
          inscriptionsFin: null,
        }),
      ),
    ).toBe("preparation");
  });

  it("édition ARCHIVÉE sans date : au passé, jamais « en préparation »", () => {
    // Import ancien : une édition archivée ne peut pas s'annoncer à venir.
    expect(
      etapeEdition(
        base({
          statut: "archive",
          finaleDate: null,
          confDate: null,
          inscriptionsDebut: null,
          inscriptionsFin: null,
        }),
      ),
    ).toBe("bouclee");
  });

  /**
   * Revue post-prod du 31/07 : archivée AVEC date de finale mais SANS date de
   * conférence, l'édition restait « En route vers la scène » pour toujours
   * (la garde archive ne jouait qu'en l'absence totale de dates). L'archivage
   * est une décision explicite de l'orga : le récit se met au passé.
   */
  it("édition ARCHIVÉE avec finale passée mais sans date de conf : bouclée, jamais figée « vers la scène »", () => {
    expect(
      etapeEdition(
        base({
          statut: "archive",
          finaleDate: "2025-06-01",
          confDate: null,
          aujourdhui: "2026-07-31",
        }),
      ),
    ).toBe("bouclee");
  });
});

describe("recitEdition — le kicker raconte l'étape en cours", () => {
  it("après la finale, en préparation de la conférence : les gagnantes ET la suite", () => {
    const r = recitEdition(base());
    expect(r.kicker).toMatch(/3 gagnantes/);
    expect(r.kicker).toMatch(/19 novembre/);
    // Jamais le vocabulaire administratif de la liste d'admin.
    expect(r.kicker).not.toMatch(/passée|en cours/i);
  });

  it("candidatures ouvertes : la date de clôture, la seule info convertissante", () => {
    const r = recitEdition(base({ aujourdhui: "2026-04-01" }));
    expect(r.kicker).toMatch(/candidatures ouvertes/i);
    expect(r.kicker).toMatch(/17 avril/);
    expect(r.kicker).toMatch(/4 juin/);
  });

  it("avant la finale, candidatures closes : la date de finale et le nombre d'inscrites", () => {
    const r = recitEdition(base({ aujourdhui: "2026-05-01", nbGagnantes: 0 }));
    expect(r.kicker).toMatch(/8 speakeuses/);
    expect(r.kicker).toMatch(/finale/i);
    expect(r.kicker).toMatch(/4 juin/);
  });

  it("édition terminée : le récit se met au passé, chiffres compris", () => {
    const r = recitEdition(base({ aujourdhui: "2026-12-01", statut: "archive" }));
    expect(r.kicker).toMatch(/8 speakeuses/);
    expect(r.kicker).toMatch(/3 gagnantes/);
    expect(r.kicker).toMatch(/DevFest Toulouse/);
  });

  it("finale tenue sans palmarès saisi : une phrase, jamais l'étiquette « Finale passée »", () => {
    const r = recitEdition(base({ nbGagnantes: 0, confDate: null }));
    expect(r.kicker).not.toMatch(/finale passée/i);
    expect(r.kicker).toMatch(/finale tenue le 4 juin/i);
  });

  it("édition en préparation : une invitation, et JAMAIS l'année (la page l'affiche déjà)", () => {
    const r = recitEdition(
      base({
        statut: "preparation",
        finaleDate: null,
        confDate: null,
        inscriptionsDebut: null,
        inscriptionsFin: null,
        ateliers: [],
        nbInscrites: 0,
        nbGagnantes: 0,
      }),
    );
    expect(r.kicker).toMatch(/en préparation/i);
    expect(r.kicker).not.toMatch(/2026/);
  });

  it("aucun article devant un nom de conférence (« du UX Days » ne se dit pas)", () => {
    const r = recitEdition(base({ aujourdhui: "2026-04-01", confNom: "UX Days" }));
    expect(r.kicker).toMatch(/scène\s?: UX Days/);
    expect(r.kicker).not.toMatch(/du UX Days|le UX Days/);
  });

  it("les membres se joignent par une virgule (un point médian ne se dit pas)", () => {
    expect(recitEdition(base()).kicker).not.toMatch(/·/);
  });

  it("bouclée sans aucun chiffre : une phrase quand même, jamais « 0 speakeuse »", () => {
    const r = recitEdition(
      base({ aujourdhui: "2026-12-01", nbInscrites: 0, nbGagnantes: 0, confNom: "" }),
    );
    expect(r.kicker).not.toMatch(/\b0\b/);
    expect(r.kicker.length).toBeGreaterThan(0);
  });
});

describe("semainesParcours — chaque chapitre mesure LE SIEN", () => {
  const seances = [
    { date: "2026-04-28", dateFin: null },
    { date: "2026-10-07", dateFin: "2026-10-13" },
  ];

  it("du premier atelier à la fin donnée : la durée en semaines", () => {
    // 28 avril → 19 novembre = 205 jours ≈ 29 semaines.
    expect(semainesParcours(seances, "2026-11-19")).toBe(29);
  });

  /**
   * LE défaut que cette extraction corrige : une mesure unique agrégeait les
   * deux programmes d'une édition (avril-mai, puis septembre-novembre) et
   * annonçait 29 semaines sur un chapitre qui en dure 6. La fin vient donc de
   * l'appelant — la page d'édition s'arrête à la soirée finale.
   */
  it("bornée à la soirée finale, elle ne compte plus le parcours d'après", () => {
    const avantLaFinale = [
      { date: "2026-04-28", dateFin: null },
      { date: "2026-05-19", dateFin: null },
    ];
    expect(semainesParcours(avantLaFinale, "2026-06-04")).toBe(5);
  });

  it("sans fin, ou sans séance datée : rien à chiffrer (aucune phrase inventée)", () => {
    expect(semainesParcours(seances, null)).toBeNull();
    expect(semainesParcours([], "2026-11-19")).toBeNull();
  });

  /**
   * Une SEULE séance n'est pas un parcours (même règle que le mot
   * « accompagnées » du kicker) : c'est un événement, et « du premier atelier »
   * suppose déjà qu'il y en ait un second.
   */
  it("une seule séance ne se chiffre pas", () => {
    expect(semainesParcours([{ date: "2026-04-28", dateFin: null }], "2026-11-19")).toBeNull();
  });

  it("deux séances sur quelques jours ne deviennent jamais « 0 semaine »", () => {
    const deux = [
      { date: "2026-04-28", dateFin: null },
      { date: "2026-04-29", dateFin: null },
    ];
    expect(semainesParcours(deux, "2026-04-29")).toBeNull();
  });

  it("une fin ANTÉRIEURE au premier atelier ne produit pas de durée négative", () => {
    expect(semainesParcours(seances, "2026-01-01")).toBeNull();
  });
});

describe("derniereSeance — le repli quand aucune date de fin n'est connue", () => {
  it("prend la fin EFFECTIVE la plus tardive, fenêtre comprise", () => {
    expect(
      derniereSeance([
        { date: "2026-04-28", dateFin: null },
        { date: "2026-10-07", dateFin: "2026-10-13" },
      ]),
    ).toBe("2026-10-13");
  });

  it("aucune séance datée : null", () => {
    expect(derniereSeance([{ date: null, dateFin: null }])).toBeNull();
  });

  /**
   * UNE SÉANCE N'EST PAS UN ACCOMPAGNEMENT.
   *
   * La phrase se déclenchait dès qu'il existait UN atelier daté et une date de
   * conférence : elle mesurait l'écart entre cette séance isolée et la scène, et
   * l'annonçait comme « N semaines d'accompagnement, du premier atelier à la
   * scène ». Sur une édition sans parcours — l'édition 2025 n'en a pas eu — la
   * page publique affirmait donc un accompagnement qui n'a pas eu lieu, sur une
   * page indexée. « Du PREMIER atelier » suppose d'ailleurs qu'il y en ait un
   * second.
   *
   * C'est le même défaut que le reste du lot : l'écran affirme ce que la donnée
   * ne porte pas.
   */
  it("une séance isolée ne s'annonce pas comme un accompagnement", () => {
    const seule = [{ date: "2026-04-28", dateFin: null }];
    // Le KICKER : « accompagnées » se mérite, sinon on dit « participantes ».
    const r = recitEdition(base({ confDate: "2020-11-19", ateliers: seule }));
    expect(r.kicker).toMatch(/participante/);
    expect(r.kicker).not.toMatch(/accompagnées/);
    // Et la DURÉE se tait pareillement : les deux phrases se contredisaient.
    expect(semainesParcours(seule, "2026-11-19")).toBeNull();
  });

  it("deux séances suffisent à faire un parcours", () => {
    expect(
      semainesParcours(
        [
          { date: "2026-04-28", dateFin: null },
          { date: "2026-05-12", dateFin: null },
        ],
        "2026-11-19",
      ),
    ).toBe(29);
  });

  /** Une fenêtre (« du 7 au 13 ») est une seule séance, même si elle dure. */
  it("une seule fenêtre reste une séance, pas un parcours", () => {
    expect(
      semainesParcours([{ date: "2026-04-28", dateFin: "2026-05-04" }], "2026-11-19"),
    ).toBeNull();
  });

  /**
   * Le parcours se compte en SÉANCES, pas en séances datées. L'admin a une
   * section « À dater » : une séance sans date est un état normal, pas une
   * absence. Un vrai programme dont une seule séance est calée resterait sinon
   * muet, alors qu'il accompagne bel et bien.
   */
  it("une séance encore à dater compte dans le parcours", () => {
    // La DURÉE se mesure toujours sur ce qui est daté (28 avril → 19 nov.).
    expect(
      semainesParcours(
        [{ date: "2026-04-28", dateFin: null }, { date: null, dateFin: null }],
        "2026-11-19",
      ),
    ).toBe(29);
  });

  it("une séance datée et rien d'autre : toujours pas de parcours", () => {
    expect(semainesParcours([{ date: "2026-04-28", dateFin: null }], "2026-11-19")).toBeNull();
  });
});

/**
 * LE MÊME FAIT GOUVERNE LES DEUX PHRASES.
 *
 * Le kicker d'une édition bouclée annonçait « N speakeuses ACCOMPAGNÉES »,
 * dérivé du simple compte des inscriptions. Sur une édition sans préparation —
 * 2025 n'en a pas eu — la page affirmait donc un accompagnement qui n'a pas eu
 * lieu, trois blocs au-dessus de la phrase « N semaines d'accompagnement »
 * qu'on venait de taire pour cette raison exacte. Inscrite n'est pas
 * accompagnée : le mot fort se garde pour les éditions qui l'ont mérité.
 */
describe("recitEdition — « accompagnées » se mérite", () => {
  const bouclee = (o: Partial<RecitEntrees> = {}) =>
    recitEdition(base({ aujourdhui: "2026-12-01", nbInscrites: 8, ...o }));

  it("avec un parcours, les speakeuses ont bien été accompagnées", () => {
    expect(bouclee().kicker).toMatch(/8 speakeuses accompagnées/);
  });

  it("sans parcours, on dit ce qui est vrai : elles ont participé", () => {
    const r = bouclee({ ateliers: [{ date: "2026-04-28", dateFin: null }] });
    expect(r.kicker).not.toMatch(/accompagnées/);
    expect(r.kicker).toMatch(/8 participantes/);
  });

  it("sans aucun atelier non plus", () => {
    expect(bouclee({ ateliers: [] }).kicker).toMatch(/8 participantes/);
  });
});

describe("recitEdition — titre du parcours accordé au temps", () => {
  it("parcours déjà commencé : au passé (« ce qu'on a travaillé »)", () => {
    expect(recitEdition(base()).titreParcours).toMatch(/travaillé/);
  });

  it("parcours à venir : au futur (« ce qu'on va travailler »)", () => {
    const r = recitEdition(base({ aujourdhui: "2026-01-10" }));
    expect(r.titreParcours).toMatch(/va travailler/);
  });
});

describe("resumeEdition — la ligne de liste parle la même langue que la fiche", () => {
  it("aucune étiquette de statut admin (le hub public disait « Édition passée »)", () => {
    // On bannit les LIBELLÉS de `EDITION_STATUT_LABEL`, pas les mots : « En
    // cours » nu est administratif, « Accompagnement en cours » raconte.
    const etiquettes = ["En cours", "Finale passée", "Édition passée"];
    const etats = [
      resumeEdition(base({ aujourdhui: "2026-04-01" })),
      resumeEdition(base({ aujourdhui: "2026-05-01" })),
      resumeEdition(base()),
      resumeEdition(base({ aujourdhui: "2026-12-01" })),
    ];
    for (const e of etats) {
      expect(etiquettes).not.toContain(e);
      expect(e.length).toBeGreaterThan(0);
    }
  });

  it("candidatures ouvertes : c'est ce qu'une liste doit crier", () => {
    expect(resumeEdition(base({ aujourdhui: "2026-04-01" }))).toBe("Candidatures ouvertes");
  });

  it("sans aucun compteur (une liste n'en charge pas) : jamais de « 0 »", () => {
    expect(resumeEdition(base({ aujourdhui: "2026-12-01" }))).not.toMatch(/\d/);
  });
});

describe("aDesChiffresAAfficher — trois zéros se lisent « ça a raté »", () => {
  it("tout à zéro : la vitrine se tait plutôt que d'annoncer un échec", () => {
    expect(aDesChiffresAAfficher({ inscrites: 0, finalistes: 0, gagnantes: 0 })).toBe(false);
  });

  it.each([
    ["des inscrites, rien d'autre encore", { inscrites: 8, finalistes: 0, gagnantes: 0 }],
    ["des finalistes seules", { inscrites: 0, finalistes: 3, gagnantes: 0 }],
    ["des gagnantes seules", { inscrites: 0, finalistes: 0, gagnantes: 2 }],
  ])("%s : les trois s'affichent, le zéro y devient une étape", (_cas, counts) => {
    expect(aDesChiffresAAfficher(counts)).toBe(true);
  });
});


describe("aUnTremplinADecrire — une année sans Tremplin n'affiche pas son règlement", () => {
  /** Les entrées du prédicat, sur la base d'une édition bouclée et vide. */
  const vide = (o: Partial<Parameters<typeof aUnTremplinADecrire>[0]> = {}) => ({
    statut: "archive",
    finaleDate: null,
    confDate: "2025-11-13",
    inscriptionsDebut: null,
    inscriptionsFin: null,
    aujourdhui: "2026-08-02",
    nbAteliers: 0,
    nbInscrites: 0,
    nbPalmares: 0,
    nbRecompenses: 0,
    nbJury: 0,
    ...o,
  });

  /**
   * 2025 : la communauté est montée sur la scène du DevFest, sans parcours
   * autour. La page promettait pourtant « ce qu'il y a à gagner » et détaillait
   * une soirée pitch qui n'a pas eu lieu.
   */
  it("bouclée et vide : rien à décrire", () => {
    expect(aUnTremplinADecrire(vide())).toBe(false);
  });

  it.each([
    ["une séance au programme", { nbAteliers: 1 }],
    ["une inscrite", { nbInscrites: 1 }],
    ["un palmarès", { nbPalmares: 1 }],
    ["une récompense saisie", { nbRecompenses: 1 }],
    ["un jury saisi et consenti", { nbJury: 1 }],
    ["une soirée finale datée", { finaleDate: "2025-11-20" }],
  ])("bouclée mais avec %s : la page décrit ce qui a eu lieu", (_cas, o) => {
    expect(aUnTremplinADecrire(vide(o))).toBe(true);
  });

  /**
   * Le piège inverse : une édition qui OUVRE ses candidatures n'a encore ni
   * séance ni inscrite, et c'est précisément là que les prix et le format de la
   * soirée donnent envie de postuler.
   */
  it("candidatures ouvertes, encore aucune inscrite : on décrit quand même", () => {
    expect(
      aUnTremplinADecrire(
        vide({
          statut: "ouvert",
          confDate: "2027-11-19",
          inscriptionsDebut: "2027-03-12",
          inscriptionsFin: "2027-04-17",
          aujourdhui: "2027-04-01",
        }),
      ),
    ).toBe(true);
  });

  it("aventure en cours, avant la finale : on décrit aussi", () => {
    expect(
      aUnTremplinADecrire(
        vide({
          statut: "en_cours",
          finaleDate: "2027-06-04",
          confDate: "2027-11-19",
          aujourdhui: "2027-05-01",
        }),
      ),
    ).toBe(true);
  });
});
