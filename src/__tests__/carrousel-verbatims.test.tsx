import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import CarrouselVerbatims from "@/components/CarrouselVerbatims";
import type { Verbatim } from "@/types";

/**
 * Le carrousel de verbatims de la home : on fait DÉFILER la parole des
 * personnes concernées, une voix à la fois.
 *
 * Ce que ces tests tiennent, et qui n'est pas négociable :
 * - rien ne bouge tout seul (WCAG 2.2.2) : c'est le visiteur qui avance ;
 * - la fonction existe sans le doigt : flèches et pastilles sont de vrais
 *   boutons, la piste est une région atteignable au clavier (elle défile aux
 *   flèches du clavier) — le glissement au doigt n'est qu'un raccourci ;
 * - la position se DIT (« Verbatim 3 sur 8 ») : les flèches ne déplacent pas le
 *   focus, sans région vivante un lecteur d'écran ne saurait pas que ça a bougé ;
 * - les huit verbatims sont dans le DOM, donc lisibles même si le JS tombe (la
 *   piste reste défilable) et indexables.
 */

expect.extend(toHaveNoViolations);
afterEach(cleanup);

const VERBATIMS: Verbatim[] = [
  {
    auteur: "Sandrine",
    qualite: "Candidate du Tremplin 2026",
    citation: "Le bon challenge au bon moment pour moi.",
  },
  {
    auteur: "Aurélie Vache",
    qualite: "Jurée du Tremplin 2026",
    role: "Developer Advocate, OVHcloud",
    citation: "La qualité et la diversité des pitchs étaient au rendez-vous.",
  },
  {
    auteur: "Ophélie",
    qualite: "Participante au parcours 2026",
    citation: "Les ateliers étaient formateurs, souvent trop courts même.",
  },
];

function rendre(verbatims: Verbatim[] = VERBATIMS) {
  return render(
    <main>
      <h1>Home</h1>
      <CarrouselVerbatims verbatims={verbatims} libelle="Verbatims du Tremplin" />
    </main>,
  );
}

const piste = () => screen.getByRole("group", { name: /verbatims du tremplin/i });
const pastilles = () => screen.getAllByRole("button", { name: /^Verbatim \d+ sur \d+$/ });
const suivant = () => screen.getByRole("button", { name: /verbatim suivant/i });
const precedent = () => screen.getByRole("button", { name: /verbatim précédent/i });

describe("CarrouselVerbatims — ce qui s'affiche", () => {
  it("met les verbatims dans la piste, chacun attribué", () => {
    rendre();
    const items = within(piste()).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(piste()).getByText(/le bon challenge au bon moment/i)).toBeInTheDocument();
    expect(within(piste()).getByText(/la qualité et la diversité des pitchs/i)).toBeInTheDocument();
    expect(within(piste()).getByText("Aurélie Vache")).toBeInTheDocument();
    expect(within(piste()).getByText("Jurée du Tremplin 2026")).toBeInTheDocument();
    expect(within(piste()).getByText("Developer Advocate, OVHcloud")).toBeInTheDocument();
    expect(within(piste()).getByText("Candidate du Tremplin 2026")).toBeInTheDocument();
  });

  it("cite entre guillemets français, dans une citation attribuée", () => {
    rendre();
    const items = within(piste()).getAllByRole("listitem");
    // `figure` + `blockquote` + `figcaption` : la citation et son auteur sont
    // liés dans la structure, pas seulement côte à côte visuellement.
    expect(items[0].querySelector("figure blockquote")).not.toBeNull();
    expect(items[0].querySelector("figcaption")).not.toBeNull();
    expect(items[0].textContent).toContain("« ");
    expect(items[0].textContent).toContain(" »");
  });

  it("la piste est une région atteignable au clavier", () => {
    // Une zone qui défile doit pouvoir défiler sans souris ni doigt : sans
    // `tabindex`, le contenu des verbatims suivants est inatteignable au clavier.
    rendre();
    expect(piste()).toHaveAttribute("tabindex", "0");
  });

  it("annonce la position sans voler le focus", () => {
    rendre();
    const etat = screen.getByRole("status");
    expect(etat).toHaveTextContent("Verbatim 1 sur 3");
  });
});

