import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";

vi.mock("@/app/mon-espace/actions", () => ({
  addOccurrenceAction: vi.fn(),
  updateOccurrenceAction: vi.fn(),
}));

import ChampTexte from "@/components/ChampTexte";
import OccurrenceForm from "@/app/mon-espace/OccurrenceForm";
import type { OccurrenceSuggestions } from "@/lib/talks";

afterEach(cleanup);

/**
 * `ChampTexte` est LA primitive de champ texte : le câblage
 * aria-invalid / aria-describedby ne doit vivre qu'ici. `OccurrenceForm` en
 * gardait une copie (`LinkField`) pour ses quatre liens, au seul motif qu'un
 * d'entre eux est contrôlé (pré-remplissage depuis l'édition choisie). La
 * primitive gère désormais les deux modes, la copie disparaît.
 */
describe("ChampTexte — mode non contrôlé (defaultValue)", () => {
  it("pose la valeur initiale et laisse la frappe libre", () => {
    render(<ChampTexte id="a" name="a" label="Lien slides" defaultValue="https://x" />);
    const champ = screen.getByLabelText("Lien slides") as HTMLInputElement;
    expect(champ).toHaveValue("https://x");
    fireEvent.change(champ, { target: { value: "https://y" } });
    expect(champ).toHaveValue("https://y");
  });
});

describe("ChampTexte — mode contrôlé (value + onChange)", () => {
  it("affiche la valeur passée et remonte chaque saisie", () => {
    const onChange = vi.fn();
    render(
      <ChampTexte
        id="b"
        name="b"
        label="Lien page de la conf"
        value="https://sunny-tech.io"
        onChange={onChange}
      />,
    );
    const champ = screen.getByLabelText("Lien page de la conf");
    expect(champ).toHaveValue("https://sunny-tech.io");
    fireEvent.change(champ, { target: { value: "https://autre.fr" } });
    expect(onChange).toHaveBeenCalledWith("https://autre.fr");
  });

  it("reste contrôlé sans defaultValue concurrent (React refuse les deux)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ChampTexte id="c" name="c" label="Lien vidéo" value="" onChange={vi.fn()} />);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  // `value` sans `onChange` est une erreur d'appel. Le champ doit rester
  // contrôlé (valeur affichée, React avertit bruyamment) et SURTOUT pas
  // retomber en non contrôlé : on afficherait un champ vide en avalant la
  // valeur passée, sans que personne le voie.
  it("`value` sans `onChange` affiche quand même la valeur (échec bruyant, pas muet)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ChampTexte id="d" name="d" label="Ville" value="Toulouse" />);
    expect(screen.getByLabelText("Ville")).toHaveValue("Toulouse");
    spy.mockRestore();
  });
});

describe("ChampTexte — suggestions de saisie (datalist)", () => {
  it("relie l'input à sa liste et pose une option par suggestion", () => {
    const { container } = render(
      <ChampTexte
        id="ville"
        name="ville"
        label="Ville"
        suggestions={["Toulouse", "Nantes"]}
      />,
    );
    expect(screen.getByLabelText("Ville")).toHaveAttribute("list", "ville-list");
    const liste = container.querySelector("#ville-list");
    expect(liste?.tagName.toLowerCase()).toBe("datalist");
    expect(
      Array.from(liste!.querySelectorAll("option")).map((o) => o.getAttribute("value")),
    ).toEqual(["Toulouse", "Nantes"]);
  });

  it("sans suggestions : aucune liste, aucun attribut orphelin", () => {
    const { container } = render(<ChampTexte id="titre" name="titre" label="Titre" />);
    expect(screen.getByLabelText("Titre")).not.toHaveAttribute("list");
    expect(container.querySelector("datalist")).toBeNull();
  });

  // Base fraîche : la liste des villes connues est vide. Annoncer une
  // autocomplétion qui ne propose rien est une promesse creuse pour les aides
  // techniques — on ne câble donc rien.
  it("liste vide : pas d'autocomplétion annoncée à vide", () => {
    const { container } = render(
      <ChampTexte id="ville" name="ville" label="Ville" suggestions={[]} />,
    );
    expect(screen.getByLabelText("Ville")).not.toHaveAttribute("list");
    expect(container.querySelector("datalist")).toBeNull();
  });

  // Un <textarea> ne porte pas `list` : sans garde, la combinaison rendait une
  // <datalist> que personne ne référence.
  it("multiligne + suggestions : aucune datalist orpheline", () => {
    const { container } = render(
      <ChampTexte
        id="titre"
        name="titre"
        label="Titre"
        multiligne
        suggestions={["Une idée"]}
      />,
    );
    expect(container.querySelector("datalist")).toBeNull();
    expect(screen.getByLabelText("Titre")).not.toHaveAttribute("list");
  });

  it("se combine au mode contrôlé (une suggestion reste une saisie modifiable)", () => {
    const onChange = vi.fn();
    render(
      <ChampTexte
        id="pays"
        name="pays"
        label="Pays"
        suggestions={["France"]}
        value="France"
        onChange={onChange}
      />,
    );
    const champ = screen.getByLabelText("Pays");
    expect(champ).toHaveValue("France");
    fireEvent.change(champ, { target: { value: "Belgique" } });
    expect(onChange).toHaveBeenCalledWith("Belgique");
  });
});

