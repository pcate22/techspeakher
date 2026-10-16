import { describe, it, expect } from "vitest";
import {
  deriverTaches,
  libelleEcheance,
  libelleEcheanceLong,
  motEcheance,
  reclameUnGeste,
  REGLES_TACHES,
  type EntreesTaches,
  type EditionEntrees,
} from "@/lib/taches";

const AUJOURDHUI = "2026-07-10";
const SEUILS = { slaFicheJours: 15, fenetreAtelierJours: 7 };

/** Édition minimale sans rien à faire ; on surcharge par cas. */
const edition = (o: Partial<EditionEntrees> = {}): EditionEntrees => ({
  id: 1,
  nom: "Tremplin 2026",
  enPreparation: false,
  finaleDate: null,
  ateliers: [],
  participantesSansCompte: [],
  nbRecompensesAAttribuer: 0,
  nbPhotosAccordAConfirmer: 0,
  nbPhotosPrivees: 0,
  ...o,
});

const atelier = (o: Partial<EditionEntrees["ateliers"][number]> = {}) => ({
  id: 10,
  titre: "Pitcher son talk",
  date: "2026-07-13", // dans 3 jours
  dateFin: null,
  nature: "collectif" as const,
  lienVisio: "https://meet.exemple.fr/x",
  coachsTexte: null,
  nbCoachs: 1,
  nbNonPointees: 0,
  ...o,
});

/** File d'arbitrage vide : le défaut de la fabrique, surchargé par cas. */
const FILE_VIDE = { attend: false } as const;

/** Une file à N propositions, la plus vieille datée — et NOMMÉE quand elle est
 * seule (c'est le seul cas où la ligne peut désigner quelqu'un). */
const file = (
  total: number,
  plusAncienne: string,
  seule: { id: number; nom: string; proposeParNom: string | null } | null = null,
) => ({ attend: true as const, total, plusAncienne, seule });

const derive = (e: Partial<EntreesTaches>) =>
  deriverTaches(
    {
      fiches: [],
      fichesEnSommeil: [],
      fichesSansNom: [],
      editions: [],
      articles: [],
      conferencesProposees: FILE_VIDE,
      ...e,
    },
    SEUILS,
    AUJOURDHUI,
  );

/** Un jeu qui déclenche des règles de TOUTES les formes du moteur. Partagé par
 * les cliquets qui balaient l'ensemble des lignes : la famille, le contexte, les
 * mots entiers, les constats. Un seul jeu, donc une seule chose à enrichir quand
 * une forme neuve arrive.
 *
 * `fileGroupee` : la file d'arbitrage a DEUX formes exclusives (une proposition
 * nommée, ou N groupées), et un jeu unique n'en voyait qu'une — un `contexte`
 * posé sur la forme groupée traversait 4 256 tests verts (mesuré par la passe
 * justesse du 2026-08-21). Les cliquets balaient donc les deux. */
const toutesLesFormes = ({ fileGroupee = false } = {}) =>
  derive({
    fiches: [{ id: 1, nom: "Ada Lovelace", submittedAt: "2026-06-01" }],
    fichesEnSommeil: [{ id: 2, nom: "Nawel B." }],
    fichesSansNom: [{ id: 8, titreProfil: "Dev & mentor" }],
    articles: [
      { id: 3, slug: "gerer-le-trac", titre: "Gérer le trac", auteurNom: "Marie Curie", majLe: "2026-06-20" },
    ],
    conferencesProposees: fileGroupee
      ? file(3, "2026-06-25")
      : file(1, "2026-06-25", { id: 4, nom: "DevoxxFR", proposeParNom: "Aurélie V." }),
    editions: [
      edition({
        enPreparation: true,
        // La finale est PASSÉE mais un atelier vit après elle : les
        // récompenses s'attribuent, ses présences restent dues (la péremption
        // ne mange que l'avant-finale), le coach manque, la visio manque.
        finaleDate: "2026-07-01",
        nbRecompensesAAttribuer: 2,
        ateliers: [
          atelier({ id: 10, date: null }),
          atelier({ id: 11, lienVisio: null, nbCoachs: 0 }),
          atelier({ id: 12, titre: "Debrief", date: "2026-07-05", nbNonPointees: 2 }),
        ],
        participantesSansCompte: [{ id: 5, nom: "Camille Rivière" }],
        nbPhotosAccordAConfirmer: 3,
        nbPhotosPrivees: 2,
      }),
    ],
  });

/**
 * La FAMILLE d'une tâche : à qui elle appartient.
 *
 * Une seule liste par personne, trois familles — c'est ce qui permettra
 * d'ajouter les tâches personnelles et celles d'accompagnement sans dupliquer
 * le moteur (conception technique, D1). Ce moteur-ci ne dérive QUE des tâches
 * de l'association, et il doit le dire sur chaque ligne : c'est cette valeur
 * qui décidera plus tard de ce qu'une non-orga a le droit de lire.
 *
 * Des mots ENTIERS (`personnel`, pas `perso`) parce que la valeur devient
 * visible dans la barre d'adresse (`?vue=personnel`), donc dans tout lien
 * partagé — et que `mots-entiers.test.ts` ne peut PAS l'attraper : il ne juge
 * que la prose, et le dit lui-même (« une étiquette d'un seul mot passe entre
 * les mailles »). Ce test-ci est la garde de ce mot-là.
 */
