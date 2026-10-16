import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within, fireEvent, waitFor } from "@testing-library/react";
import KitDeCommunication from "@/app/kit-de-communication/page";
import {
  declinaisonsLogo,
  fichiersArchive,
  modelesKit,
  couleursKit,
  reglesLogo,
  octetsZip,
  poidsLisible,
  URL_ZIP,
} from "@/data/kit-communication";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Le nom accessible tolère l'insécable comme n'importe quel espace. */
const nom = (texte: string) =>
  new RegExp(texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[\s\u00A0]+/g, "[\\s\\u00A0]+"), "i");

describe("/kit-de-communication — téléchargements", () => {
  it("propose tout le kit en une archive, avec son format et son poids", () => {
    render(<KitDeCommunication />);
    const zip = screen.getByRole("link", { name: /tout le kit/i });
    expect(zip).toHaveAttribute("href", URL_ZIP);
    expect(zip).toHaveAttribute("download");
    expect(zip).toHaveAccessibleName(/kit\s+ZIP/);
    expect(zip).toHaveAccessibleName(nom(poidsLisible(octetsZip)));
  });

  it("un lien par fichier, qui dit quoi, en quel format, à quelle taille et quel poids", () => {
    render(<KitDeCommunication />);
    for (const d of declinaisonsLogo) {
      for (const f of d.formats) {
        if (!f.fichier) continue;
        const lien = screen.getByRole("link", { name: nom(`Télécharger ${d.objet}`) });
        expect(lien).toHaveAttribute("href", `/kit/${f.fichier}`);
        expect(lien).toHaveAttribute("download");
        // L'objet et le format se lisent comme deux mots : collés
        // (« fond sombrePNG »), la synthèse vocale les fondait en un.
        expect(lien).toHaveAccessibleName(nom(`${d.objet} ${f.libelle} `));
        expect(lien).toHaveAccessibleName(nom(`${f.largeur} × ${f.hauteur} px`));
        expect(lien).toHaveAccessibleName(nom(poidsLisible(f.octets)));
      }
    }
  });

  it("chaque lien de téléchargement a un intitulé distinct (pas de « Télécharger » ×N)", () => {
    render(<KitDeCommunication />);
    const liens = screen
      .getAllByRole("link")
      .filter((a) => a.hasAttribute("download"))
      .map((a) => a.textContent);
    expect(liens).toHaveLength(fichiersArchive.length + 1);
    expect(new Set(liens).size).toBe(liens.length);
  });

  it("propose le modèle de présentation, avec format, diapositives et poids", () => {
    render(<KitDeCommunication />);
    for (const m of modelesKit) {
      const lien = screen.getByRole("link", { name: nom(`Télécharger ${m.objet}`) });
      expect(lien).toHaveAttribute("href", `/kit/${m.fichier}`);
      expect(lien).toHaveAttribute("download");
      expect(lien).toHaveAccessibleName(nom(`${m.objet} PPTX`));
      expect(lien).toHaveAccessibleName(nom(`${m.diapositives} diapositives`));
      expect(lien).toHaveAccessibleName(nom(poidsLisible(m.octets)));
    }
  });

  it("l'archive annonce tous ses fichiers, modèle compris", () => {
    render(<KitDeCommunication />);
    expect(screen.getByRole("link", { name: /tout le kit/i })).toHaveAccessibleName(
      nom(`${fichiersArchive.length} fichiers`),
    );
  });

  it("l'aperçu de chaque déclinaison décrit le fichier", () => {
    render(<KitDeCommunication />);
    for (const d of declinaisonsLogo) {
      expect(screen.getByRole("img", { name: nom(d.alt) })).toBeInTheDocument();
    }
  });

  it("un format manquant reste visible, annoncé à venir, sans lien", () => {
    render(<KitDeCommunication />);
    const carte = screen.getByRole("heading", { name: "Logo complet, fond sombre" }).closest("li")!;
    expect(within(carte).getByText(/à venir/i)).toHaveTextContent(/SVG/);
    expect(within(carte).getAllByRole("link")).toHaveLength(1);
  });
});

describe("/kit-de-communication — couleurs", () => {
  it("chaque couleur montre son code et le copie", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<KitDeCommunication />);

    for (const c of couleursKit) {
      expect(screen.getByRole("button", { name: nom(`${c.nom} ${c.hex}`) })).toBeInTheDocument();
    }
    const cyan = couleursKit.find((c) => c.nom === "Cyan")!;
    fireEvent.click(screen.getByRole("button", { name: nom(`Cyan ${cyan.hex}`) }));
    // Sans « # » : Canva, Figma, les champs couleur l'ajoutent eux-mêmes, et
    // un « # » collé en plus bloque la saisie.
    const sansDiese = cyan.hex.slice(1);
    expect(writeText).toHaveBeenCalledWith(sansDiese);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(nom(`Code ${sansDiese} copié`)),
    );
  });

  it("si le presse-papiers refuse, la page le dit et le code reste lisible", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("refus"));
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<KitDeCommunication />);
    const magenta = couleursKit.find((c) => c.nom === "Magenta")!;
    fireEvent.click(screen.getByRole("button", { name: nom(`Magenta ${magenta.hex}`) }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/sélectionn/i),
    );
    // Le retour se voit aussi SUR le bouton : la région vivante est en bas de
    // la palette, souvent hors écran.
    expect(screen.getByRole("button", { name: nom(`Magenta ${magenta.hex}`) })).toHaveTextContent("Sélectionné");
  });
});

describe("/kit-de-communication — règles et typographies", () => {
  it("dit ce qu'on fait et ce qu'on évite avec le logo", () => {
    render(<KitDeCommunication />);
    const aFaire = screen.getByRole("list", { name: "À faire" });
    const aEviter = screen.getByRole("list", { name: "À éviter" });
    expect(within(aFaire).getAllByRole("listitem")).toHaveLength(reglesLogo.aFaire.length);
    expect(within(aEviter).getAllByRole("listitem")).toHaveLength(reglesLogo.aEviter.length);
    expect(aFaire).toHaveTextContent(/espace libre/);
    expect(aEviter).toHaveTextContent(/Recolorer/);
    expect(aEviter).toHaveTextContent(/Étirer/);
  });

  it("nomme les typographies de la charte", () => {
    render(<KitDeCommunication />);
    expect(screen.getByText("Montserrat")).toBeInTheDocument();
    expect(screen.getByText("Big Shoulders Display")).toBeInTheDocument();
  });

  it("garde un seul bouton principal : l'archive", () => {
    const { container } = render(<KitDeCommunication />);
    expect(container.querySelectorAll("a.bg-magenta")).toHaveLength(1);
  });
});