/**
 * Mode `multiligne` : même champ d'UNE ligne de données (un titre), mais dont la
 * hauteur suit le contenu — la saisie longue se lit EN ENTIER au lieu de défiler
 * hors du champ sur un écran étroit. Même geste que la bio de la fiche
 * speakeuse : on dimensionne le champ sur ce qu'il contient.
 */
describe("ChampTexte — autoremplissage (WCAG 1.3.5 / RGAA 11.13)", () => {
  it("transmet `autoComplete` sur les deux rendus", () => {
    render(
      <>
        <ChampTexte id="a" name="a" label="Nom" autoComplete="name" />
        <ChampTexte id="b" name="b" label="Adresse" multiligne autoComplete="street-address" />
      </>,
    );
    expect(screen.getByLabelText("Nom")).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText("Adresse")).toHaveAttribute(
      "autocomplete",
      "street-address",
    );
  });
});

describe("ChampTexte — mode multiligne (saisie visible en entier)", () => {
  /** jsdom ne calcule aucune hauteur : on simule un contenu qui dépasse. */
  function simuleContenu(px: number) {
    return vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(px);
  }

  /** Champ à `box-sizing: border-box` : `height` englobe les bordures que
   * `scrollHeight` ignore (ici 2 px). */
  function simuleBordures(epaisseur: number) {
    const client = vi
      .spyOn(Element.prototype, "clientHeight", "get")
      .mockReturnValue(100);
    const offset = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(100 + epaisseur);
    return () => {
      client.mockRestore();
      offset.mockRestore();
    };
  }

  it("rend une zone de texte de deux lignes au repos (et garde le câblage aria)", () => {
    render(
      <ChampTexte
        id="titre"
        name="titre"
        label="Titre du talk"
        multiligne
        required
        maxLength={200}
        error="Titre requis"
      />,
    );
    const champ = screen.getByLabelText(/titre du talk/i);
    expect(champ.tagName.toLowerCase()).toBe("textarea");
    expect(Number(champ.getAttribute("rows"))).toBeGreaterThanOrEqual(2);
    expect(champ).toHaveAttribute("name", "titre");
    expect(champ).toHaveAttribute("maxLength", "200");
    expect(champ).toHaveAttribute("aria-invalid", "true");
    expect(champ).toHaveAttribute("aria-describedby", "err-titre");
    expect(champ.className).toContain("border-field-border");
  });

  it("la hauteur suit le contenu, au montage puis à la frappe", () => {
    const spy = simuleContenu(96);
    render(
      <ChampTexte
        id="titre"
        name="titre"
        label="Titre du talk"
        multiligne
        defaultValue={"Un titre très long ".repeat(8)}
      />,
    );
    const champ = screen.getByLabelText(/titre du talk/i) as HTMLTextAreaElement;
    expect(champ.style.height).toBe("96px");
    spy.mockReturnValue(120);
    fireEvent.input(champ, { target: { value: "encore plus long" } });
    expect(champ.style.height).toBe("120px");
    spy.mockRestore();
  });

  // Sans ce rattrapage, le champ garde l'épaisseur des bordures en défilement et
  // rogne le bas de la dernière ligne.
  it("ajoute l'épaisseur des bordures, que `scrollHeight` ignore", () => {
    const contenu = simuleContenu(96);
    const restaure = simuleBordures(2);
    render(<ChampTexte id="titre" name="titre" label="Titre du talk" multiligne />);
    expect(
      (screen.getByLabelText(/titre du talk/i) as HTMLTextAreaElement).style.height,
    ).toBe("98px");
    restaure();
    contenu.mockRestore();
  });

  it("Entrée soumet le formulaire au lieu d'insérer un retour à la ligne", () => {
    const onSubmit = vi.fn((e: FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <ChampTexte id="titre" name="titre" label="Titre du talk" multiligne />
        <button type="submit">Créer le talk</button>
      </form>,
    );
    const champ = screen.getByLabelText(/titre du talk/i) as HTMLTextAreaElement;
    fireEvent.change(champ, { target: { value: "Mon titre" } });
    const traite = fireEvent.keyDown(champ, { key: "Enter" });
    // `false` = l'événement a été annulé : aucun « \n » n'entre dans le titre.
    expect(traite).toBe(false);
    expect(champ.value).toBe("Mon titre");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("reste utilisable en mode contrôlé (value + onChange)", () => {
    const onChange = vi.fn();
    render(
      <ChampTexte
        id="titre"
        name="titre"
        label="Titre du talk"
        multiligne
        value="Mon titre"
        onChange={onChange}
      />,
    );
    const champ = screen.getByLabelText(/titre du talk/i);
    expect(champ).toHaveValue("Mon titre");
    fireEvent.change(champ, { target: { value: "Mon autre titre" } });
    expect(onChange).toHaveBeenCalledWith("Mon autre titre");
  });
});

describe("OccurrenceForm — les liens passent par la primitive partagée", () => {
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
    ],
    villes: ["Toulouse"],
    pays: ["France"],
  };

  const LIENS = [
    "Lien page de la conf",
    "Lien slides",
    "Lien vidéo",
    "Lien feedback",
  ];

  function renderForm() {
    return render(
      <OccurrenceForm talkId={5} suggestions={suggestions} />,
    );
  }

  it("chaque lien garde son clavier URL, son gabarit et le contour calibré", () => {
    renderForm();
    for (const label of LIENS) {
      const champ = screen.getByLabelText(label);
      expect(champ).toHaveAttribute("inputMode", "url");
      expect(champ).toHaveAttribute("placeholder", "https://…");
      expect(champ.className).toContain("border-field-border");
    }
  });

  // Le `name` est ce que lit la Server Action : s'il dérape, le lien part
  // silencieusement à la poubelle sans qu'aucune erreur ne s'affiche.
  it("chaque champ soumet bien le nom attendu côté serveur", () => {
    renderForm();
    for (const [label, name] of [
      ["Lien page de la conf", "lienConf"],
      ["Lien slides", "lienSlides"],
      ["Lien vidéo", "lienVideo"],
      ["Lien feedback", "lienFeedback"],
      ["Ville", "ville"],
      ["Pays", "pays"],
    ] as const) {
      expect(screen.getByLabelText(label)).toHaveAttribute("name", name);
    }
  });

  it("le lien contrôlé se pré-remplit toujours depuis l'édition choisie", async () => {
    const u = userEvent.setup();
    renderForm();
    await u.click(screen.getByRole("combobox", { name: /^conférence/i }));
    await u.click(screen.getByRole("option", { name: /sunny tech/i }));
    fireEvent.change(screen.getByLabelText("Édition"), { target: { value: "42" } });
    expect(screen.getByLabelText("Lien page de la conf")).toHaveValue(
      "https://sunny-tech.io",
    );
  });

  it("Pays garde ses suggestions, portées par la primitive", () => {
    const { container } = renderForm();
    expect(screen.getByLabelText("Pays")).toHaveAttribute("list", "pays-list");
    expect(container.querySelector("#pays-list option")?.getAttribute("value")).toBe(
      "France",
    );
  });

  /**
   * Ville a quitté la primitive pour `VilleField` (Base Adresse Nationale) :
   * c'est ce qui lui fait capturer le code INSEE. Les villes DÉJÀ saisies
   * restent proposées à côté des communes de la BAN — sans elles, « Bruxelles »
   * (hors de France, donc inconnue de la BAN) se retaperait à chaque fois, et
   * s'orthographierait différemment d'une saisie à l'autre.
   */
  it("Ville propose la BAN sans perdre les villes déjà saisies", () => {
    const { container } = renderForm();
    expect(screen.getByLabelText("Ville")).toHaveAttribute("list", "ville-communes");
    expect(
      container.querySelector("#ville-communes option")?.getAttribute("value"),
    ).toBe("Toulouse");
  });

  it("Ville reste contrôlée : le choix d'une conférence la pré-remplit", async () => {
    const u = userEvent.setup();
    renderForm();
    await u.click(screen.getByRole("combobox", { name: /^conférence/i }));
    await u.click(screen.getByRole("option", { name: /sunny tech/i }));
    expect(screen.getByLabelText("Ville")).toHaveValue("Montpellier");
  });
});