describe("deriverTaches — chaque ligne dit à quelle famille elle appartient", () => {
  it("le jeu d'essai déclenche bien plusieurs formes de règles (jamais à vide)", () => {
    expect(toutesLesFormes().length).toBeGreaterThan(4);
    expect(toutesLesFormes({ fileGroupee: true }).length).toBeGreaterThan(4);
  });

  it("toutes les lignes de CE moteur sont de la famille « association »", () => {
    for (const t of [...toutesLesFormes(), ...toutesLesFormes({ fileGroupee: true })]) {
      expect(t.famille, t.libelle).toBe("association");
    }
  });

  it("le contexte d'une ligne est un nom d'ÉDITION, jamais autre chose", () => {
    // Le digest quotidien PUBLIE `contexte` vers la boîte Gmail partagée de
    // l'association : sa sûreté reposait sur la seule convention « contexte =
    // ed.nom ». Ce cliquet la ferme — une règle future qui y mettrait un nom
    // de personne (coach, participante) tomberait ICI, en amont de l'e-mail
    // (relevé de la passe RGPD du 2026-08-18).
    for (const t of [...toutesLesFormes(), ...toutesLesFormes({ fileGroupee: true })]) {
      if (t.contexte !== undefined) {
        expect(t.contexte, t.libelle).toBe("Tremplin 2026");
      }
    }
  });

  it("la famille est un mot entier, jamais une troncature", () => {
    // « perso » / « coach » sont les troncatures que le dépôt interdit, et
    // celle-ci voyagerait dans une URL partageable.
    for (const t of [...toutesLesFormes(), ...toutesLesFormes({ fileGroupee: true })]) {
      expect(["personnel", "association", "accompagnement"]).toContain(t.famille);
    }
  });
});

describe("deriverTaches — fiches en sommeil", () => {
  it("reste muet quand aucune fiche ne dort", () => {
    expect(derive({}).filter((t) => /sommeil/i.test(t.libelle))).toEqual([]);
  });

  it("pointe DIRECTEMENT la fiche quand il n'y en a qu'une", () => {
    const [t] = derive({ fichesEnSommeil: [{ id: 7, nom: "Ada Lovelace" }] }).filter(
      (x) => /sommeil/i.test(x.libelle),
    );
    expect(t.libelle).toContain("Ada Lovelace");
    expect(t.href).toBe("/speakeuses/7");
    // Aucune échéance : rien ne se périme, l'orga écrit quand elle veut.
    expect(t.echeance).toBeUndefined();
  });

  it("groupe vers la page de relance dès qu'elles sont plusieurs", () => {
    const [t] = derive({
      fichesEnSommeil: [
        { id: 7, nom: "Ada" },
        { id: 8, nom: "Grace" },
      ],
    }).filter((x) => /sommeil/i.test(x.libelle));
    expect(t.libelle).toBe("Relancer 2 fiches en sommeil");
    expect(t.href).toBe("/admin/speakeuses/relances");
  });
});

describe("libelleEcheance (puce dérivée) et son équivalent long", () => {
  it("En retard / Aujourd'hui / N j", () => {
    expect(libelleEcheance("2026-07-08", AUJOURDHUI)).toBe("En retard");
    expect(libelleEcheance("2026-07-10", AUJOURDHUI)).toBe("Aujourd'hui");
    expect(libelleEcheance("2026-07-13", AUJOURDHUI)).toBe("3 j");
  });

  it("version longue sans abréviation (lecteurs d'écran)", () => {
    expect(libelleEcheanceLong("2026-07-08", AUJOURDHUI)).toBe("en retard");
    expect(libelleEcheanceLong("2026-07-11", AUJOURDHUI)).toBe("dans 1 jour");
    expect(libelleEcheanceLong("2026-07-13", AUJOURDHUI)).toBe("dans 3 jours");
  });
});

describe("motEcheance (sous-titre du rappel : mot + drapeau retard)", () => {
  it("En retard (drapeau) / Aujourd'hui / Dans N j", () => {
    expect(motEcheance("2026-07-08", AUJOURDHUI)).toEqual({ texte: "En retard", enRetard: true });
    expect(motEcheance("2026-07-10", AUJOURDHUI)).toEqual({
      texte: "Aujourd'hui",
      enRetard: false,
    });
    expect(motEcheance("2026-07-13", AUJOURDHUI)).toEqual({
      texte: "Dans 3 j",
      enRetard: false,
    });
  });
});

