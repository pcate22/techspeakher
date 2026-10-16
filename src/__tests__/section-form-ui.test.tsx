import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// Le formulaire se lit RENDU : on isole l'action serveur (Auth.js + base).
vi.mock("@/app/mon-espace/actions", () => ({
  saveProfileSection: vi.fn(),
  reprendrePhotoLinkedInAction: vi.fn(),
  reconnecterLinkedInAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  // `ChampPhoto` lit la route courante (retour après un passage par LinkedIn).
  usePathname: () => "/mon-espace/fiche",
}));

import SectionForm from "@/app/mon-espace/fiche/[section]/SectionForm";
import { makeFiche } from "./test-helpers";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const rendre = (cle = "secteurs") =>
  render(<SectionForm cle={cle} initial={makeFiche()} nom="Marie Curie" />);
const barre = () => screen.getByRole("button", { name: /enregistrer/i }).parentElement!;

/**
 * La barre d'action porte UN bouton. Bordée, arrondie et ombrée, elle se lisait
 * comme une carte de plus dans une page qui n'en contient pas — une boîte vide
 * autour d'un bouton, juste sous les cases à cocher qui, elles, sont bel et bien
 * des cadres. Seul le fond, OPAQUE, la sépare du texte qui défile derrière : à
 * 95 % et sans contour, on devinait la case du dessous.
 */
describe("SectionForm — la barre d'action ne se déguise pas en carte", () => {
  it("aucun contour de carte autour du CTA (ni bordure, ni arrondi, ni ombre)", () => {
    rendre();
    const classes = barre().className.split(/\s+/);
    expect(classes).not.toContain("border");
    expect(classes.filter((c) => /^(rounded|shadow|border)-/.test(c))).toEqual([]);
  });

  it("le CTA reste au-dessus de la flottaison (classe partagée)", () => {
    rendre();
    expect(barre().className.split(/\s+/)).toContain("barre-action-collante");
  });
});

/**
 * Une barre ne flotte que si elle sert à quelque chose. Sur une liste de quinze
 * cases, oui : le CTA sortait de l'écran dès la troisième. Sur une section qui
 * tient à l'écran (l'attestation, UNE case), une barre collante ne rapproche
 * rien et recouvre le peu qu'il y a à lire — elle se pose alors en fin de
 * formulaire, comme un bouton ordinaire.
 */
describe("SectionForm — la barre ne colle que si le formulaire dépasse l'écran", () => {
  const original = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetHeight",
  )!;
  /** jsdom ne met rien en page : on donne sa hauteur au <form>. */
  function hauteurDuFormulaire(px: number) {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.tagName === "FORM" ? px : 0;
      },
    });
  }
  const hauteurFenetre = window.innerHeight;
  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", original);
    window.innerHeight = hauteurFenetre;
  });

  it("formulaire plus haut que l'écran : la barre reste collante", () => {
    window.innerHeight = 800;
    hauteurDuFormulaire(2000);
    rendre();
    expect(barre().className.split(/\s+/)).toContain("barre-action-collante");
  });

  it("formulaire qui tient à l'écran : la barre se pose en fin de formulaire", () => {
    window.innerHeight = 800;
    hauteurDuFormulaire(300);
    rendre("attestation");
    expect(barre().className.split(/\s+/)).not.toContain("barre-action-collante");
  });
});

/**
 * WCAG 2.2 — 2.4.11 « focus non masqué ». `scroll-padding-bottom` réserve la
 * hauteur des ONGLETS (cf. `barre-action-collante.test.ts`), pas celle de la
 * barre d'action, qui flotte par-dessus le formulaire : le champ atteint au
 * clavier peut donc encore atterrir derrière elle. On le dégage à la main, et
 * seulement en cas de chevauchement réel.
 */
describe("SectionForm — le champ au focus ne reste jamais sous la barre", () => {
  /** Place le champ et la barre dans la fenêtre (jsdom rend tout à zéro). */
  const placer = (el: Element, r: { top: number; bottom: number }) => {
    el.getBoundingClientRect = () =>
      ({ ...r, left: 0, right: 300, width: 300, height: r.bottom - r.top }) as DOMRect;
  };

  it("un champ recouvert est remonté au-dessus de la barre", () => {
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    rendre();
    const champ = screen.getAllByRole("checkbox")[0]!;
    placer(barre(), { top: 500, bottom: 568 });
    placer(champ, { top: 480, bottom: 524 }); // pied du champ sous la barre

    fireEvent.focusIn(champ);

    expect(scrollBy).toHaveBeenCalledTimes(1);
    const { top } = scrollBy.mock.calls[0]![0] as ScrollToOptions;
    expect(top).toBeGreaterThanOrEqual(24); // 524 − 500, plus une marge
  });

  it("un champ bien visible ne déclenche AUCUN défilement", () => {
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    rendre();
    const champ = screen.getAllByRole("checkbox")[0]!;
    placer(barre(), { top: 500, bottom: 568 });
    placer(champ, { top: 100, bottom: 144 });

    fireEvent.focusIn(champ);

    expect(scrollBy).not.toHaveBeenCalled();
  });

  /** Le CTA lui-même vit DANS la barre : la dégager la ferait fuir devant lui. */
  it("le CTA de la barre ne se dégage pas lui-même", () => {
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    rendre();
    const cta = screen.getByRole("button", { name: /enregistrer/i });
    placer(barre(), { top: 500, bottom: 568 });
    placer(cta, { top: 510, bottom: 554 });

    fireEvent.focusIn(cta);

    expect(scrollBy).not.toHaveBeenCalled();
  });
});
