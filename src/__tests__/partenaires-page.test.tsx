import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// La section des accompagnantes lit la base : hors sujet ici.
vi.mock("@/lib/coach-profiles", () => ({ listAccompagnantesPubliques: async () => [] }));
vi.mock("@/lib/profiles", () => ({ countPublishedProfiles: async () => 0 /* zéro : le chiffre s'efface */ }));

import Partenaires from "@/app/partenaires/page";
import { HELLOASSO_SOUTIEN_URL } from "@/constants/site";

afterEach(cleanup);

describe("/partenaires", () => {
  it("le kit de communication quitte la landing : rien au milieu du parcours ne fait sortir de la page", async () => {
    render(await Partenaires());
    // Il reste atteignable par le pied de page (colonne « Nous soutenir »,
    // gardée par footer-coquille-app.test.tsx).
    expect(screen.queryByRole("link", { name: /kit de communication/i })).toBeNull();
  });

  it("chaque bouton principal mène à la même action : soutenir sur HelloAsso", async () => {
    const { container } = render(await Partenaires());
    // Répété en tête, après les rangées, à la fin et en bas d'écran mobile,
    // mais une seule ACTION : un bouton principal vers une autre destination
    // casserait la règle « un rôle, un CTA ».
    const principaux = [...container.querySelectorAll("a.bg-magenta")];
    expect(principaux.length).toBeGreaterThan(0);
    for (const a of principaux) expect(a).toHaveAttribute("href", HELLOASSO_SOUTIEN_URL);
  });
});