describe("deriverTaches — règle édition en préparation", () => {
  it("édition en préparation → tâche calme « Ouvrir … » vers la sous-page statut", () => {
    const t = derive({ editions: [edition({ enPreparation: true })] });
    expect(t).toHaveLength(1);
    expect(t[0].libelle).toBe("Ouvrir au public l'édition « Tremplin 2026 » du tremplin");
    // Le nom est déjà dans le libellé : pas de contexte redondant sur ce rappel.
    expect(t[0].contexte).toBeUndefined();
    expect(t[0].href).toBe("/admin/tremplins/1/statut");
    expect(t[0].echeance).toBeUndefined();
  });

  it("édition ouverte/en cours : pas de tâche d'ouverture", () => {
    expect(derive({ editions: [edition()] })).toHaveLength(0);
  });
});

describe("deriverTaches — relecture d'articles (lot N3)", () => {
  it("un article en relecture → « Relire l'article d'Ada », vers l'éditeur admin, même SLA que la fiche", () => {
    const t = derive({
      articles: [
        { id: 4, slug: "gerer-le-trac", titre: "Gérer le trac", auteurNom: "Ada", majLe: "2026-07-01T10:00:00Z" },
      ],
    });
    expect(t[0].libelle).toBe("Relire l'article d'Ada");
    expect(t[0].href).toBe("/admin/contenus/publication/gerer-le-trac");
    // Soumis le 01/07 + SLA 15 j = échéance au 16/07.
    expect(t[0].echeance).toBe("2026-07-16");
    expect(t[0].contexte).toBeUndefined();
  });

  it("compte disparu entre soumission et relecture : libellé neutre, la tâche reste", () => {
    const t = derive({
      articles: [{ id: 4, slug: "s", titre: "Sans autrice", auteurNom: null, majLe: "2026-07-01T10:00:00Z" }],
    });
    expect(t[0].libelle).toBe("Relire un article de membre");
  });
});

describe("deriverTaches — conférences proposées (file d'arbitrage)", () => {
  /**
   * LA RÈGLE QUI MANQUAIT. Le 2026-08-21, 113 propositions attendaient dans la
   * file pendant que « À faire » affichait « Tout roule » : `REGLES_TACHES` est
   * une liste FERMÉE, la file d'arbitrage est arrivée après (migrations 041 puis
   * 068), et personne ne l'y avait inscrite.
   */
  const propositions = (t: ReturnType<typeof derive>) =>
    t.filter((x) => x.regle === "valider-conference");

  it("aucune proposition : aucune ligne", () => {
    expect(propositions(derive({}))).toEqual([]);
  });

  it("une seule : elle est NOMMÉE et pointe SA page, au SLA de la fiche", () => {
    const [t] = propositions(
      derive({
        conferencesProposees: file(1, "2026-07-01T09:00:00Z", {
          id: 7,
          nom: "DevoxxFR",
          proposeParNom: "Aurélie V.",
        }),
      }),
    );
    expect(t.libelle).toBe("Valider la conférence «\u00a0DevoxxFR\u00a0» proposée par Aurélie V.");
    expect(t.href).toBe("/admin/conferences/propositions/7");
    // Proposée le 01/07 + SLA 15 j : une soumission de membre attend l'association.
    expect(t.echeance).toBe("2026-07-16");
    // Aucun contexte : ce champ est un nom d'ÉDITION, et c'est le seul champ
    // nominatif que le digest publie (cf. le cliquet RGPD plus haut).
    expect(t.contexte).toBeUndefined();
  });

  it("autrice inconnue (compte supprimé) : libellé neutre, la ligne reste", () => {
    const [t] = propositions(
      derive({
        conferencesProposees: file(1, "2026-07-01", {
          id: 7,
          nom: "DevoxxFR",
          proposeParNom: null,
        }),
      }),
    );
    expect(t.libelle).toBe("Valider la conférence «\u00a0DevoxxFR\u00a0»");
  });

  it("plusieurs : UNE ligne groupée vers la file, à l'urgence de la plus ancienne", () => {
    const t = propositions(
      derive({
        // Trois en file : le résumé ne nomme personne (`seule` reste nulle),
        // et l'urgence est celle de la plus vieille attente — le 20/06.
        conferencesProposees: file(3, "2026-06-20"),
      }),
    );
    // Le motif anti-mur du moteur : 113 lignes datées noieraient la liste.
    expect(t).toHaveLength(1);
    expect(t[0].libelle).toBe("Valider 3 conférences proposées");
    expect(t[0].href).toBe("/admin/conferences/propositions");
    expect(t[0].nb).toBe(3);
    // La plus ancienne (20/06) + 15 j : le retard du groupe est celui du plus
    // vieux, jamais celui du dernier arrivé.
    expect(t[0].echeance).toBe("2026-07-05");
  });

  it("elle RÉCLAME un geste : l'orga referme d'un clic sur l'écran pointé", () => {
    const [t] = propositions(
      derive({
        conferencesProposees: file(1, "2026-07-01", {
          id: 7,
          nom: "DevoxxFR",
          proposeParNom: null,
        }),
      }),
    );
    expect(reclameUnGeste(t)).toBe(true);
  });
});

