import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/mon-espace/actions", () => ({
  addTalkAction: vi.fn(),
  updateTalkAction: vi.fn(),
  addOccurrenceAction: vi.fn(),
  updateOccurrenceAction: vi.fn(),
}));

import TalkForm from "@/app/mon-espace/TalkForm";
import OccurrenceForm from "@/app/mon-espace/OccurrenceForm";
import type { Talk, OccurrenceSuggestions } from "@/lib/talks";

afterEach(cleanup);

const talk: Talk = {
  id: 5,
  profileId: 2,
  titre: "L'IA à l'épreuve du monde physique",
  type: "Meetup",
  description: "Un retour d'expérience.",
  occurrences: [],
};

describe("TalkForm (identité du talk)", () => {
  it("mode création : champs vides + bouton « Créer le talk »", () => {
    render(<TalkForm />);
    expect(screen.getByLabelText(/titre du talk/i)).toHaveValue("");
    expect(screen.getByLabelText(/^type$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^description$/i)).toHaveValue("");
    // Les conférences (occurrences) se rattachent APRÈS création, sur la page
    // du talk : le formulaire d'identité reste minimal.
    expect(screen.queryByLabelText(/conférence/i)).toBeNull();
    expect(screen.queryByLabelText(/lien slides/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: /créer le talk/i }),
    ).toBeInTheDocument();
  });

  it("mode édition : pré-remplit l'identité + bouton « Enregistrer »", () => {
    render(<TalkForm initial={talk} />);
    expect(screen.getByLabelText(/titre du talk/i)).toHaveValue(
      "L'IA à l'épreuve du monde physique",
    );
    expect(screen.getByLabelText(/^type$/i)).toHaveValue("Meetup");
    expect(screen.getByLabelText(/^description$/i)).toHaveValue(
      "Un retour d'expérience.",
    );
    expect(
      screen.getByRole("button", { name: /enregistrer les modifications/i }),
    ).toBeInTheDocument();
  });
});