describe("CarrouselVerbatims — on fait défiler", () => {
  it("avance et recule d'un verbatim, en disant où on est", async () => {
    rendre();
    expect(pastilles()[0]).toHaveAttribute("aria-current", "true");

    await userEvent.click(suivant());
    expect(pastilles()[1]).toHaveAttribute("aria-current", "true");
    expect(pastilles()[0]).not.toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Verbatim 2 sur 3");

    await userEvent.click(precedent());
    expect(pastilles()[0]).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Verbatim 1 sur 3");
  });

  it("va droit au verbatim d'une pastille", async () => {
    rendre();
    await userEvent.click(pastilles()[2]);
    expect(pastilles()[2]).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Verbatim 3 sur 3");
  });

  it("répond aux flèches du clavier quand la piste a le focus", async () => {
    rendre();
    piste().focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(pastilles()[1]).toHaveAttribute("aria-current", "true");
    await userEvent.keyboard("{ArrowLeft}");
    expect(pastilles()[0]).toHaveAttribute("aria-current", "true");
  });

  it("s'arrête aux deux bords, sans boucler et sans sortir du parcours clavier", async () => {
    rendre();
    // `aria-disabled` et non `disabled` : un bouton désactivé sort du parcours
    // clavier, donc disparaît au lecteur d'écran (convention du projet).
    expect(precedent()).toHaveAttribute("aria-disabled", "true");
    expect(precedent()).not.toBeDisabled();
    expect(suivant()).toHaveAttribute("aria-disabled", "false");

    await userEvent.click(precedent());
    expect(screen.getByRole("status")).toHaveTextContent("Verbatim 1 sur 3");

    await userEvent.click(suivant());
    await userEvent.click(suivant());
    expect(screen.getByRole("status")).toHaveTextContent("Verbatim 3 sur 3");
    expect(suivant()).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(suivant());
    expect(screen.getByRole("status")).toHaveTextContent("Verbatim 3 sur 3");
  });
});

describe("CarrouselVerbatims — la piste et les pastilles disent la même chose", () => {
  /** Donne une largeur à la piste (jsdom mesure tout à 0) et la fait défiler. */
  function defilerA(scrollLeft: number, largeur = 300) {
    const el = piste();
    Object.defineProperty(el, "clientWidth", { value: largeur, configurable: true });
    Object.defineProperty(el, "scrollLeft", {
      value: scrollLeft,
      configurable: true,
      writable: true,
    });
    fireEvent.scroll(el);
  }

  it("suit le doigt : défiler la piste met les pastilles à jour", () => {
    rendre();
    defilerA(600);
    expect(pastilles()[2]).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Verbatim 3 sur 3");
  });

  it("ignore les positions traversées par un défilement animé", async () => {
    // Un défilement en douceur passe par toutes les positions intermédiaires.
    // Sans garde-fou, la pastille reculerait d'un cran juste après le clic
    // (« Verbatim 2 » annoncé, puis « Verbatim 1 », puis « Verbatim 2 »).
    rendre();
    await userEvent.click(suivant());
    expect(screen.getByRole("status")).toHaveTextContent("Verbatim 2 sur 3");
    defilerA(20); // en route vers le verbatim 2
    expect(screen.getByRole("status")).toHaveTextContent("Verbatim 2 sur 3");
    defilerA(300); // arrivé
    expect(screen.getByRole("status")).toHaveTextContent("Verbatim 2 sur 3");
    // …et la piste reprend la main dès qu'on la fait défiler soi-même.
    defilerA(0);
    expect(screen.getByRole("status")).toHaveTextContent("Verbatim 1 sur 3");
  });

  it("rend la main au doigt même si l'animation est interrompue", () => {
    rendre();
    const el = piste();
    // Clic sur la flèche, puis le doigt reprend la piste avant l'arrivée : la
    // consigne de défilement est abandonnée, la position réelle fait foi.
    fireEvent.click(screen.getByRole("button", { name: /verbatim suivant/i }));
    fireEvent.pointerDown(el);
    defilerA(0);
    expect(screen.getByRole("status")).toHaveTextContent("Verbatim 1 sur 3");
  });
});

describe("CarrouselVerbatims — mouvement et cas limites", () => {
  it("coupe l'animation du défilement quand le mouvement réduit est demandé", async () => {
    const defiler = vi.fn();
    // jsdom ne défile pas : on observe l'ordre donné à la piste.
    Object.defineProperty(Element.prototype, "scrollTo", {
      value: defiler,
      configurable: true,
      writable: true,
    });
    const matchMedia = vi.fn((query: string) => ({
      matches: query.includes("reduced-motion"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.stubGlobal("matchMedia", matchMedia);

    rendre();
    await userEvent.click(suivant());
    expect(defiler).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));

    vi.unstubAllGlobals();
    Reflect.deleteProperty(Element.prototype, "scrollTo");
  });

  it("sans verbatim, il ne reste rien à faire défiler", () => {
    // Mieux rien qu'un cadre vide avec des flèches mortes.
    const { container } = render(
      <CarrouselVerbatims verbatims={[]} libelle="Verbatims du Tremplin" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("un seul verbatim : la citation, sans commandes de défilement", () => {
    rendre([VERBATIMS[0]]);
    expect(screen.getByText(/le bon challenge au bon moment/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /verbatim suivant/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Verbatim \d+ sur \d+$/ })).toBeNull();
  });

  it("aucune violation a11y (axe)", async () => {
    const { container } = rendre();
    expect(await axe(container)).toHaveNoViolations();
  });
});