describe("deriverTaches — contexte d'édition (nom du tremplin)", () => {
  it("les tâches issues d'une édition portent son nom en contexte", () => {
    const t = derive({
      editions: [
        edition({
          nom: "Tremplin DevFest Toulouse 2026",
          finaleDate: "2026-06-04",
          nbRecompensesAAttribuer: 1,
          ateliers: [atelier({ lienVisio: null })],
          participantesSansCompte: [{ id: 9, nom: "Manon" }],
        }),
      ],
    });
    expect(t.length).toBeGreaterThan(0);
    expect(t.every((x) => x.contexte === "Tremplin DevFest Toulouse 2026")).toBe(true);
  });

  it("une tâche de fiche speakeuse n'a pas de contexte d'édition", () => {
    const t = derive({ fiches: [{ id: 1, nom: "Ada", submittedAt: null }] });
    expect(t[0].contexte).toBeUndefined();
  });
});

describe("deriverTaches — règles ateliers (fenêtre 7 j)", () => {
  it("atelier imminent sans lien visio → tâche datée vers la fiche atelier", () => {
    const t = derive({ editions: [edition({ ateliers: [atelier({ lienVisio: null })] })] });
    expect(t).toHaveLength(1);
    expect(t[0].libelle).toBe("Ajouter le lien visio de « Pitcher son talk »");
    expect(t[0].href).toBe("/admin/tremplins/1/ateliers/10/visio");
    expect(t[0].echeance).toBe("2026-07-13");
  });

  it("hors fenêtre (8 j) ou passé : la règle visio ne sonne pas", () => {
    expect(derive({ editions: [edition({ ateliers: [atelier({ lienVisio: null, date: "2026-07-18" })] })] })).toHaveLength(0);
    expect(derive({ editions: [edition({ ateliers: [atelier({ lienVisio: null, date: "2026-07-09" })] })] })).toHaveLength(0);
  });

  it("à exactement 7 jours : dans la fenêtre", () => {
    const t = derive({ editions: [edition({ ateliers: [atelier({ lienVisio: null, date: "2026-07-17" })] })] });
    expect(t).toHaveLength(1);
  });

  it("sans coach : table vide ET texte libre vide seulement (repli hérité)", () => {
    expect(
      derive({ editions: [edition({ ateliers: [atelier({ nbCoachs: 0, coachsTexte: "Ada (texte)" })] })] }),
    ).toHaveLength(0);
    const t = derive({ editions: [edition({ ateliers: [atelier({ nbCoachs: 0, coachsTexte: "  " })] })] });
    expect(t[0].libelle).toBe("Trouver un coach pour « Pitcher son talk »");
  });

  it("atelier passé avec présences non pointées → tâche « En retard »", () => {
    const t = derive({
      editions: [edition({ ateliers: [atelier({ date: "2026-07-01", nbNonPointees: 2 })] })],
    });
    expect(t[0].libelle).toBe("Pointer les présences de « Pitcher son talk »");
    expect(libelleEcheance(t[0].echeance!, AUJOURDHUI)).toBe("En retard");
  });

  it("atelier sans date : aucune règle datée, mais une tâche calme « Donner une date »", () => {
    const t = derive({
      editions: [edition({ ateliers: [atelier({ date: null, lienVisio: null, nbNonPointees: 3 })] })],
    });
    // Un atelier sans date ne doit pas être invisible : le dater est résoluble.
    expect(t).toHaveLength(1);
    expect(t[0].libelle).toBe("Donner une date à «\u00a0Pitcher son talk\u00a0»");
    expect(t[0].href).toBe("/admin/tremplins/1/ateliers/10/infos");
    expect(t[0].echeance).toBeUndefined();
    // Une date est ATTENDUE mais absente → drapeau « à dater » (pastille « ? »),
    // distinct d'une tâche sans notion de date (« Relier … », « Ouvrir … »).
    expect(t[0].dateAFixer).toBe(true);
  });

  it("une tâche sans notion de date (relier un compte) n'est pas « à dater »", () => {
    const t = derive({
      editions: [edition({ participantesSansCompte: [{ id: 9, nom: "Manon" }] })],
    });
    expect(t[0].dateAFixer).toBeUndefined();
  });
});

