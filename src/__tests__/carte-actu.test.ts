import { describe, it, expect } from "vitest";
import { toCarteActu } from "@/lib/carte-actu";
import type { Contenu } from "@/lib/contenus";

/**
 * Mapping « publication → carte » : la SOURCE UNIQUE de la destination d'une
 * carte d'actualité, partagée par `/actualites` et la home (avant, la home
 * affichait un contenu statique qui pouvait diverger de la liste).
 * Règle « article = actualité » : corps → page article, sinon lien.
 */
function pub(over: Partial<Contenu> = {}): Contenu {
  return {
    id: 1,
    type: "publication",
    slug: "un-article",
    titre: "Un article",
    chapo: "Accroche.",
    corps: "",
    imageUrl: null,
    imageAlt: null,
    imageWidth: null,
    imageHeight: null,
    videoUrl: null,
    categorie: "Communauté",
    tag: "Passé",
    lien: null,
    lienExterne: null,
    lienLabel: null,
    statut: "publie",
    publieLe: "2026-06-01",
    majLe: "2026-06-01T00:00:00Z",
    auFlux: true,
    conferenceEditionId: null,
    auteurNom: null,
    auteurUserId: null,
    auteurImage: null,
    relectureMotif: null,
    ...over,
  };
}

describe("toCarteActu — destination de la carte", () => {
  it("avec un corps : mène à la page article du site", () => {
    const c = toCarteActu(pub({ slug: "interview-de-rachel-dubois", corps: "## Question" }), false);
    expect(c.href).toBe("/articles/interview-de-rachel-dubois");
    expect(c.externe).toBe(false);
    expect(c.hrefLabel).toBe("Lire la suite");
  });

  it("un corps l'emporte sur le lien externe (l'article est chez nous)", () => {
    // L'interview de Rachel a un corps ET un lien LinkedIn : la carte mène à sa
    // page d'actualité, le lien LinkedIn vit en bas de l'article.
    const c = toCarteActu(
      pub({
        slug: "interview-de-rachel-dubois",
        corps: "## Question",
        lienExterne: "https://www.linkedin.com/pulse/behind-scenes",
        lienLabel: "Lire sur LinkedIn",
      }),
      false,
    );
    expect(c.href).toBe("/articles/interview-de-rachel-dubois");
    expect(c.externe).toBe(false);
  });

  it("sans corps : mène au lien externe, avec son libellé", () => {
    const c = toCarteActu(
      pub({ lienExterne: "https://www.meetup.com/gdg-toulouse/events/1", lienLabel: "Voir sur Meetup" }),
      false,
    );
    expect(c.href).toBe("https://www.meetup.com/gdg-toulouse/events/1");
    expect(c.externe).toBe(true);
    expect(c.hrefLabel).toBe("Voir sur Meetup");
  });

  it("sans corps ni lien externe : mène au lien interne", () => {
    const c = toCarteActu(pub({ lien: "/tremplin" }), false);
    expect(c.href).toBe("/tremplin");
    expect(c.externe).toBe(false);
    expect(c.hrefLabel).toBe("En savoir plus");
  });

  it("annonce sans corps ni lien : aucune destination (carte inerte)", () => {
    const c = toCarteActu(pub(), false);
    expect(c.href).toBeNull();
    expect(c.hrefLabel).toBeNull();
  });

  it("date formatée en français et catégorie reportée (la chip du type)", () => {
    const c = toCarteActu(pub({ categorie: "Behind the Scenes" }), false);
    expect(c.date).toBe("1er juin 2026");
    expect(c.categorie).toBe("Behind the Scenes");
  });

  it("date absente : chaîne vide (jamais « Invalid Date »)", () => {
    expect(toCarteActu(pub({ publieLe: null }), false).date).toBe("");
  });

  it("le lien d'édition n'existe que pour une orga", () => {
    expect(toCarteActu(pub(), false).editHref).toBeNull();
    expect(toCarteActu(pub({ slug: "x" }), true).editHref).toBe("/admin/contenus/publication/x");
  });

  it("reporte l'image déposée (affichée sur la carte, lot 6)", () => {
    const c = toCarteActu(
      pub({ imageUrl: "https://x.example/photo.png", imageAlt: "Le jury du Tremplin" }),
      false,
    );
    expect(c.imageUrl).toBe("https://x.example/photo.png");
    expect(c.imageAlt).toBe("Le jury du Tremplin");
  });
});
