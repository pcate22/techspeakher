import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import Footer from "@/components/Footer";
import { tousLesLiensNav } from "@/constants/navigation";
import { buildInvitationEmail } from "@/lib/invitation-email";
import { A_VENIR } from "@/data/nouveautes-plateforme";
import { BASE_URL } from "@/constants/site";

/**
 * LES ADHÉSIONS SONT OUVERTES (15 octobre 2026) : la page `/adherer` doit être
 * atteignable, et plus aucun texte ne doit annoncer une ouverture « à venir ».
 * Une page d'adhésion que rien ne relie, c'est une adhésion qu'on ne trouve pas.
 */

afterEach(cleanup);

describe("liens vers /adherer", () => {
  it("le menu principal mène à /adherer", () => {
    expect(tousLesLiensNav.map((l) => l.href)).toContain("/adherer");
  });

  it("le pied de page public mène à /adherer", () => {
    render(<Footer />);
    const pied = screen.getByRole("contentinfo");
    expect(within(pied).getByRole("link", { name: "Adhérer" })).toHaveAttribute("href", "/adherer");
  });

  it("l'e-mail d'invitation mène à /adherer et annonce les adhésions ouvertes", () => {
    const { htmlContent } = buildInvitationEmail({ name: "Ada L", email: "a@example.org", isOrga: false });
    expect(htmlContent).toContain(`href="${BASE_URL}/adherer"`);
    expect(htmlContent).not.toMatch(/lancé les adhésions|à venir/i);
  });

  it("aucune brève « à venir » n'annonce encore l'ouverture des adhésions", () => {
    for (const a of A_VENIR) {
      expect(a.texte).not.toMatch(/adhésions/i);
    }
  });
});