describe("deriverTaches — fiches (SLA), récompenses, non datées", () => {
  it("fiche en attente : échéance = soumission + 15 j, nommée, lien direct vers la fiche", () => {
    const t = derive({
      fiches: [{ id: 42, nom: "Ada Lovelace", submittedAt: "2026-07-05T10:00:00Z" }],
    });
    expect(t[0].libelle).toBe("Valider la fiche d'Ada Lovelace");
    expect(t[0].echeance).toBe("2026-07-20");
    expect(t[0].href).toBe("/speakeuses/42");
  });

  it("SLA en heure de Paris : soumise à 00 h 30 Paris (22 h 30 UTC la veille), l'échéance ne recule pas d'un jour", () => {
    // 2026-07-04T22:30Z = 2026-07-05 00:30 à Paris (été) → échéance 05 + 15 = 20.
    const t = derive({
      fiches: [{ id: 1, nom: "Ada", submittedAt: new Date("2026-07-04T22:30:00Z") }],
    });
    expect(t[0].echeance).toBe("2026-07-20");
  });

  it("fiche sans nom ni date de soumission : tâche non datée, libellé générique", () => {
    const t = derive({ fiches: [{ id: 1, nom: null, submittedAt: null }] });
    expect(t[0].libelle).toBe("Valider une fiche speakeuse");
    expect(t[0].echeance).toBeUndefined();
  });

  it("récompenses à attribuer APRÈS la finale seulement", () => {
    expect(
      derive({ editions: [edition({ finaleDate: "2026-09-01", nbRecompensesAAttribuer: 2 })] }),
    ).toHaveLength(0);
    const t = derive({ editions: [edition({ finaleDate: "2026-06-04", nbRecompensesAAttribuer: 2 })] });
    expect(t[0].libelle).toBe("Attribuer 2 récompenses");
    expect(t[0].href).toBe("/admin/tremplins/1/recompenses");
  });

  it("plusieurs sans compte + photos bloquées : agrégées (compte), vers la liste", () => {
    const sansCompte = [
      { id: 11, nom: "Ada" },
      { id: 12, nom: "Grace" },
      { id: 13, nom: "Manon" },
    ];
    const t = derive({
      editions: [edition({ participantesSansCompte: sansCompte, nbPhotosPrivees: 1 })],
    });
    expect(t.map((x) => x.libelle)).toEqual([
      "Relier 3 participantes à un compte",
      "1 photo reste privée",
    ]);
    // Plusieurs → la liste réduite aux concernées (on choisit laquelle relier,
    // sans éplucher toutes les inscrites).
    expect(t[0].href).toBe("/admin/tremplins/1/participantes?vue=sans-compte");
    expect(t.every((x) => x.echeance === undefined)).toBe(true);
  });

  it("une seule sans compte : la NOMME et va DROIT à sa sous-page compte", () => {
    const t = derive({
      editions: [edition({ participantesSansCompte: [{ id: 42, nom: "Manon Girard" }] })],
    });
    expect(t).toHaveLength(1);
    expect(t[0].libelle).toBe("Relier Manon Girard à un compte");
    expect(t[0].href).toBe("/admin/tremplins/1/participantes/42/compte");
    expect(t[0].echeance).toBeUndefined();
  });
});

describe("deriverTaches — activités à période (lot B : la fenêtre EST sa date)", () => {
  it("fenêtre EN COURS : « pointer les présences » attend la FIN (pas le début)", () => {
    // Du 7 au 13, aujourd'hui le 10 : la revue est en cours, rien à pointer.
    expect(
      derive({
        editions: [edition({ ateliers: [atelier({ date: "2026-07-07", dateFin: "2026-07-13", nbNonPointees: 2 })] })],
      }),
    ).toHaveLength(0);
  });

  it("fenêtre passée : la tâche présences sonne, échéance = la FIN de la fenêtre", () => {
    const t = derive({
      editions: [edition({ ateliers: [atelier({ date: "2026-07-01", dateFin: "2026-07-08", nbNonPointees: 2 })] })],
    });
    expect(t).toHaveLength(1);
    expect(t[0].libelle).toBe("Pointer les présences de «\u00a0Pitcher son talk\u00a0»");
    expect(t[0].echeance).toBe("2026-07-08");
  });
});

describe("deriverTaches — nature de l'atelier (lot B : fini les fausses alertes)", () => {
  it("atelier en SOUS-GROUPES : ni visio, ni coach, ni présences à réclamer", () => {
    // Lien et coach vivent PAR sous-groupe ; l'autonomie est un état normal.
    expect(
      derive({
        editions: [
          edition({
            ateliers: [
              atelier({ nature: "sous_groupes", lienVisio: null, nbCoachs: 0 }),
              atelier({ id: 11, nature: "sous_groupes", date: "2026-07-01", nbNonPointees: 3 }),
            ],
          }),
        ],
      }),
    ).toHaveLength(0);
  });

  it("atelier en sous-groupes SANS date : « donner une date » reste (une fenêtre se cale)", () => {
    const t = derive({
      editions: [edition({ ateliers: [atelier({ nature: "sous_groupes", date: null })] })],
    });
    expect(t).toHaveLength(1);
    expect(t[0].dateAFixer).toBe(true);
  });
});

