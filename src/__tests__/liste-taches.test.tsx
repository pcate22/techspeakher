import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ListeTaches from "@/components/ListeTaches";
import type { Tache } from "@/lib/taches";

afterEach(cleanup);

const AUJ = "2026-07-25";

/**
 * Ce fichier juge l'AFFICHAGE d'une tâche : la famille n'y change rien. On la
 * fournit donc en un seul endroit, plutôt que de la recopier sur chaque
 * fixture — quinze copies d'une valeur que le test ne regarde pas.
 */
type TacheEssai = Omit<Tache, "famille" | "regle"> & { regle?: Tache["regle"] };
const avecFamille = (ts: TacheEssai[]): Tache[] =>
  ts.map((t) => ({
    ...t,
    famille: "association" as const,
    // Ce banc juge l'AFFICHAGE : la règle n'y change rien, on la fournit
    // comme la famille — en un seul endroit, pas quinze copies.
    regle: t.regle ?? ("valider-fiche" as const),
  }));

describe("ListeTaches — rappels du tableau de bord (vue mobile)", () => {
  it("tâche datée : date en texte à droite (« mar. 28 avr. »), urgence dite, contexte lisible", () => {
    const taches: TacheEssai[] = [
      {
        libelle: "Pointer les présences de « Trouver son sujet »",
        href: "/admin/tremplins/1/ateliers/10/presences",
        echeance: "2026-04-28",
        contexte: "Tremplin DevFest Toulouse 2026",
      },
    ];
    render(<ListeTaches taches={avecFamille(taches)} aujourdhui={AUJ} vide="Rien" />);
    // Date de liste en TEXTE (exit la pastille carrée) : jour de semaine court,
    // jour, mois court — sans année (même année que la référence).
    expect(screen.getByText(/mar\. 28 avr\./)).toBeInTheDocument();
    // Urgence en toutes lettres (jamais la couleur seule) + contexte lisible.
    expect(screen.getByText("En retard")).toBeInTheDocument();
    expect(screen.getByText("Tremplin DevFest Toulouse 2026")).toBeInTheDocument();
    // Échéance datée accessible aux lecteurs d'écran (mois non abrégé + urgence).
    expect(screen.getByText(/28 avril 2026, en retard/)).toBeInTheDocument();
  });

  it("le titre du rappel n'est pas tronqué (aucun truncate / line-clamp)", () => {
    const taches: TacheEssai[] = [
      {
        libelle: "Pointer les présences de « Proposer son sujet : le CFP »",
        href: "/x",
        echeance: "2026-05-12",
        contexte: "Tremplin DevFest Toulouse 2026",
      },
    ];
    render(<ListeTaches taches={avecFamille(taches)} aujourdhui={AUJ} vide="Rien" />);
    const titre = screen.getByText("Pointer les présences de « Proposer son sujet : le CFP »");
    expect(titre.className).not.toContain("truncate");
    expect(titre.className).not.toContain("line-clamp");
  });

  it("tâche résoluble sans date : aucune date à droite, contexte seul", () => {
    const taches: TacheEssai[] = [
      { libelle: "Relier Manon à un compte", href: "/x", contexte: "Tremplin 2026" },
    ];
    render(<ListeTaches taches={avecFamille(taches)} aujourdhui={AUJ} vide="Rien" />);
    expect(screen.queryByText(/à dater/)).toBeNull();
    expect(screen.queryByText(/En retard|Aujourd'hui|Dans \d/)).toBeNull();
    expect(screen.getByText("Tremplin 2026")).toBeInTheDocument();
  });

  it("tâche à dater (atelier sans date) : « à dater » en toutes lettres à droite", () => {
    const taches: TacheEssai[] = [
      {
        libelle: "Donner une date à « Préparer ses slides »",
        href: "/x",
        dateAFixer: true,
        contexte: "Tremplin 2026",
      },
    ];
    render(<ListeTaches taches={avecFamille(taches)} aujourdhui={AUJ} vide="Rien" />);
    expect(screen.getByText("à dater")).toBeInTheDocument();
    expect(screen.getByText("Tremplin 2026")).toBeInTheDocument();
  });

  it("plafond (lot B) : au-delà de max, le reste se replie derrière « Voir les N autres »", () => {
    const taches: TacheEssai[] = [1, 2, 3, 4, 5].map((i) => ({
      libelle: `Tâche ${i}`,
      href: `/t/${i}`,
    }));
    render(<ListeTaches taches={avecFamille(taches)} aujourdhui={AUJ} vide="Rien" max={3} />);
    expect(screen.getByText("Tâche 3")).toBeInTheDocument();
    // Les suivantes existent dans le repli (details), annoncé avec leur compte.
    expect(screen.getByText("Voir les 2 autres tâches")).toBeInTheDocument();
    expect(screen.getByText("Tâche 4")).toBeInTheDocument();
  });

  it("plafond : une seule ligne au-delà de max s'affiche telle quelle (repli plus lourd qu'elle)", () => {
    const taches: TacheEssai[] = [1, 2, 3, 4].map((i) => ({
      libelle: `Tâche ${i}`,
      href: `/t/${i}`,
    }));
    render(<ListeTaches taches={avecFamille(taches)} aujourdhui={AUJ} vide="Rien" max={3} />);
    expect(screen.getByText("Tâche 4")).toBeInTheDocument();
    expect(screen.queryByText(/Voir les .* autres/)).toBeNull();
  });

  it("montreContexte=false (hub d'une édition) masque le nom, garde la date", () => {
    const taches: TacheEssai[] = [
      {
        libelle: "Pointer les présences de « Trouver son sujet »",
        href: "/x",
        echeance: "2026-04-28",
        contexte: "Tremplin 2026",
      },
    ];
    render(
      <ListeTaches taches={avecFamille(taches)} aujourdhui={AUJ} vide="Rien" montreContexte={false} />,
    );
    expect(screen.queryByText("Tremplin 2026")).toBeNull();
    expect(screen.getByText("En retard")).toBeInTheDocument();
    expect(screen.getByText(/28 avr\./)).toBeInTheDocument();
  });
});

/**
 * LES CONSTATS À L'ÉCRAN — « Pour information ».
 *
 * Toutes les autres lignes du moteur commencent par un verbe à l'infinitif
 * (« Valider… », « Pointer… », « Recueillir… »). Sous un titre « À faire »,
 * « 2 photos restent privées » se lit d'abord comme une action dont le verbe
 * manque. Il faut donc une marque — en TEXTE, jamais une nuance de couleur
 * (RGAA 1.4.1), et lisible aussi à l'oreille.
 *
 * Relevé par la relecture UX/RGAA du 2026-08-17, sur une ligne que les trois
 * autres passes avaient jugée bonne : aucune ne regarde l'écran.
 */
describe("ListeTaches — une ligne qui informe le dit, à l'œil comme à l'oreille", () => {
  const constat: TacheEssai[] = [
    { libelle: "2 photos restent privées", href: "/admin/tremplins/1/photos", constat: true },
  ];

  it("porte l'étiquette « Pour information » en toutes lettres", () => {
    render(<ListeTaches taches={avecFamille(constat)} aujourdhui={AUJ} vide="Rien" />);
    expect(screen.getByText("Pour information")).toBeInTheDocument();
  });

  it("et le dit AUSSI aux lecteurs d'écran, en une phrase entière", () => {
    // Une phrase, pas un fragment : un `sr-only` se recolle au libellé sans
    // séparateur (précédent « Modifier le talk » du registre des erreurs).
    render(<ListeTaches taches={avecFamille(constat)} aujourdhui={AUJ} vide="Rien" />);
    const equivalent = screen.getByText(/Pour information.*aucun geste/);
    expect(equivalent).toBeInTheDocument();
    expect(equivalent.textContent).toMatch(/^Pour information/);
  });

  it("une vraie tâche ne porte RIEN de tout ça", () => {
    const tache: TacheEssai[] = [{ libelle: "Valider la fiche d'Ada", href: "/speakeuses/1" }];
    render(<ListeTaches taches={avecFamille(tache)} aujourdhui={AUJ} vide="Rien" />);
    expect(screen.queryByText(/Pour information/)).toBeNull();
  });
});

/**
 * L'ÉTIQUETTE DE FAMILLE — « pour qui est-ce ? » (B5).
 *
 * Les mêmes mots que les puces, à la même condition qu'elles (la page a ≥ 2
 * familles, aucune vue active) : dans une vue filtrée, chaque ligne dirait le
 * nom de la vue — un mot qui ne distingue rien (C6). C'est la PAGE qui décide
 * (elle seule connaît la vue) ; le composant reçoit un booléen.
 */
describe("ListeTaches — l'étiquette de famille dit pour qui", () => {
  const deuxFamilles: Tache[] = [
    { libelle: "Valider la fiche d'Ada", href: "/speakeuses/1", famille: "association", regle: "valider-fiche" },
    { libelle: "Répondre à Camille", href: "/mon-espace/messages", famille: "personnel", regle: "valider-fiche" },
  ];

  it("montreFamilles : chaque ligne porte le mot de sa famille", () => {
    render(
      <ListeTaches taches={deuxFamilles} aujourdhui={AUJ} vide="Rien" montreFamilles />,
    );
    expect(screen.getByText("Pour l'association")).toBeInTheDocument();
    expect(screen.getByText("Pour moi")).toBeInTheDocument();
  });

  it("sans le drapeau : aucune étiquette (une famille unique n'a rien à distinguer)", () => {
    render(<ListeTaches taches={deuxFamilles} aujourdhui={AUJ} vide="Rien" />);
    expect(screen.queryByText("Pour l'association")).toBeNull();
    expect(screen.queryByText("Pour moi")).toBeNull();
  });

  it("l'étiquette cohabite avec « Pour information » sans l'écraser", () => {
    const constat: Tache[] = [
      {
        libelle: "2 photos restent privées",
        href: "/admin/tremplins/1/photos",
        famille: "association",
        regle: "photos-privees",
        constat: true,
      },
    ];
    render(<ListeTaches taches={constat} aujourdhui={AUJ} vide="Rien" montreFamilles />);
    expect(screen.getByText("Pour l'association")).toBeInTheDocument();
    expect(screen.getByText("Pour information")).toBeInTheDocument();
  });
});
