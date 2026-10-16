import { describe, it, expect } from "vitest";
import { buildPreavisAnnuaireEmail, buildRelanceAdhesionEmail } from "@/lib/adhesion-email";

/**
 * Les deux e-mails de l'annuaire réservé aux membres. Ce qui est gardé : la
 * DATE annoncée y figure (sans elle, aucune pause n'est permise), le lien mène
 * à /adherer, le nom est échappé, et la copie suit les règles du dépôt
 * (forme positive, aucun cadratin, insécable avant « : »).
 */

const tous = [
  buildPreavisAnnuaireEmail({
    name: "Léa Martin",
    dateRetrait: "2026-11-14T12:00:00.000Z",
    echeance: null,
  }),
  buildPreavisAnnuaireEmail({
    name: "Léa Martin",
    dateRetrait: "2026-11-14T12:00:00.000Z",
    echeance: "2026-11-10T08:00:00.000Z",
    cumul: true,
  }),
  buildRelanceAdhesionEmail({ name: "Léa Martin", echeance: "2026-11-10T08:00:00.000Z" }),
];

describe("préavis de l'annuaire", () => {
  it("le cumul des douze mois n'est promis que pour une adhésion HelloAsso (revue UX)", () => {
    const sansCumul = buildPreavisAnnuaireEmail({
      name: "Léa",
      dateRetrait: "2026-11-14T12:00:00.000Z",
      echeance: "2026-11-10T08:00:00.000Z",
    });
    expect(sansCumul.htmlContent).not.toMatch(/s'ajoutent/);
    expect(
      buildRelanceAdhesionEmail({ name: "Léa", echeance: "2026-11-10T08:00:00.000Z" }).htmlContent,
    ).not.toMatch(/s'ajoutent/);
  });

  it("la consigne d'adresse vient AVANT le bouton : on clique avant de lire la suite", () => {
    for (const { htmlContent } of tous) {
      expect(htmlContent.indexOf("l'adresse à laquelle tu reçois ce message")).toBeLessThan(
        htmlContent.indexOf("👉"),
      );
    }
  });

  it("sans adhésion : annonce la date, invite à adhérer, rassure sur la fiche", () => {
    const { subject, htmlContent } = tous[0];
    expect(subject).toContain("14 novembre 2026");
    expect(htmlContent).toContain("14 novembre 2026");
    expect(htmlContent).toContain("https://techspeakher.fr/adherer");
    expect(htmlContent).toMatch(/gratuite/);
    expect(htmlContent.replace(/\s+/g, " ")).toMatch(
      /Après ton adhésion, elle revient dans l'annuaire dans quelques minutes, et au plus tard le lendemain/,
    );
  });

  it("adhésion qui arrive à échéance : dit l'échéance ET la date de pause", () => {
    const { htmlContent } = tous[1];
    expect(htmlContent).toContain("10 novembre 2026");
    expect(htmlContent).toContain("14 novembre 2026");
    expect(htmlContent).toMatch(/s'ajoutent à ton échéance/);
  });

  it("demande l'adresse de ce message dans le champ du membre : c'est elle qui relie l'adhésion", () => {
    for (const { htmlContent } of tous.slice(0, 2))
      expect(htmlContent).toMatch(/adresse à laquelle tu reçois ce message/);
  });

  it("échappe le nom", () => {
    const { htmlContent } = buildPreavisAnnuaireEmail({
      name: "<b>Léa</b>",
      dateRetrait: "2026-11-14T12:00:00.000Z",
      echeance: null,
    });
    expect(htmlContent).not.toContain("<b>Léa");
    expect(htmlContent).toContain("&lt;b&gt;Léa");
  });
});

describe("relance avant échéance", () => {
  it("dit l'échéance et mène à /adherer", () => {
    const { subject, htmlContent } = tous[2];
    expect(subject).toContain("10 novembre 2026");
    expect(htmlContent).toContain("https://techspeakher.fr/adherer");
  });
});

describe("règles de copie du dépôt", () => {
  it.each(tous.map((m, i) => [i, m] as const))("e-mail %i : forme positive, sans cadratin", (_i, m) => {
    const texte = `${m.subject} ${m.htmlContent}`.replace(/<[^>]+>/g, " ");
    expect(texte).not.toMatch(/\bne\b[^.]{0,40}\b(pas|plus)\b|\bn'[^.]{0,40}\b(pas|plus)\b/i);
    expect(texte).not.toContain("—");
    // Insécable (ou entité) avant les deux-points, jamais une espace simple.
    expect(texte).not.toMatch(/ :/);
  });
});