describe("OccurrenceForm — conférence choisie dans le registre (pré-remplissage + ids)", () => {
  const suggestions: OccurrenceSuggestions = {
    registre: [
      {
        id: 1,
        nom: "Sunny Tech",
        ville: "Montpellier",
        pays: "France",
        editions: [
          {
            editionId: 42,
            conferenceId: 1,
            libelle: "Sunny Tech 2026",
            ville: "Montpellier",
            pays: "France",
            url: "https://sunny-tech.io",
            dateDebut: null,
            dateFin: null,
          },
        ],
      },
      { id: 2, nom: "DevFest Toulouse", ville: "Toulouse", pays: "France", editions: [] },
    ],
    villes: ["Toulouse"],
    pays: ["France"],
  };

  const hidden = (name: string) =>
    document.querySelector(`input[name="${name}"]`);

  function renderForm() {
    render(
      <OccurrenceForm
        talkId={5}
        suggestions={suggestions}
      />,
    );
  }

  /** Choisit dans le combobox (clic → option), comme au doigt ou au clavier. */
  async function choisirConference(
    u: ReturnType<typeof userEvent.setup>,
    nom: RegExp,
  ) {
    await u.click(screen.getByRole("combobox", { name: /conférence/i }));
    await u.click(screen.getByRole("option", { name: nom }));
  }

  it("choisir une conférence pose conferenceId et pré-remplit les champs vides", async () => {
    const u = userEvent.setup();
    renderForm();
    await choisirConference(u, /sunny tech/i);

    expect(hidden("conferenceId")).toHaveValue("1");
    expect(screen.getByLabelText("Ville")).toHaveValue("Montpellier");
    // Le pays, déjà pré-rempli « France » par défaut, reste « France ».
    expect(screen.getByLabelText("Pays")).toHaveValue("France");
    // Le libellé figé soumis = le nom de la conf tant qu'aucune édition n'est choisie.
    expect(hidden("conference")).toHaveValue("Sunny Tech");
  });

  it("choisir une édition pose editionId et pré-remplit le lien vide, sans écraser une saisie", async () => {
    const u = userEvent.setup();
    renderForm();
    const ville = screen.getByLabelText("Ville");
    fireEvent.change(ville, { target: { value: "Nantes" } });

    await choisirConference(u, /sunny tech/i);
    fireEvent.change(screen.getByLabelText("Édition"), {
      target: { value: "42" },
    });

    expect(hidden("editionId")).toHaveValue("42");
    expect(hidden("conference")).toHaveValue("Sunny Tech 2026");
    expect(screen.getByLabelText("Lien page de la conf")).toHaveValue(
      "https://sunny-tech.io",
    );
    // La ville tapée à la main n'est jamais écrasée.
    expect(ville).toHaveValue("Nantes");
  });

  it("changer de conférence efface editionId (le lien au registre ne peut jamais mentir)", async () => {
    const u = userEvent.setup();
    renderForm();
    await choisirConference(u, /sunny tech/i);
    fireEvent.change(screen.getByLabelText("Édition"), {
      target: { value: "42" },
    });
    expect(hidden("editionId")).toHaveValue("42");

    await choisirConference(u, /devfest toulouse/i);
    expect(hidden("conferenceId")).toHaveValue("2");
    expect(hidden("editionId")).toHaveValue("");
  });

  // Le bug d'origine : le renvoi « demande son ajout » quittait l'écran (et
  // tombait sur la liste des talks), donc la saisie en cours était perdue. La
  // conférence manquante se saisit désormais SUR PLACE.
  it("« ma conférence manque » ouvre un champ nom SANS quitter l'écran ni vider la saisie", async () => {
    const u = userEvent.setup();
    renderForm();
    fireEvent.change(screen.getByLabelText("Ville"), { target: { value: "Bordeaux" } });
    // Aucun renvoi vers un autre écran : la conférence manquante est une option.
    expect(screen.queryByRole("link", { name: /demande son ajout/i })).toBeNull();
    expect(screen.queryByLabelText(/nom de la conférence/i)).toBeNull();

    await choisirConference(u, /ma conférence manque/i);

    const nom = screen.getByLabelText(/nom de la conférence/i);
    fireEvent.change(nom, { target: { value: "Cloud Nord" } });
    // La saisie déjà faite est intacte, et le nom part avec le formulaire.
    expect(screen.getByLabelText("Ville")).toHaveValue("Bordeaux");
    expect(hidden("conferenceId")).toHaveValue("");
    expect(hidden("editionId")).toHaveValue("");
    expect(hidden("conference")).toHaveValue("Cloud Nord");
  });

  // La recherche qui n'a RIEN trouvé devient le nom proposé : ce qu'elle a
  // tapé pour chercher sa conférence sert la proposition, zéro re-frappe.
  it("le texte cherché sans résultat pré-remplit le nom de la conférence proposée", async () => {
    const u = userEvent.setup();
    renderForm();
    await u.type(
      screen.getByRole("combobox", { name: /conférence/i }),
      "KCD Helsinki",
    );
    await u.click(screen.getByRole("option", { name: /ma conférence manque/i }));

    expect(screen.getByLabelText(/nom de la conférence/i)).toHaveValue("KCD Helsinki");
    expect(hidden("conference")).toHaveValue("KCD Helsinki");
  });

  it("revenir au registre après avoir saisi un nom repose le lien (pas de proposition fantôme)", async () => {
    const u = userEvent.setup();
    renderForm();
    await choisirConference(u, /ma conférence manque/i);
    fireEvent.change(screen.getByLabelText(/nom de la conférence/i), {
      target: { value: "Cloud Nord" },
    });
    await choisirConference(u, /devfest toulouse/i);

    expect(screen.queryByLabelText(/nom de la conférence/i)).toBeNull();
    expect(hidden("conferenceId")).toHaveValue("2");
    expect(hidden("conference")).toHaveValue("DevFest Toulouse");
  });

  it("saisie déjà en attente : rouvre sur SON nom, pas sur « choisis une conférence »", () => {
    render(
      <OccurrenceForm
        talkId={5}
        suggestions={suggestions}
        initial={{
          id: 9,
          conferenceId: null,
          conferenceSlug: null,
          editionId: null,
          conference: "Cloud Nord",
          ville: "Lille",
          codeInsee: null,
          region: null,
          pays: "France",
          date: "2026",
          lienConf: null,
          lienSlides: null,
          lienVideo: null,
          lienFeedback: null,
          propositionId: 4,
          etat: "en_attente",
        }}
      />,
    );
    expect(screen.getByLabelText(/nom de la conférence/i)).toHaveValue("Cloud Nord");
    expect(hidden("conference")).toHaveValue("Cloud Nord");
  });
});

