import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

import VerifieEmail from "@/app/connexion/verifie/page";

afterEach(cleanup);

describe("Page /connexion/verifie", () => {
  it("a un titre accessible", () => {
    render(<VerifieEmail />);
    expect(
      screen.getByRole("heading", { level: 1, name: /vérifie ta boîte mail/i }),
    ).toBeInTheDocument();
  });

  it("propose des raccourcis vers les webmails courants (ouverture directe de la boîte)", () => {
    render(<VerifieEmail />);

    const gmail = screen.getByRole("link", { name: /gmail/i });
    const outlook = screen.getByRole("link", { name: /outlook/i });
    const yahoo = screen.getByRole("link", { name: /yahoo/i });
    const icloud = screen.getByRole("link", { name: /icloud/i });

    expect(gmail).toHaveAttribute("href", expect.stringContaining("mail.google.com"));
    expect(outlook).toHaveAttribute("href", expect.stringContaining("outlook.live.com"));
    expect(yahoo).toHaveAttribute("href", expect.stringContaining("mail.yahoo.com"));
    expect(icloud).toHaveAttribute("href", expect.stringContaining("icloud.com"));
  });

  it("ouvre chaque webmail dans un nouvel onglet, en toute sécurité, avec mention pour lecteur d'écran", () => {
    render(<VerifieEmail />);
    for (const name of [/gmail/i, /outlook/i, /yahoo/i, /icloud/i]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
      expect(within(link).getByText(/nouvel onglet/i)).toBeInTheDocument();
    }
  });

  it("garde le rappel « pas de mail » et le retour à l'accueil", () => {
    render(<VerifieEmail />);
    expect(screen.getByRole("link", { name: /redemande un lien/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /retour à l'accueil/i })).toBeInTheDocument();
  });
});
