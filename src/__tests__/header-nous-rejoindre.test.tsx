import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "unauthenticated" }),
  signOut: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/components/SearchBar", () => ({ default: () => <span data-testid="searchbar" /> }));

import Header from "@/components/Header";
import { navLinks, navRejoindre } from "@/constants/navigation";

/**
 * « NOUS REJOINDRE » (2026-10-15) : le header portait sept liens, dont deux
 * façons de s'engager (Adhérer, Partenaires) et aucune pour les bénévoles.
 * Les façons de s'engager se rangent sous UN menu déroulant, chacune avec sa
 * phrase : on choisit son chemin sans deviner ce que cache un mot.
 */

beforeEach(() => cleanup());
afterEach(() => cleanup());

const ordinateur = () => within(screen.getByRole("navigation", { name: "Navigation principale" }));

describe("navigation : les façons de s'engager sont regroupées", () => {
  it("le premier niveau laisse les façons de s'engager au menu « Nous rejoindre »", () => {
    const hrefs = navLinks.map((l) => l.href);
    for (const l of navRejoindre.links) expect(hrefs).not.toContain(l.href);
  });

  it("le menu mène à adhérer, au bénévolat et au soutien des entreprises, chacun avec sa phrase", () => {
    expect(navRejoindre.links.map((l) => l.href)).toEqual(["/adherer", "/benevole", "/partenaires"]);
    for (const l of navRejoindre.links) expect(l.detail.length).toBeGreaterThan(10);
  });
});

describe("Header : menu déroulant « Nous rejoindre » (ordinateur)", () => {
  it("fermé au départ : un bouton qui annonce son état, sans liens visibles", () => {
    render(<Header />);
    const bouton = ordinateur().getByRole("button", { name: "Nous rejoindre" });
    expect(bouton).toHaveAttribute("aria-expanded", "false");
    expect(ordinateur().queryByRole("link", { name: /adhérer/i })).toBeNull();
  });

  it("ouvert : les trois chemins, avec leur destination", async () => {
    const u = userEvent.setup();
    render(<Header />);
    await u.click(ordinateur().getByRole("button", { name: "Nous rejoindre" }));
    expect(ordinateur().getByRole("button", { name: "Nous rejoindre" })).toHaveAttribute("aria-expanded", "true");
    for (const l of navRejoindre.links) {
      expect(ordinateur().getByRole("link", { name: new RegExp(l.label, "i") })).toHaveAttribute("href", l.href);
    }
  });

  it("Échap referme le menu et rend le focus au bouton", async () => {
    const u = userEvent.setup();
    render(<Header />);
    const bouton = ordinateur().getByRole("button", { name: "Nous rejoindre" });
    await u.click(bouton);
    await u.keyboard("{Escape}");
    expect(bouton).toHaveAttribute("aria-expanded", "false");
    expect(bouton).toHaveFocus();
  });

  it("le focus qui sort du menu au clavier le referme (WCAG 2.4.3)", async () => {
    const u = userEvent.setup();
    render(<Header />);
    const bouton = ordinateur().getByRole("button", { name: "Nous rejoindre" });
    await u.click(bouton);
    // Le bouton, puis les trois liens, puis on sort.
    for (let i = 0; i < navRejoindre.links.length + 1; i++) await u.tab();
    expect(bouton).toHaveAttribute("aria-expanded", "false");
  });

  it("un clic ailleurs referme le menu", async () => {
    const u = userEvent.setup();
    render(<Header />);
    const bouton = ordinateur().getByRole("button", { name: "Nous rejoindre" });
    await u.click(bouton);
    await u.click(document.body);
    expect(bouton).toHaveAttribute("aria-expanded", "false");
  });
});

describe("Header : tiroir mobile", () => {
  it("le tiroir montre les trois chemins sous un titre « Nous rejoindre »", async () => {
    const u = userEvent.setup();
    render(<Header />);
    await u.click(screen.getByRole("button", { name: /ouvrir le menu/i }));
    const tiroir = within(document.getElementById("mobile-menu") as HTMLElement);
    const groupe = within(tiroir.getByRole("list", { name: "Nous rejoindre" }));
    for (const l of navRejoindre.links) {
      expect(groupe.getByRole("link", { name: new RegExp(l.label, "i") })).toHaveAttribute("href", l.href);
    }
  });
});
