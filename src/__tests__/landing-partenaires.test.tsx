import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

const comptes = vi.hoisted(() => ({ speakeuses: 42 as number | null }));
vi.mock("@/lib/coach-profiles", () => ({ listAccompagnantesPubliques: async () => [] }));
vi.mock("@/lib/profiles", () => ({
  countPublishedProfiles: async () => {
    if (comptes.speakeuses == null) throw new Error("base injoignable");
    return comptes.speakeuses;
  },
}));

import Partenaires from "@/app/partenaires/page";
import { HELLOASSO_SOUTIEN_URL } from "@/constants/site";
import { partenaires, typesSoutien } from "@/data/partenaires";

/**
 * LA LANDING PARTENAIRES CONVERTIT (grille Scalezia, revue du 06/10/2026).
 * Une action principale, la même partout : soutenir sur HelloAsso. Une action
 * secondaire : nous contacter pour les autres formes d'aide. Les preuves (les
 * structures qui nous soutiennent déjà) viennent avant la demande.
 */

afterEach(cleanup);
beforeEach(() => {
  comptes.speakeuses = 42;
});

describe("landing partenaires", () => {
  it("le titre principal dit à qui la page parle", async () => {
    render(await Partenaires());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/partenaire/i);
  });

  it("l'action principale, répétée, mène toujours à la campagne de soutien", async () => {
    render(await Partenaires());
    const ctas = screen.getAllByRole("link", { name: /Soutenir sur HelloAsso/ });
    // En-tête, après les rangées, appel final : au moins trois rencontres.
    expect(ctas.length).toBeGreaterThanOrEqual(3);
    for (const l of ctas) expect(l).toHaveAttribute("href", HELLOASSO_SOUTIEN_URL);
  });

  it("l'action secondaire mène au contact, pour les autres formes d'aide", async () => {
    render(await Partenaires());
    const contacts = screen.getAllByRole("link", { name: /Nous contacter/ });
    expect(contacts.length).toBeGreaterThanOrEqual(1);
    for (const l of contacts) expect(l).toHaveAttribute("href", "/contact");
  });

  // Re-jugé le 2026-10-15 : « Sponsors » et « Écosystème » deviennent une
  // rangée par façon d'aider (demande de Cateline), avant les questions.
  it("une rangée par façon d'aider, avec chaque structure qui le fait déjà, avant la première question", async () => {
    render(await Partenaires());
    const preuves = screen.getByRole("region", { name: /Qui nous aide déjà/ });
    const questions = screen.getByRole("region", { name: /Vous vous reconnaissez/ });
    for (const t of typesSoutien) {
      const rangee = within(preuves).getByRole("group", { name: t.titre });
      for (const m of t.membres) {
        expect(within(rangee).getByRole("heading", { name: m.nom })).toBeInTheDocument();
      }
    }
    expect(preuves.compareDocumentPosition(questions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("chaque structure de l'annuaire apparaît dans au moins une rangée", () => {
    const cites = new Set(typesSoutien.flatMap((t) => t.membres.map((m) => m.nom)));
    for (const p of partenaires) expect(cites, p.name).toContain(p.name);
    for (const nom of cites) expect(partenaires.map((p) => p.name), nom).toContain(nom);
  });

  it("une rangée vide invite à être la première, vers le soutien HelloAsso", async () => {
    render(await Partenaires());
    const vide = typesSoutien.find((t) => t.membres.length === 0);
    if (!vide) return;
    const rangee = screen.getByRole("group", { name: vide.titre });
    expect(within(rangee).getByRole("link", { name: /Soutenir sur HelloAsso/ })).toHaveAttribute(
      "href",
      HELLOASSO_SOUTIEN_URL,
    );
  });

  it("chaque rangée défile au clavier : elle prend le focus", async () => {
    render(await Partenaires());
    for (const t of typesSoutien) {
      expect(screen.getByRole("group", { name: t.titre })).toHaveAttribute("tabindex", "0");
    }
  });

  // Re-jugé le 2026-10-15 : la phrase et le lien du jury se disent UNE fois
  // pour la rangée, plus sur chaque carte (demande de Cateline).
  it("la rangée du jury mène une seule fois au jury du Tremplin", async () => {
    render(await Partenaires());
    const jury = typesSoutien.find((t) => t.lien);
    expect(jury).toBeDefined();
    const liens = screen.getAllByRole("link", { name: jury!.lien!.label });
    expect(liens).toHaveLength(1);
    expect(liens[0]).toHaveAttribute("href", jury!.lien!.href);
  });

  // Re-jugé le 2026-10-15 : chaque carte garde le lien du site de sa
  // structure, même en double (le lien GDG manquait sur la co-organisation).
  it("chaque carte d'une structure qui a un site y mène", async () => {
    render(await Partenaires());
    for (const t of typesSoutien) {
      const rangee = screen.getByRole("group", { name: t.titre });
      for (const m of t.membres) {
        const url = partenaires.find((p) => p.name === m.nom)?.url;
        if (!url) continue;
        const liens = within(rangee).getAllByRole("link").filter((l) => l.getAttribute("href") === url);
        expect(liens, `${t.id} / ${m.nom}`).toHaveLength(1);
      }
    }
  });

  it("un outil gratuit ouvert à toutes n'est pas un soutien : lien sans rel=sponsored", async () => {
    render(await Partenaires());
    const outil = partenaires.find((p) => p.name === "The Playground");
    expect(outil?.soutien).toBeFalsy();
  });

  it("affiche le nombre de speakeuses quand la base répond, et rien d'inventé sinon", async () => {
    render(await Partenaires());
    const preuves = screen.getByRole("region", { name: /Qui nous aide déjà/ });
    expect(within(preuves).getByText("42")).toBeInTheDocument();
    cleanup();
    comptes.speakeuses = null;
    render(await Partenaires());
    expect(screen.queryByText(/speakeuses dans l.annuaire/)).toBeNull();
  });

  it("le bénévolat est une forme de soutien : la FAQ dit comment", async () => {
    render(await Partenaires());
    const faq = screen.getByRole("region", { name: /Questions fréquentes/ });
    expect(faq).toHaveTextContent(/donner de son temps/);
    expect(faq).toHaveTextContent(/coachs bénévoles/);
  });

  it("la FAQ dit ce que le soutien est, et ce qu'il donne", async () => {
    render(await Partenaires());
    const faq = screen.getByRole("region", { name: /Questions fréquentes/ });
    expect(faq).toHaveTextContent(/100\s€/);
    expect(faq).toHaveTextContent(/reçu fiscal/);
    expect(faq).toHaveTextContent(/adhésion/);
  });
});
