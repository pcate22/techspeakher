import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/contenus", () => ({ listPublications: vi.fn() }));

import { GET } from "@/app/feed.xml/route";
import { listPublications, type Contenu } from "@/lib/contenus";
import { BASE_URL } from "@/constants/site";

function pub(over: Partial<Contenu> = {}): Contenu {
  return {
    id: 1, type: "publication", slug: "une-actu", titre: "Une actu",
    chapo: "Accroche", corps: "", imageUrl: null, imageAlt: null, imageWidth: null, imageHeight: null, videoUrl: null,
    categorie: "Communauté", tag: "Passé", lien: null, lienExterne: null, lienLabel: null,
    statut: "publie", publieLe: "2026-06-01", majLe: "2026-06-01T00:00:00Z", auFlux: true,
    conferenceEditionId: null,
    auteurNom: null,
    auteurUserId: null,
    auteurImage: null,
    relectureMotif: null,
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("Flux RSS /feed.xml", () => {
  it("renvoie un RSS 2.0 bien formé", async () => {
    vi.mocked(listPublications).mockResolvedValue([pub()]);
    const xml = await (await GET()).text();
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain(`href="${BASE_URL}/feed.xml"`);
  });

  it("EXCLUT les publications hors flux (au_flux=false) — pas de repost de l'historique", async () => {
    vi.mocked(listPublications).mockResolvedValue([
      pub({ slug: "nouvelle", titre: "Nouvelle", auFlux: true }),
      pub({ slug: "ancienne-seedee", titre: "Ancienne seedée", auFlux: false }),
    ]);
    const xml = await (await GET()).text();
    expect(xml).toContain("Nouvelle");
    expect(xml).not.toContain("Ancienne seedée");
    expect((xml.match(/<item>/g) || []).length).toBe(1);
  });

  it("lien = page article si corps, sinon lien externe", async () => {
    vi.mocked(listPublications).mockResolvedValue([
      pub({ slug: "article", corps: "## Contenu", titre: "Article" }),
      pub({ slug: "annonce", corps: "", lienExterne: "https://meetup.com/x", titre: "Annonce" }),
    ]);
    const xml = await (await GET()).text();
    expect(xml).toContain(`${BASE_URL}/articles/article`);
    expect(xml).toContain("https://meetup.com/x");
  });

  it("échappe le chapo (rédigé par une membre depuis le lot N3) : zéro HTML interprétable", async () => {
    vi.mocked(listPublications).mockResolvedValue([
      pub({ chapo: 'Un chapo <img src="https://pisteur.example/px"> malin' }),
    ]);
    const xml = await (await GET()).text();
    expect(xml).not.toContain("<img");
    expect(xml).toContain("&lt;img");
  });

  it("résiste à une base indisponible (flux vide, pas d'erreur)", async () => {
    vi.mocked(listPublications).mockRejectedValue(new Error("db down"));
    const res = await GET();
    expect(res.headers.get("Content-Type")).toContain("application/rss+xml");
    expect((await res.text()).match(/<item>/g)).toBeNull();
  });
});
