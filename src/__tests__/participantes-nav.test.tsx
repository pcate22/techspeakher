import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ParticipantesNav, {
  type ParticipanteNavItem,
} from "@/app/admin/tremplins/[edition]/ParticipantesNav";

afterEach(cleanup);

/**
 * Lot D — une personne = UNE ligne (refonte §5). Les sections par phase
 * tripliquaient les mêmes personnes (22 cartes pour 10 inscrites en prod) : les
 * phases deviennent des pastilles sur la ligne, et un jeu de FILTRES remplace
 * le sectionnement.
 */

const SECTIONS = [
  { key: "cfp_et_pitch", titre: "Phase 1", court: "P1" },
  { key: "finale", titre: "Finale", court: "F" },
  { key: "montee_sur_scene", titre: "Phase 3", court: "P3" },
];

const item = (o: Partial<ParticipanteNavItem> & { id: number; nom: string }): ParticipanteNavItem => ({
  href: `/x/${o.id}`,
  sousTitre: "Inscrite",
  phaseKeys: [],
  ...o,
});

const troisPersonnes = [
  item({ id: 1, nom: "Camille Girard", phaseKeys: ["cfp_et_pitch", "finale", "montee_sur_scene"] }),
  item({ id: 2, nom: "Léa Dubois", phaseKeys: ["cfp_et_pitch"] }),
  item({ id: 3, nom: "Yasmine Roche", phaseKeys: ["montee_sur_scene"] }),
];

function lignes() {
  return screen.getAllByRole("listitem");
}

describe("ParticipantesNav — une personne, une ligne", () => {
  it("chaque inscrite apparaît UNE fois, même en trois phases", () => {
    render(<ParticipantesNav items={troisPersonnes} sections={SECTIONS} />);
    expect(lignes()).toHaveLength(3);
    expect(screen.getAllByText("Camille Girard")).toHaveLength(1);
  });

  it("ses phases se lisent sur sa ligne, en abrégé, avec l'équivalent parlé", () => {
    render(<ParticipantesNav items={troisPersonnes} sections={SECTIONS} />);
    const camille = screen.getByText("Camille Girard").closest("li")!;
    expect(within(camille).getByText("P1·F·P3")).toBeInTheDocument();
    // Les abréviations sont décoratives : le texte complet est lu à la place.
    expect(within(camille).getByText(/Phase 1, Finale, Phase 3/)).toBeInTheDocument();
  });

  it("l'en-tête compte les personnes, pas les participations", () => {
    render(<ParticipantesNav items={troisPersonnes} sections={SECTIONS} />);
    expect(screen.getByRole("heading", { name: /3 inscrites/i })).toBeInTheDocument();
  });
});

describe("ParticipantesNav — KISS : un seul indicateur par ligne", () => {
  it("aucun pictogramme d'état : la ligne porte le nom, ce qu'elle pitche, ses phases", () => {
    render(
      <ParticipantesNav
        items={[item({ id: 1, nom: "Camille Girard", sousTitre: "« Mon talk » · 1ᵉʳ prix", phaseKeys: ["finale"] })]}
        sections={SECTIONS}
      />,
    );
    const ligne = screen.getByText("Camille Girard").closest("li")!;
    // Les symboles à décoder (✓ ● ★ 🏆) ont disparu : ce qui compte est écrit.
    for (const glyphe of ["✓", "●", "★", "🏆"]) {
      expect(ligne.textContent).not.toContain(glyphe);
    }
    expect(ligne.textContent).toMatch(/1ᵉʳ prix/);
  });

  it("plus de légende à décoder sous la liste", () => {
    render(<ParticipantesNav items={troisPersonnes} sections={SECTIONS} />);
    expect(screen.queryByText(/compte relié · .* visible du public/)).toBeNull();
  });
});

describe("ParticipantesNav — filtres par phase", () => {
  it("un filtre par phase, avec son compte, et « Toutes » actif au départ", () => {
    render(<ParticipantesNav items={troisPersonnes} sections={SECTIONS} />);
    const toutes = screen.getByRole("button", { name: /Toutes \(3\)/ });
    expect(toutes).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Phase 1 \(2\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Finale \(1\)/ })).toBeInTheDocument();
  });

  it("filtrer sur une phase ne garde que ses participantes", async () => {
    const u = userEvent.setup();
    render(<ParticipantesNav items={troisPersonnes} sections={SECTIONS} />);
    await u.click(screen.getByRole("button", { name: /Phase 3 \(2\)/ }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText("Léa Dubois")).toBeNull();
  });

  it("un filtre vide le dit, et laisse revenir à toutes", async () => {
    const u = userEvent.setup();
    render(
      <ParticipantesNav items={[item({ id: 9, nom: "Solo" })]} sections={SECTIONS} />,
    );
    await u.click(screen.getByRole("button", { name: /Phase 1 \(0\)/ }));
    expect(screen.getByRole("status")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: /Toutes \(1\)/ }));
    expect(screen.getByText("Solo")).toBeInTheDocument();
  });

  it("sans phase renseignée : la personne reste visible dans « Toutes »", () => {
    render(<ParticipantesNav items={[item({ id: 9, nom: "Neuve" })]} sections={SECTIONS} />);
    expect(screen.getByText("Neuve")).toBeInTheDocument();
  });
});

describe("ParticipantesNav — recherche par nom", () => {
  // Le champ de recherche n'apparaît qu'au-delà de 5 personnes : filtrer trois
  // lignes serait du bruit (la liste tient à l'écran).
  const sixPersonnes = [
    ...troisPersonnes,
    item({ id: 4, nom: "Aïcha Benali", phaseKeys: ["cfp_et_pitch"] }),
    item({ id: 5, nom: "Nadia Lopez", phaseKeys: ["finale"] }),
    item({ id: 6, nom: "Manon Girard", phaseKeys: [] }),
  ];

  it("le champ n'apparaît que sur une liste longue", () => {
    render(<ParticipantesNav items={troisPersonnes} sections={SECTIONS} />);
    expect(screen.queryByLabelText(/filtrer les participantes/i)).toBeNull();
  });

  it("le filtre texte s'applique avec le filtre de phase", async () => {
    const u = userEvent.setup();
    render(<ParticipantesNav items={sixPersonnes} sections={SECTIONS} />);
    await u.type(screen.getByLabelText(/filtrer les participantes/i), "lea");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Léa Dubois")).toBeInTheDocument();
  });

  it("recherche sans résultat : le dit avec la requête", async () => {
    const u = userEvent.setup();
    render(<ParticipantesNav items={sixPersonnes} sections={SECTIONS} />);
    await u.type(screen.getByLabelText(/filtrer les participantes/i), "zzz");
    expect(screen.getByRole("status").textContent).toMatch(/zzz/);
  });

  it("le résumé vit dans une région vivante, les filtres dans un groupe nommé", () => {
    render(<ParticipantesNav items={troisPersonnes} sections={SECTIONS} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("group", { name: "Filtrer par phase" })).toBeInTheDocument();
    expect(screen.queryAllByRole("tablist")).toHaveLength(0);
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });
});
