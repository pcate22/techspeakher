import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Isole le formulaire de l'action serveur (headers/BDD).
vi.mock("@/app/speakeuses/[id]/contact/actions", () => ({ sendMessageAction: vi.fn() }));

import ContactSpeakeuseForm from "@/app/speakeuses/[id]/contact/ContactSpeakeuseForm";
import { CONTACT_MOTIFS } from "@/data/contact-motifs";

afterEach(cleanup);

describe("ContactSpeakeuseForm", () => {
  it("propose un motif obligatoire avec tous les choix", () => {
    render(<ContactSpeakeuseForm profileId={5} nom="Marie" />);

    const motif = screen.getByLabelText(/motif du contact/i) as HTMLSelectElement;
    expect(motif).toBeInTheDocument();
    expect(motif.required).toBe(true);
    expect(motif.name).toBe("motif");
    // Chaque motif de la source unique doit être une option.
    for (const m of CONTACT_MOTIFS) {
      expect(
        screen.getByRole("option", { name: m.label }),
      ).toBeInTheDocument();
    }
  });

  it("expose les champs requis (nom, e-mail, message)", () => {
    render(<ContactSpeakeuseForm profileId={5} nom="Marie" />);
    expect(screen.getByLabelText(/votre nom/i)).toBeRequired();
    expect(screen.getByLabelText(/votre e-mail/i)).toBeRequired();
    expect(screen.getByLabelText(/^message/i)).toBeRequired();
  });
});
