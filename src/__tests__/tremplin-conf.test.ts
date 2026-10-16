import { describe, it, expect, vi } from "vitest";
import { confDedicatedPage, confHubHref, nomConference } from "@/lib/tremplin-conf";

describe("nomConference — nom affiché composé (marque + lieu)", () => {
  it("compose marque et lieu quand les deux sont présents", () => {
    expect(nomConference("DevFest", "Toulouse")).toBe("DevFest Toulouse");
    expect(nomConference("Devoxx", "France")).toBe("Devoxx France");
  });

  it("lieu absent (mono-lieu : Mix-IT, Agile on the Beach) → marque seule", () => {
    expect(nomConference("Mix-IT", null)).toBe("Mix-IT");
    expect(nomConference("Mix-IT", "")).toBe("Mix-IT");
    expect(nomConference("Agile on the Beach", "  ")).toBe("Agile on the Beach");
  });

  it("marque absente → lieu seul, sinon chaîne vide (le libellé de repli reste au parent)", () => {
    expect(nomConference(null, "Toulouse")).toBe("Toulouse");
    expect(nomConference(null, null)).toBe("");
  });
});

describe("tremplin-conf — routage du hub d'une conférence", () => {
  it("renvoie la page dédiée pour une conf qui en a une", () => {
    expect(confDedicatedPage("devfest-toulouse")).toBe("/devfest-toulouse");
    expect(confHubHref("devfest-toulouse")).toBe("/devfest-toulouse");
  });

  it("retombe sur la page générique pour une conf sans page dédiée", () => {
    expect(confDedicatedPage("devoxx")).toBeNull();
    expect(confHubHref("devoxx")).toBe("/tremplin/devoxx");
  });
});

describe("/tremplin/[conf] — redirection vers la page dédiée", () => {
  it("redirige /tremplin/devfest-toulouse vers /devfest-toulouse sans toucher la BDD", async () => {
    const permanentRedirect = vi.fn((p: string) => {
      throw new Error(`PERMANENT_REDIRECT:${p}`);
    });
    const getEditionsByConfSlug = vi.fn();
    vi.doMock("next/navigation", () => ({ permanentRedirect, notFound: vi.fn() }));
    vi.doMock("@/lib/tremplin-editions", () => ({ getEditionsByConfSlug }));

    const { default: ConfPage } = await import("@/app/tremplin/[conf]/page");
    await expect(
      ConfPage({ params: Promise.resolve({ conf: "devfest-toulouse" }) }),
    ).rejects.toThrow("PERMANENT_REDIRECT:/devfest-toulouse");
    // La redirection court-circuite avant toute requête BDD.
    expect(getEditionsByConfSlug).not.toHaveBeenCalled();

    vi.doUnmock("next/navigation");
    vi.doUnmock("@/lib/tremplin-editions");
    vi.resetModules();
  });
});
