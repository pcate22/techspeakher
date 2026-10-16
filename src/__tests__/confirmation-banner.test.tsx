import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ConfirmationBanner from "@/components/ConfirmationBanner";

/**
 * LE BANDEAU DE CONFIRMATION, et le seul de ses deux contrats qui n'était gardé
 * par rien : il NETTOIE l'URL, pour qu'un rechargement ne ré-annonce pas un
 * geste déjà fait.
 *
 * Sa liste de paramètres est FERMÉE, et elle a dérivé quatre fois : les huit
 * premiers n'ont jamais eu de test, et le lot d'arbitrage en a ajouté quatre
 * (`prop`, `nom`, `talks`, `corrige`) — dont la re-revue du 2026-08-22 a montré
 * que le retrait passait toute la suite au vert. Une règle fermée sans test
 * dérive au paramètre suivant.
 *
 * Ce banc garde la RÈGLE, pas la liste : tout paramètre de confirmation posé par
 * un PRG du dépôt s'efface, et rien d'autre ne s'efface avec.
 */
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Pose l'URL courante (jsdom) et rend le bandeau. */
function surLUrl(url: string) {
  window.history.replaceState(null, "", url);
  render(<ConfirmationBanner message="C'est enregistré." />);
}

describe("ConfirmationBanner — le nettoyage de l'URL", () => {
  it("efface CHAQUE paramètre de confirmation du dépôt", async () => {
    // Un par PRG existant : création, suppression, amorçage, arbitrage… La
    // liste du composant est l'union de ces sources, et c'est elle qui dérive.
    const params = [
      "cree=1",
      "edition-suppr=1",
      "supprimee=DevFest",
      "suppr=refus",
      "seed=12",
      "ok=1",
      "err=quota",
      "n=3",
      "prop=validee",
      "nom=Devoxx%20France",
      "talks=2",
      "corrige=Devoxx%20France",
    ];
    surLUrl(`/admin/conferences/propositions?${params.join("&")}`);
    expect(await screen.findByText("C'est enregistré.")).toBeInTheDocument();
    expect(window.location.search).toBe("");
    // Le CHEMIN, lui, ne bouge pas : le nettoyage ne doit pas déplacer la page.
    expect(window.location.pathname).toBe("/admin/conferences/propositions");
  });

  it("laisse en place ce qui est de l'ÉTAT, pas de la confirmation", async () => {
    // `page` situe la lectrice dans la file, `vue` filtre une liste : les
    // effacer changerait ce qu'elle regarde, et casserait le partage d'un lien.
    surLUrl("/admin/conferences/propositions?page=3&vue=association&prop=refusee");
    expect(await screen.findByText("C'est enregistré.")).toBeInTheDocument();
    expect(window.location.search).toBe("?page=3&vue=association");
  });

  it("sans paramètre : l'URL reste intacte (aucun « ? » orphelin)", async () => {
    surLUrl("/admin/conferences/propositions");
    expect(await screen.findByText("C'est enregistré.")).toBeInTheDocument();
    expect(window.location.search).toBe("");
    expect(window.location.href).toMatch(/\/admin\/conferences\/propositions$/);
  });

  it("le ton « alerte » s'annonce comme une alerte, pas comme un statut", async () => {
    // L'autre contrat du composant, et la raison pour laquelle ce lot le passe :
    // deux de ses quatre messages d'arbitrage sont des ÉCHECS.
    // On attend le TEXTE puis on lit son rôle : la région est montée VIDE (pour
    // qu'un lecteur d'écran l'annonce quand elle se remplit), donc chercher le
    // rôle d'abord réussit trop tôt.
    window.history.replaceState(null, "", "/admin/conferences/propositions");
    render(<ConfirmationBanner message="Validation impossible." ton="alerte" />);
    expect(await screen.findByText("Validation impossible.")).toHaveAttribute(
      "role",
      "alert",
    );
    cleanup();
    render(<ConfirmationBanner message="C'est enregistré." />);
    expect(await screen.findByText("C'est enregistré.")).toHaveAttribute(
      "role",
      "status",
    );
  });
});
