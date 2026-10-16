import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import PersonPicker from "@/components/PersonPicker";

afterEach(cleanup);

// Noms d'exemple FICTIFS (figures historiques) : jamais de vraie personne de
// la communauté dans des fixtures, même de test (RGPD).
const candidats = [
  { id: 1, label: "Grace Hopper", sousTitre: "grace@exemple.fr" },
  { id: 2, label: "Katherine Johnson" },
  { id: 3, label: "Ada Lovelace" },
];

const combo = () => screen.getByRole("combobox");

describe("PersonPicker — combobox personne (multi + création)", () => {
  it("filtre les options au fil de la saisie (accents/casse ignorés)", () => {
    render(<PersonPicker name="coachIds" candidats={candidats} multiple ariaLabel="Coachs" />);
    fireEvent.change(combo(), { target: { value: "grace" } });
    expect(screen.getByRole("option", { name: /Grace Hopper/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Katherine/ })).toBeNull();
  });

  it("sélectionne une option (clic) → jeton + input caché avec l'id", () => {
    const { container } = render(
      <PersonPicker name="coachIds" candidats={candidats} multiple ariaLabel="Coachs" />,
    );
    fireEvent.change(combo(), { target: { value: "grace" } });
    fireEvent.click(screen.getByRole("option", { name: /Grace Hopper/ }));
    const hidden = container.querySelector('input[type="hidden"][name="coachIds"]');
    expect(hidden?.getAttribute("value")).toBe("1");
  });

  it("multi : plusieurs sélections cumulées", () => {
    const { container } = render(
      <PersonPicker name="coachIds" candidats={candidats} multiple ariaLabel="Coachs" />,
    );
    fireEvent.change(combo(), { target: { value: "grace" } });
    fireEvent.click(screen.getByRole("option", { name: /Grace/ }));
    fireEvent.change(combo(), { target: { value: "katherine" } });
    fireEvent.click(screen.getByRole("option", { name: /Katherine/ }));
    expect(container.querySelectorAll('input[type="hidden"][name="coachIds"]').length).toBe(2);
  });

  it("mono : une seule sélection, remplacée via « Changer »", () => {
    const { container } = render(
      <PersonPicker name="coachId" candidats={candidats} ariaLabel="Coach" />,
    );
    fireEvent.change(combo(), { target: { value: "grace" } });
    fireEvent.click(screen.getByRole("option", { name: /Grace/ }));
    // En mono, la valeur choisie REMPLACE le champ ; « Changer » le rouvre.
    fireEvent.click(screen.getByRole("button", { name: /changer/i }));
    fireEvent.change(combo(), { target: { value: "katherine" } });
    fireEvent.click(screen.getByRole("option", { name: /Katherine/ }));
    const hidden = container.querySelectorAll('input[type="hidden"][name="coachId"]');
    expect(hidden.length).toBe(1);
    expect(hidden[0].getAttribute("value")).toBe("2");
  });

  it("retire un jeton sélectionné", () => {
    const { container } = render(
      <PersonPicker name="coachIds" candidats={candidats} multiple ariaLabel="Coachs" />,
    );
    fireEvent.change(combo(), { target: { value: "grace" } });
    fireEvent.click(screen.getByRole("option", { name: /Grace/ }));
    fireEvent.click(screen.getByRole("button", { name: /Retirer Grace Hopper/ }));
    expect(container.querySelector('input[type="hidden"][name="coachIds"]')).toBeNull();
  });

  it("clavier : flèche bas puis Entrée sélectionne", () => {
    const { container } = render(
      <PersonPicker name="coachIds" candidats={candidats} multiple ariaLabel="Coachs" />,
    );
    fireEvent.change(combo(), { target: { value: "a" } });
    fireEvent.keyDown(combo(), { key: "ArrowDown" });
    fireEvent.keyDown(combo(), { key: "Enter" });
    expect(container.querySelector('input[type="hidden"][name="coachIds"]')).toBeTruthy();
  });

  it("clavier : flèche bas sur liste fermée surligne la 1re option (pas de saut)", () => {
    const { container } = render(
      <PersonPicker name="coachId" candidats={candidats} ariaLabel="Compte" />,
    );
    // "grace" ne matche que la 1re option (id 1).
    fireEvent.change(combo(), { target: { value: "grace" } });
    fireEvent.keyDown(combo(), { key: "Escape" }); // ferme la liste
    fireEvent.keyDown(combo(), { key: "ArrowDown" }); // rouvre + surligne index 0
    fireEvent.keyDown(combo(), { key: "Enter" }); // sélectionne la 1re
    const hidden = container.querySelector('input[type="hidden"][name="coachId"]');
    expect(hidden?.getAttribute("value")).toBe("1");
  });

  it("propose « Créer … » et révèle le bloc de création", () => {
    render(
      <PersonPicker
        name="coachIds"
        candidats={candidats}
        multiple
        ariaLabel="Coachs"
        createLabel={(q) => `Créer « ${q} »`}
      >
        {(q) => <input aria-label="email nouveau coach" defaultValue={q} />}
      </PersonPicker>,
    );
    fireEvent.change(combo(), { target: { value: "Hedy" } });
    fireEvent.click(screen.getByRole("option", { name: /Créer « Hedy »/ }));
    expect(screen.getByLabelText("email nouveau coach")).toBeTruthy();
  });

  it("expose le patron ARIA combobox (expanded + listbox)", () => {
    render(<PersonPicker name="coachIds" candidats={candidats} multiple ariaLabel="Coachs" />);
    const c = combo();
    expect(c.getAttribute("aria-expanded")).toBe("false");
    fireEvent.change(c, { target: { value: "grace" } });
    expect(c.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("0 résultat : aria-expanded reste false, pas de aria-controls, message d'état annoncé", () => {
    render(<PersonPicker name="coachId" candidats={candidats} ariaLabel="Compte" emptyLabel="Aucun compte." />);
    const c = combo();
    fireEvent.change(c, { target: { value: "zzz" } }); // ne matche rien, pas de « Créer »
    // Pas de listbox → l'état « expanded » ne doit pas mentir ni pointer un id absent.
    expect(c.getAttribute("aria-expanded")).toBe("false");
    expect(c.getAttribute("aria-controls")).toBeNull();
    expect(screen.queryByRole("listbox")).toBeNull();
    // Message d'état présent (dans une région vivante persistante).
    expect(screen.getByText("Aucun compte.")).toBeInTheDocument();
  });

  it("Échap replie la liste sans laisser fuir l'événement (le <dialog> parent ne doit pas se fermer)", () => {
    render(<PersonPicker name="coachId" candidats={candidats} ariaLabel="Compte" />);
    const c = combo();
    fireEvent.change(c, { target: { value: "grace" } });
    expect(screen.getByRole("listbox")).toBeTruthy();
    // fireEvent renvoie false si preventDefault a été appelé : liste ouverte → on capte Échap.
    const notPrevented = fireEvent.keyDown(c, { key: "Escape" });
    expect(notPrevented).toBe(false);
    expect(screen.queryByRole("listbox")).toBeNull();
    // Liste fermée → Échap laisse passer (le dialog gère sa fermeture).
    const notPrevented2 = fireEvent.keyDown(c, { key: "Escape" });
    expect(notPrevented2).toBe(true);
  });

  it("mono + sélection : le champ est remplacé par la valeur (plus de ligne vide trompeuse) ; « Changer » le rouvre", () => {
    const { container } = render(
      <PersonPicker name="coachId" candidats={candidats} ariaLabel="Compte" createLabel={(q) => `Créer « ${q} »`}>
        {(q) => <input aria-label="email" defaultValue={q} />}
      </PersonPicker>,
    );
    fireEvent.change(combo(), { target: { value: "grace" } });
    fireEvent.click(screen.getByRole("option", { name: /Grace/ }));
    expect(container.querySelector('input[type="hidden"][name="coachId"]')).toBeTruthy();
    // En mono, la valeur choisie remplace le champ : plus de combobox « vide »
    // qui laisserait croire qu'on peut en ajouter une seconde (retour preview).
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    // « Changer » rouvre le champ (rien ne se perd en silence : on rechoisit).
    fireEvent.click(screen.getByRole("button", { name: /changer/i }));
    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(container.querySelector('input[type="hidden"][name="coachId"]')).toBeNull();
    fireEvent.change(combo(), { target: { value: "Hedy" } });
    expect(screen.getByRole("option", { name: /Créer « Hedy »/ })).toBeTruthy();
  });

  it("multi : choisir une connue avec le bloc e-mail OUVERT conserve le bloc (rien ne se perd)", () => {
    render(
      <PersonPicker name="compteId" candidats={candidats} multiple ariaLabel="Speakeuses" createLabel={(q) => `Créer « ${q} »`}>
        {(q) => <input aria-label="email" defaultValue={q} />}
      </PersonPicker>,
    );
    fireEvent.change(combo(), { target: { value: "Hedy" } });
    fireEvent.click(screen.getByRole("option", { name: /Créer « Hedy »/ }));
    expect(screen.getByLabelText("email")).toBeTruthy();
    // On ajoute ENSUITE une connue : le bloc e-mail reste ouvert.
    fireEvent.change(combo(), { target: { value: "grace" } });
    fireEvent.click(screen.getByRole("option", { name: /Grace/ }));
    expect(screen.getByLabelText("email")).toBeTruthy();
  });

  it("une seule invitation par envoi : « Créer » n'est plus proposé tant que le bloc est ouvert", () => {
    render(
      <PersonPicker name="compteId" candidats={candidats} multiple ariaLabel="Speakeuses" createLabel={(q) => `Créer « ${q} »`}>
        {(q) => <input aria-label="email" defaultValue={q} />}
      </PersonPicker>,
    );
    fireEvent.change(combo(), { target: { value: "Hedy" } });
    fireEvent.click(screen.getByRole("option", { name: /Créer « Hedy »/ }));
    fireEvent.change(combo(), { target: { value: "Zoé" } });
    expect(screen.queryByRole("option", { name: /Créer « Zoé »/ })).toBeNull();
  });

  it("multi : ouvrir « Créer … » CONSERVE les sélections en cours (connue + invitée cumulées)", () => {
    const { container } = render(
      <PersonPicker name="compteId" candidats={candidats} multiple ariaLabel="Speakeuses" createLabel={(q) => `Créer « ${q} »`}>
        {(q) => <input aria-label="email" defaultValue={q} />}
      </PersonPicker>,
    );
    fireEvent.change(combo(), { target: { value: "grace" } });
    fireEvent.click(screen.getByRole("option", { name: /Grace/ }));
    fireEvent.change(combo(), { target: { value: "Hedy" } });
    fireEvent.click(screen.getByRole("option", { name: /Créer « Hedy »/ }));
    // Le bloc de création est ouvert ET Grace est toujours sélectionnée.
    expect(screen.getByLabelText("email")).toBeTruthy();
    expect(container.querySelector('input[type="hidden"][name="compteId"]')).toBeTruthy();
  });
});
