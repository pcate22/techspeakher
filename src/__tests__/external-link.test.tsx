import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ExternalLink, { isSafeHttpUrl, relSortant } from "@/components/ExternalLink";
import Button from "@/components/Button";

afterEach(cleanup);

describe("ExternalLink — sécurité + accessibilité", () => {
  it("rend un lien _blank et annonce « nouvel onglet » (sans aria-label)", () => {
    render(<ExternalLink href="https://exemple.fr">LinkedIn</ExternalLink>);
    const a = screen.getByRole("link", { name: /LinkedIn.*nouvel onglet/i });
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
  });

  it("intègre l'avertissement DANS l'aria-label quand il est fourni (sinon ignoré par l'AT)", () => {
    render(
      <ExternalLink href="https://exemple.fr" aria-label="LinkedIn de Sandrine">
        LinkedIn
      </ExternalLink>,
    );
    expect(
      screen.getByRole("link", {
        name: "LinkedIn de Sandrine (s'ouvre dans un nouvel onglet)",
      }),
    ).toBeTruthy();
  });

  it("n'émet PAS de lien cliquable pour une URL non http(s) (anti-XSS)", () => {
    render(<ExternalLink href="javascript:alert(document.cookie)">clique</ExternalLink>);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("clique")).toBeTruthy();
  });
});

/**
 * Divulgation des liens sortants. Un site d'association qui suit vers des sites
 * commerciaux qu'il n'a ni choisis ni relus se lit comme de la promotion de
 * tiers : les liens SAISIS par une speakeuse (site perso, LinkedIn, Sessionize)
 * partent donc en `ugc nofollow`. Contexte : docs/google-ad-grants.md.
 */
describe("relSortant", () => {
  it("pose noopener/noreferrer par défaut, sans divulgation superflue", () => {
    const rel = relSortant({});
    expect(rel).toBe("noopener noreferrer");
  });

  it("divulgue un lien saisi par une utilisatrice", () => {
    const rel = relSortant({ ugc: true });
    expect(rel).toContain("ugc");
    expect(rel).toContain("nofollow");
  });

  it("cumule les deux divulgations quand elles s'appliquent", () => {
    // Un partenaire qui est AUSSI une saisie libre : les deux se disent.
    const rel = relSortant({ sponsored: true, ugc: true });
    expect(rel).toContain("sponsored");
    expect(rel).toContain("ugc");
  });
});

describe("divulgation au rendu", () => {
  it("ExternalLink transmet ugc", () => {
    render(
      <ExternalLink href="https://exemple.fr" ugc>
        Site web
      </ExternalLink>,
    );
    expect(screen.getByRole("link").getAttribute("rel")).toContain("ugc nofollow");
  });

  it("Button external transmet ugc (les fiches passent par lui, pas par ExternalLink)", () => {
    render(
      <Button href="https://exemple.fr" external ugc>
        Site web
      </Button>,
    );
    expect(screen.getByRole("link").getAttribute("rel")).toContain("ugc nofollow");
  });

  it("un lien sortant ÉDITORIAL reste suivi (on ne saborde pas nos partenaires)", () => {
    // Les liens choisis par l'association (conférences, écosystème) gardent leur
    // valeur : la divulgation vise ce qu'on n'a pas choisi.
    render(
      <Button href="https://exemple.fr" external>
        Visiter le site
      </Button>,
    );
    expect(screen.getByRole("link").getAttribute("rel")).toBe("noopener noreferrer");
  });
});

describe("isSafeHttpUrl", () => {
  it("n'accepte que http(s), schémas dangereux rejetés", () => {
    expect(isSafeHttpUrl("https://x.fr")).toBe(true);
    expect(isSafeHttpUrl("http://x.fr")).toBe(true);
    expect(isSafeHttpUrl("  https://x.fr  ")).toBe(true); // tolère les espaces
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,<script>")).toBe(false);
    expect(isSafeHttpUrl("/relative")).toBe(false);
  });
});
