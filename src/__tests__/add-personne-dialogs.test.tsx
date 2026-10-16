import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Les modales n'appellent l'action qu'à la soumission (jamais dans ces tests) ;
// on mocke le module d'actions pour ne pas charger le code serveur (pg/auth).
vi.mock("@/app/admin/tremplins/actions", () => ({
  addParticipanteAction: vi.fn(),
  addCoachAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import AddParticipanteDialog from "@/app/admin/tremplins/[edition]/AddParticipanteDialog";
import AddCoachDialog from "@/app/admin/tremplins/[edition]/AddCoachDialog";

afterEach(cleanup);

const comptes = [
  { id: 1, label: "Ada Lovelace", sousTitre: "ada@example.fr" },
  { id: 2, label: "Grace Hopper" },
];

describe("AddParticipanteDialog (#28 champ personne)", () => {
  it("ouvre la modale sur un champ personne (combobox) + editionId caché, sans select figé", () => {
    render(<AddParticipanteDialog editionId={7} comptes={comptes} />);
    fireEvent.click(screen.getByRole("button", { name: /Ajouter une participante/i }));
    expect(screen.getByRole("combobox", { name: /speakeuse/i })).toBeTruthy();
    const hidden = document.querySelector('input[type="hidden"][name="editionId"]') as HTMLInputElement;
    expect(hidden?.value).toBe("7");
  });
});

describe("AddCoachDialog (#28 champ personne)", () => {
  it("ouvre la modale : champ de RECHERCHE seul (le mini-formulaire n'apparaît pas tant qu'on n'invite pas)", () => {
    render(<AddCoachDialog editionId={3} atelierId={9} cible="« Pitch »" comptes={comptes} />);
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un coach/i }));
    expect(screen.getByRole("combobox", { name: /coach/i })).toBeTruthy();
    // Rien d'autre à l'écran : « Prénom et nom » ne s'affiche qu'après avoir
    // choisi « ajouter une personne inconnue » (plus de champ qui traîne).
    expect(screen.queryByLabelText(/Prénom et nom/i)).toBeNull();
    // La cible (atelier) est transmise en caché.
    expect(document.querySelector('input[type="hidden"][name="atelierId"]')).toBeTruthy();
  });

  it("personne inconnue : révèle le mini-formulaire prénom/nom + e-mail + genre (e-mail et genre requis)", () => {
    render(<AddCoachDialog editionId={3} atelierId={9} cible="« Pitch »" comptes={comptes} />);
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un coach/i }));
    fireEvent.change(screen.getByRole("combobox", { name: /coach/i }), { target: { value: "Zoé" } });
    fireEvent.click(screen.getByRole("option", { name: /inconnue/i }));
    // Le nom tapé pré-remplit « Prénom et nom ».
    expect(screen.getByLabelText(/Prénom et nom/i)).toHaveValue("Zoé");
    expect(screen.getByLabelText(/Son e-mail/i)).toBeRequired();
    expect(screen.getByLabelText(/Genre/i)).toBeRequired();
  });
});