describe("deriverTaches — regroupement par type (lot B : fini le mur de cartes)", () => {
  it("plusieurs ateliers passés à pointer → UNE ligne groupée vers la liste des ateliers", () => {
    const t = derive({
      editions: [
        edition({
          ateliers: [
            atelier({ id: 11, titre: "Un", date: "2026-07-01", nbNonPointees: 1 }),
            atelier({ id: 12, titre: "Deux", date: "2026-07-03", nbNonPointees: 2 }),
            atelier({ id: 13, titre: "Trois", date: "2026-07-05", nbNonPointees: 1 }),
          ],
        }),
      ],
    });
    expect(t).toHaveLength(1);
    expect(t[0].libelle).toBe("Compléter les présences de 3 ateliers passés");
    // La VUE de la liste, pas son sommet : la tâche dit quoi faire ET où.
    expect(t[0].href).toBe("/admin/tremplins/1/ateliers?vue=presences");
    // L'urgence du groupe = le retard le plus ancien.
    expect(t[0].echeance).toBe("2026-07-01");
  });

  it("un seul atelier à pointer : la ligne directe (nommée) est conservée", () => {
    const t = derive({
      editions: [edition({ ateliers: [atelier({ date: "2026-07-01", nbNonPointees: 1 })] })],
    });
    expect(t[0].libelle).toBe("Pointer les présences de «\u00a0Pitcher son talk\u00a0»");
    expect(t[0].href).toBe("/admin/tremplins/1/ateliers/10/presences");
  });

  it("plusieurs ateliers sans date → UNE ligne groupée « à dater » vers la liste", () => {
    const t = derive({
      editions: [
        edition({
          ateliers: [
            atelier({ id: 11, titre: "Un", date: null }),
            atelier({ id: 12, titre: "Deux", date: null }),
          ],
        }),
      ],
    });
    expect(t).toHaveLength(1);
    expect(t[0].libelle).toBe("Donner une date à 2 ateliers");
    expect(t[0].href).toBe("/admin/tremplins/1/ateliers?vue=a-dater");
    expect(t[0].dateAFixer).toBe(true);
  });
});

describe("deriverTaches — péremption post-finale (lot B)", () => {
  it("finale passée : les présences des ateliers d'AVANT-finale ne réclament plus", () => {
    expect(
      derive({
        editions: [
          edition({
            finaleDate: "2026-06-04", // passée
            ateliers: [atelier({ date: "2026-04-28", nbNonPointees: 3 })],
          }),
        ],
      }),
    ).toHaveLength(0);
  });

  it("après la finale, un atelier de phase 3 passé garde sa tâche présences", () => {
    const t = derive({
      editions: [
        edition({
          finaleDate: "2026-06-04",
          ateliers: [atelier({ date: "2026-07-01", nbNonPointees: 2 })],
        }),
      ],
    });
    expect(t.map((x) => x.libelle)).toEqual(["Pointer les présences de «\u00a0Pitcher son talk\u00a0»"]);
  });

  it("finale à venir : rien ne périme", () => {
    const t = derive({
      editions: [
        edition({
          finaleDate: "2026-09-01",
          ateliers: [atelier({ date: "2026-07-01", nbNonPointees: 2 })],
        }),
      ],
    });
    expect(t).toHaveLength(1);
  });
});

describe("deriverTaches — tri à deux étages", () => {
  it("datées par échéance croissante (retard en tête), puis non datées", () => {
    const t = derive({
      fiches: [{ id: 1, nom: "Ada", submittedAt: "2026-07-01T00:00:00Z" }], // échéance 16/07
      editions: [
        edition({
          ateliers: [
            atelier({ id: 11, titre: "Passé", date: "2026-07-01", nbNonPointees: 1 }),
            atelier({ id: 12, titre: "Bientôt", date: "2026-07-12", lienVisio: null }),
          ],
          participantesSansCompte: [
            { id: 21, nom: "Ada" },
            { id: 22, nom: "Grace" },
          ],
        }),
      ],
    });
    expect(t.map((x) => x.libelle)).toEqual([
      "Pointer les présences de « Passé »",
      "Ajouter le lien visio de « Bientôt »",
      "Valider la fiche d'Ada",
      "Relier 2 participantes à un compte",
    ]);
  });
});

/**
 * CE QUI ALLUME LE POINT, et ce qui informe seulement.
 *
 * Règle tranchée par Cateline le 2026-08-17 (`docs/principes-conception-ui.md`,
 * corollaire du compteur) : ce qui s'allume ne signale QUE ce qu'un geste de la
 * personne qui le voit peut refermer. Le critère est **qui referme**, pas
 * quand : une action à faire dans dix jours reste une chose à faire, elle
 * allume.
 *
 * Sans cette règle, une ligne du moteur restait allumée à vie et le point ne
 * s'éteignait jamais — une liste qui ne peut pas finir (COGA) et un signal dont
 * on apprend à se méfier.
 *
 * Le porteur est un CHAMP, `constat`, jamais une reconnaissance de libellé :
 * une règle qui change de mots changerait de sens sans qu'un test bronche.
 *
 * ⚠ CE FICHIER A DÉJÀ GARDÉ LA MAUVAISE RÉPONSE. La première version marquait
 * `constat` sur « Relier X à un compte » et sur TOUTES les photos bloquées, et
 * ses tests tenaient très bien cette erreur. Deux relectures autonomes l'ont
 * défaite le même jour, en ouvrant l'écran que chaque ligne POINTE :
 * `AttachForm` relie un compte existant en un clic, et la case « Accord
 * recueilli » de la page photo est un geste d'orga. La leçon est écrite ici
 * plutôt qu'en note de version parce que c'est ici qu'on la rejouerait : « qui
 * referme » se lit sur l'écran d'arrivée, jamais sur l'intuition du domaine.
 */