describe("OccurrenceForm — la date de l'édition, et la variante rapide", () => {
  const suggestions: OccurrenceSuggestions = {
    registre: [
      {
        id: 1,
        nom: "Sunny Tech",
        ville: "Montpellier",
        pays: "France",
        editions: [
          {
            editionId: 42,
            conferenceId: 1,
            libelle: "Sunny Tech 2026",
            ville: "Montpellier",
            pays: "France",
            url: "https://sunny-tech.io",
            dateDebut: "2026-07-02",
            dateFin: "2026-07-03",
          },
        ],
      },
    ],
    villes: [],
    pays: ["France"],
  };

  async function choisirSunnyTech(u: ReturnType<typeof userEvent.setup>) {
    await u.click(screen.getByRole("combobox", { name: /conférence/i }));
    await u.click(screen.getByRole("option", { name: /sunny tech/i }));
    await u.selectOptions(screen.getByLabelText(/^édition$/i), "42");
  }

  // Le serveur reprend la date de l'édition quand la saisie est vide
  // (`dateLegueeParEdition`) : exiger l'année bloquait un envoi valide, et le
  // texte promettait une date « pré-remplie » qui ne bougeait pas.
  it("une édition choisie : l'année cesse d'être exigée, et la légende dit pourquoi", async () => {
    const u = userEvent.setup();
    render(<OccurrenceForm talkId={5} suggestions={suggestions} />);
    expect(screen.getByLabelText("Année")).toBeRequired();
    await choisirSunnyTech(u);
    expect(screen.getByLabelText("Année")).not.toBeRequired();
    expect(screen.getByRole("group", { name: /celle de l'édition si tu la laisses vide/i })).toBeInTheDocument();
  });

  // Une édition qui ne LÈGUE aucune date (pas de date de début, ou à cheval
  // sur deux ans) : rien à reprendre, l'année reste exigée — sinon
  // l'occurrence partait sans date sous une légende qui promettait la sienne.
  it("une édition SANS date à léguer : l'année reste exigée", async () => {
    const sansDate: OccurrenceSuggestions = {
      ...suggestions,
      registre: [
        {
          ...suggestions.registre[0],
          editions: [{ ...suggestions.registre[0].editions[0], dateDebut: null, dateFin: null }],
        },
      ],
    };
    const u = userEvent.setup();
    render(<OccurrenceForm talkId={5} suggestions={sansDate} />);
    await choisirSunnyTech(u);
    expect(screen.getByLabelText("Année")).toBeRequired();
    expect(screen.queryByText(/sa date est reprise/i)).toBeNull();
  });

  it("variante rapide : ni pays ni liens visibles pour une conférence du registre", async () => {
    const u = userEvent.setup();
    render(<OccurrenceForm talkId={5} suggestions={suggestions} rapide />);
    await choisirSunnyTech(u);
    expect(screen.queryByLabelText(/^pays$/i)).toBeNull();
    expect(screen.queryByLabelText(/lien slides/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Ajouter la date" })).toBeInTheDocument();
  });

  // Hors registre, aucune conférence ne fournit le pays : caché, « France »
  // partait en silence (revue justesse du 2026-10-15).
  it("variante rapide, conférence hors registre : le champ Pays s'affiche", async () => {
    const u = userEvent.setup();
    render(<OccurrenceForm talkId={5} suggestions={suggestions} rapide />);
    await u.type(screen.getByRole("combobox", { name: /conférence/i }), "Devoxx Belgium");
    await u.click(screen.getByRole("option", { name: /manque/i }));
    expect(screen.getByLabelText(/^pays$/i)).toBeInTheDocument();
  });
});

describe("OccurrenceForm — renvoi « où héberger tes slides »", () => {
  const suggestions: OccurrenceSuggestions = { registre: [], villes: [], pays: [] };

  it("affiche le renvoi vers le guide quand l'article est publié (lien fourni)", () => {
    render(
      <OccurrenceForm
        talkId={5}
        suggestions={suggestions}
        aideSlidesHref="/articles/ou-heberger-tes-slides"
      />,
    );
    expect(screen.getByRole("link", { name: /notre guide/i })).toHaveAttribute(
      "href",
      "/articles/ou-heberger-tes-slides",
    );
  });

  it("aucun renvoi sans lien (article pas publié) : jamais de lien mort", () => {
    render(
      <OccurrenceForm
        talkId={5}
        suggestions={suggestions}
      />,
    );
    expect(screen.queryByRole("link", { name: /notre guide/i })).toBeNull();
  });
});
