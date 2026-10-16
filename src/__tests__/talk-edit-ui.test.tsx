import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/mon-espace/actions", () => ({
  addTalkAction: vi.fn(),
  updateTalkAction: vi.fn(),
}));

import TalkForm from "@/app/mon-espace/TalkForm";
import TalkConferences from "@/app/mon-espace/TalkConferences";
import type { Talk } from "@/lib/talks";
import { DESCRIPTION_MAX, TITRE_MAX } from "@/lib/talk-limits";
import { makeOccurrence } from "./test-helpers";

afterEach(cleanup);

const talk: Talk = {
  id: 5,
  profileId: 2,
  titre: "Votre IA s'en sort moins bien que vos utilisateurs aveugles",
  type: "Quickie / Lightning",
  description: "On nous promet que l'IA va tout changer.",
  occurrences: [
    makeOccurrence({
      id: 9,
      conference: "DevFest",
      conferenceId: 3,
      conferenceSlug: "devfest",
    }),
  ],
};

/**
 * Page « Modifier le talk » — revue UX/UI (audit 2026-07-25). Ces tests
 * verrouillent les correctifs pour qu'ils ne se re-perdent pas :
 * un seul CTA principal, contours de champs visibles, cibles ≥ 44 px,
 * une conférence = une ligne cliquable vers sa page.
 */
describe("TalkConferences (section conférences de la page talk)", () => {
  it("une conférence = UNE ligne cliquable vers sa page (pas de second lien « Modifier »)", () => {
    render(<TalkConferences talk={talk} />);
    const ligne = screen.getByRole("link", { name: /devfest.*toulouse/i });
    expect(ligne).toHaveAttribute("href", "/mon-espace/talks/5/conference/9");
    // Une seule cible par item : le lien « Modifier » séparé écrasait la ligne
    // sur mobile et dupliquait le geste hors du contexte de l'item (§1, §6).
    expect(screen.getAllByRole("link", { name: /devfest/i })).toHaveLength(1);
  });

  it("la ligne respecte la cible tactile de 44 px", () => {
    render(<TalkConferences talk={talk} />);
    expect(screen.getByRole("link", { name: /devfest/i }).className).toContain(
      "min-h-[44px]",
    );
  });

  it("« Ajouter une conférence » est un CTA SECONDAIRE (le magenta reste à « Enregistrer »)", () => {
    render(<TalkConferences talk={talk} />);
    const cta = screen.getByRole("link", { name: /ajouter une conférence/i });
    expect(cta).toHaveAttribute(
      "href",
      "/mon-espace/talks/5/conference/nouveau",
    );
    expect(cta.className).toContain("border-cyan");
    expect(cta.className).not.toContain("bg-magenta");
    expect(cta.className).toContain("min-h-[44px]");
  });

  it("l'en-tête s'empile sur mobile (titre + aide en pleine largeur)", () => {
    const { container } = render(<TalkConferences talk={talk} />);
    // Le bouton ne partage plus la ligne du titre : il vit après la liste.
    const entete = container.querySelector("#conferences-title")?.parentElement;
    expect(entete?.querySelector("a")).toBeNull();
  });

  it("sans conférence : explique l'état sans bloquer l'ajout", () => {
    render(<TalkConferences talk={{ ...talk, occurrences: [] }} />);
    expect(
      screen.getByText(/aucune conférence rattachée/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /ajouter une conférence/i }),
    ).toBeInTheDocument();
  });
});

describe("TalkForm — lisibilité et cibles (audit UX/UI)", () => {
  it("les champs portent le contour calibré `field-border` (jamais navy-lighter à 1,26:1)", () => {
    render(<TalkForm initial={talk} />);
    for (const champ of [
      screen.getByLabelText(/titre du talk/i),
      screen.getByLabelText(/^type$/i),
      screen.getByLabelText(/^description$/i),
    ]) {
      expect(champ.className).toContain("border-field-border");
      expect(champ.className).not.toContain("border-navy-lighter");
    }
  });

  // Un titre de talk fait couramment 60 à 120 caractères : dans un champ d'une
  // ligne, la saisie défilait hors du cadre et on ne relisait jamais son titre
  // en entier (surtout sur téléphone). Même geste que la bio de la fiche
  // speakeuse : le champ se dimensionne sur son contenu.
  it("le titre se lit EN ENTIER pendant la saisie (champ dimensionné sur son contenu)", () => {
    render(<TalkForm initial={talk} />);
    const champ = screen.getByLabelText(
      /titre du talk/i,
    ) as HTMLTextAreaElement;
    expect(champ.tagName.toLowerCase()).toBe("textarea");
    expect(Number(champ.getAttribute("rows"))).toBeGreaterThanOrEqual(2);
    expect(champ).toHaveValue(talk.titre);
  });

  it("le titre garde son contrat de soumission (name, obligatoire, limite serveur)", () => {
    render(<TalkForm initial={talk} />);
    const champ = screen.getByLabelText(/titre du talk/i);
    expect(champ).toHaveAttribute("name", "titre");
    expect(champ).toBeRequired();
    expect(champ).toHaveAttribute("maxLength", String(TITRE_MAX));
  });

  it("la description montre au moins 6 lignes (plus de texte coupé en plein milieu)", () => {
    render(<TalkForm initial={talk} />);
    const zone = screen.getByLabelText(/^description$/i) as HTMLTextAreaElement;
    expect(Number(zone.getAttribute("rows"))).toBeGreaterThanOrEqual(6);
  });

  it("compte les caractères en direct au lieu d'annoncer une limite figée", async () => {
    const u = userEvent.setup();
    render(<TalkForm />);
    const zone = screen.getByLabelText(/^description$/i);
    expect(
      screen.getByText(`0 / ${DESCRIPTION_MAX} caractères`),
    ).toBeInTheDocument();
    await u.type(zone, "Bonjour");
    expect(
      screen.getByText(`7 / ${DESCRIPTION_MAX} caractères`),
    ).toBeInTheDocument();
  });

  it("le CTA principal est un aplat magenta en taille md (48 px, au-dessus des 44 px COGA)", () => {
    render(<TalkForm initial={talk} />);
    const cta = screen.getByRole("button", {
      name: /enregistrer les modifications/i,
    });
    expect(cta.className).toContain("bg-magenta");
    // `py-3` = taille md → 48 px ; `sm` (py-2) plafonnait à 36 px.
    expect(cta.className).toContain("py-3");
  });

  it("le compteur reste lié au champ (aria-describedby) et cède la place à l'erreur", () => {
    render(<TalkForm initial={talk} />);
    expect(screen.getByLabelText(/^description$/i)).toHaveAttribute(
      "aria-describedby",
      "hint-description",
    );
  });
});