describe("deriverTaches — les constats informent, ils ne réclament rien", () => {
  const constats = (t: ReturnType<typeof derive>) =>
    t.filter((x) => x.constat).map((x) => x.libelle);

  it("« Relier X à un compte » ALLUME : l'orga relie un compte existant en un clic", () => {
    // `attachUserToRegistration` écrit `"userId"` dans les DEUX branches de
    // l'écran — compte choisi dans la recherche, ou compte pré-créé par
    // invitation — et la règle dérive de `!r.userId`. La première connexion
    // sert à ce que la participante VOIE son espace, pas au rattachement.
    const une = derive({
      editions: [edition({ participantesSansCompte: [{ id: 42, nom: "Manon Girard" }] })],
    });
    expect(une[0].libelle).toBe("Relier Manon Girard à un compte");
    expect(constats(une)).toEqual([]);

    // La forme groupée aussi : c'est la même règle, pas une autre.
    const plusieurs = derive({
      editions: [
        edition({
          participantesSansCompte: [
            { id: 11, nom: "Ada" },
            { id: 12, nom: "Grace" },
          ],
        }),
      ],
    });
    expect(constats(plusieurs)).toEqual([]);
  });

  it("les photos bloquées se dédoublent : un geste d'orga d'un côté, un constat de l'autre", () => {
    // `photoPubliable` fond deux mécanismes en un booléen. Les compter ensemble
    // éteignait le point sur un travail d'un clic.
    const t = derive({
      editions: [edition({ nbPhotosAccordAConfirmer: 3, nbPhotosPrivees: 2 })],
    });
    expect(t.map((x) => x.libelle)).toEqual([
      "Recueillir l'accord pour 3 photos",
      "2 photos restent privées",
    ]);
    expect(constats(t)).toEqual(["2 photos restent privées"]);
    expect(t.every((x) => x.href === "/admin/tremplins/1/photos")).toBe(true);
  });

  it("l'accord à recueillir ALLUME : la case se coche dans l'app", () => {
    const t = derive({ editions: [edition({ nbPhotosAccordAConfirmer: 1 })] });
    expect(t.map((x) => x.libelle)).toEqual(["Recueillir l'accord pour 1 photo"]);
    expect(constats(t)).toEqual([]);
  });

  it("les photos privées n'allument RIEN : leur accord tient au réglage de l'inscrite", () => {
    const t = derive({ editions: [edition({ nbPhotosPrivees: 2 })] });
    expect(t.map((x) => x.libelle)).toEqual(["2 photos restent privées"]);
    expect(t[0].constat).toBe(true);
  });

  it("le singulier s'accorde", () => {
    const t = derive({ editions: [edition({ nbPhotosPrivees: 1 })] });
    expect(t[0].libelle).toBe("1 photo reste privée");
  });

  it("le constat photo dit ce qui EST : forme positive, aucun impératif", () => {
    // Un constat qui réclamerait ferait redemander un accord parfois DÉJÀ
    // refusé — le défaut même que la ligne existe pour corriger.
    const [t] = derive({ editions: [edition({ nbPhotosPrivees: 3 })] });
    expect(t.libelle).not.toMatch(/\bne\b.*\b(pas|plus)\b/i);
    expect(t.libelle).not.toMatch(/^(Recueillir|Obtenir|Demander|Relancer|Confirmer)\b/);
  });

  it("« Ouvrir au public » ALLUME : une orga la referme d'un geste", () => {
    // Elle est en dette (les dates d'ouverture la disent déjà) — mais tant
    // qu'elle existe, elle est refermable, donc elle allume. La règle du point
    // ne porte aucun cas particulier ; c'est la tâche qui disparaîtra.
    const t = derive({ editions: [edition({ enPreparation: true })] });
    expect(t).toHaveLength(1);
    expect(t[0].constat).toBeUndefined();
  });

  it("la liste fermée des constats : DEUX règles, et pas une de plus", () => {
    // Le cliquet. Un jeu qui déclenche toutes les formes du moteur ; si une
    // règle neuve se déclare `constat`, ou si l'une d'elles cesse de l'être,
    // ce test tombe — et personne ne rallume le point à vie par distraction.
    // nommer-fiche a rejoint photos-privees le 2026-08-22 : dans les deux cas
    // le geste appartient à quelqu'un d'autre que l'orga qui voit le point.
    expect(constats(toutesLesFormes())).toEqual([
      "La fiche « Dev & mentor » est publiée sans nom réel",
      "2 photos restent privées",
    ]);
  });

  it("`reclameUnGeste` est le prédicat, et il dit l'inverse de `constat`", () => {
    // Une seule définition pour les quatre surfaces qui posent la question.
    const t = toutesLesFormes();
    expect(t.filter(reclameUnGeste)).toHaveLength(t.length - 2);
    expect(t.filter(reclameUnGeste).every((x) => x.constat === undefined)).toBe(true);
  });
});

/**
 * CHAQUE LIGNE DIT SA RÈGLE (étape C). Le digest quotidien compte « par
 * règle » sans recompter la base : la règle voyage donc SUR la tâche, comme
 * la famille — c'est ce qui fait de l'e-mail un canal du moteur, jamais une
 * seconde définition. La liste est FERMÉE (`RegleTache`) : une règle neuve
 * sans libellé d'agrégat dans le digest est une erreur de COMPILATION
 * (le précédent Brevo du registre : la garde d'exhaustivité qui manquait).
 */
describe("deriverTaches — chaque ligne dit sa règle, en liste fermée", () => {
  it("le jeu complet déclenche TOUTES les règles du moteur — l'attendu se dérive, jamais recopié", () => {
    // L'égalité d'ensembles avec REGLES_TACHES : une règle neuve qui
    // n'entrerait ni dans le jeu ni dans le registre ferait tomber ce test —
    // une liste recopiée à la main laissait trois règles sans aucune garde
    // (relevé par la passe justesse du 2026-08-18 : estampiller les présences
    // « dater-atelier » compilait et passait toute la suite).
    const declenchees = new Set(toutesLesFormes().map((t) => t.regle));
    const attendues = REGLES_TACHES.filter(
      // La seule règle HORS moteur : dérivée dans taches-chargement, gardée
      // par le banc du cron.
      (r) => r !== "moderer-messages",
    );
    expect([...declenchees].sort()).toEqual([...attendues].sort());
  });

  it("une fiche publiée sans nom est un CONSTAT vers la fiche : le geste est à la speakeuse", () => {
    // L'invariant de #233 rendu visible (dette P1) : une fiche migrée peut
    // être publiée avec un nom vide — l'affichage a son repli (nomAffiche),
    // et CE canal dit à l'orga où en est la cohorte. CONSTAT, pas geste : le
    // nom s'écrit en self-service sur le compte, aucun geste d'orga sur
    // l'écran pointé ne referme la ligne (précédent « photos privées »,
    // 2026-08-17 — la 4e passe du 2026-08-22 l'a confronté à l'écran).
    const t = derive({ fichesSansNom: [{ id: 9, titreProfil: "Dev & mentor" }] });
    const tache = t.find((x) => x.regle === "nommer-fiche");
    expect(tache?.libelle).toBe("La fiche « Dev & mentor » est publiée sans nom réel");
    expect(tache?.href).toBe("/speakeuses/9");
    expect(tache?.constat).toBe(true);
  });

  it("une fiche sans nom NI titre garde un libellé qui dit la fiche", () => {
    const t = derive({ fichesSansNom: [{ id: 9, titreProfil: null }] });
    expect(t.find((x) => x.regle === "nommer-fiche")?.libelle).toBe(
      "Une fiche est publiée sans nom réel",
    );
  });

  it("plusieurs fiches sans nom : UNE ligne par fiche, chacune vers la sienne", () => {
    // Pas de ligne groupée vers le roster : il affiche nomAffiche, le repli
    // y masque exactement le défaut cherché — l'orga ne retrouverait pas les
    // fiches (4e passe du 2026-08-22). Chaque fiche vit sur sa propre page.
    const t = derive({
      fichesSansNom: [
        { id: 9, titreProfil: null },
        { id: 10, titreProfil: "Coach agile" },
      ],
    }).filter((x) => x.regle === "nommer-fiche");
    expect(t.map((x) => x.href)).toEqual(["/speakeuses/9", "/speakeuses/10"]);
    expect(t.every((x) => x.constat)).toBe(true);
  });

  it("`nb` dit combien de cibles vivent derrière une ligne groupée", () => {
    const t = derive({
      editions: [
        edition({
          participantesSansCompte: [
            { id: 1, nom: "Ada" },
            { id: 2, nom: "Grace" },
            { id: 3, nom: "Manon" },
          ],
        }),
      ],
    });
    expect(t[0].regle).toBe("relier-compte");
    expect(t[0].nb).toBe(3);
    // Une ligne directe : nb absent vaut UN, jamais « peut-être ».
    const une = derive({ fiches: [{ id: 1, nom: "Ada", submittedAt: null }] });
    expect(une[0].nb).toBeUndefined();
  });
});
