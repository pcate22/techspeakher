import { describe, it, expect } from "vitest";
import {
  DUREE_INACTIVITE_JOURS,
  PREAVIS_SUPPRESSION_JOURS,
  PAS_SIGNE_DE_VIE_JOURS,
  dureeEnAns,
  dateSuppressionPrevue,
  buildSuppressionEmail,
} from "@/lib/conservation-comptes";

/**
 * Les durées de conservation et l'avertissement. Ces valeurs sont PUBLIÉES
 * (mentions légales) : elles ne sont pas des détails d'implémentation, et un
 * changement doit se voir.
 */

describe("les durées", () => {
  it("tient deux ans d'inactivité et trente jours de préavis", () => {
    // Verrou de VALEUR, pas de forme : ces nombres sont annoncés aux personnes.
    // Les changer doit être un geste délibéré, avec la notice et la doc.
    expect(DUREE_INACTIVITE_JOURS).toBe(730);
    expect(PREAVIS_SUPPRESSION_JOURS).toBe(30);
  });

  it("garde un préavis réellement utile devant l'inactivité", () => {
    // Un préavis plus long que l'inactivité serait absurde ; un préavis d'un
    // jour ferait de l'avertissement une formalité.
    expect(PREAVIS_SUPPRESSION_JOURS).toBeGreaterThanOrEqual(7);
    expect(PREAVIS_SUPPRESSION_JOURS).toBeLessThan(DUREE_INACTIVITE_JOURS);
  });

  it("écrit le pas de mesure bien plus court que l'échéance", () => {
    expect(PAS_SIGNE_DE_VIE_JOURS).toBeLessThan(PREAVIS_SUPPRESSION_JOURS);
  });

  it("dit la durée en années, pas en jours (la notice parle à des personnes)", () => {
    expect(dureeEnAns(730)).toBe("2 ans");
    expect(dureeEnAns(365)).toBe("1 an");
    expect(dureeEnAns(1095)).toBe("3 ans");
  });
});

describe("buildSuppressionEmail", () => {
  const email = (name: string | null = "Ada Lovelace") =>
    buildSuppressionEmail({ name, dateSuppression: "14 septembre 2026" });

  it("dit ce qui se passe, quand, et comment l'annuler", () => {
    const { subject, htmlContent } = email();
    expect(subject).toMatch(/supprimé/i);
    expect(htmlContent).toContain("Salut Ada,");
    expect(htmlContent).toContain("14 septembre 2026");
    expect(htmlContent).toContain("2 ans");
    // Le geste demandé est le plus petit possible : se connecter suffit.
    // Demander de « cliquer pour conserver » ferait dépendre un compte d'un
    // clic dans un e-mail que les filtres peuvent avaler.
    expect(htmlContent).toMatch(/il suffit de te connecter/i);
    expect(htmlContent).toContain("/connexion");
  });

  it("dit ce qui disparaît ET ce qui survit", () => {
    const { htmlContent } = email();
    expect(htmlContent).toMatch(/fiche[\s\S]*talks[\s\S]*messages/i);
    expect(htmlContent).toMatch(/palmarès/i);
  });

  it("dit que cette annonce échappe au réglage des rappels", () => {
    // Frontière posée par docs/conception-cadence-rappels.md : un rappel se
    // règle, une notification annonce un fait.
    const { htmlContent } = email();
    expect(htmlContent).toMatch(/échappe donc au réglage des\s+rappels/i);
  });

  it("offre la sortie immédiate à qui a déjà décidé", () => {
    expect(email().htmlContent).toContain("/mon-espace/supprimer");
  });

  it("salue sans prénom quand le compte n'a pas de nom", () => {
    expect(email(null).htmlContent).toContain("Salut,");
  });

  it("échappe le nom du compte", () => {
    const { htmlContent } = email("<script>alert(1)</script>");
    expect(htmlContent).not.toContain("<script>");
    expect(htmlContent).toContain("&lt;script&gt;");
  });
});

describe("dateSuppressionPrevue — la date annoncée dans l'e-mail", () => {
  const LE_15_AOUT = Date.parse("2026-08-15T10:00:00Z");

  it("tombe UN PRÉAVIS plus tard, pas plus tôt", () => {
    // Le sens compte autant que le calcul : c'est une échéance À VENIR. La
    // route la fabriquait en niant un helper « il y a N jours », donc la faute
    // d'un signe l'aurait datée de deux ans EN ARRIÈRE, dans un e-mail
    // nominatif annonçant une suppression.
    expect(dateSuppressionPrevue(LE_15_AOUT)).toBe("14 septembre 2026");
  });

  it("suit le préavis, sans le recopier", () => {
    const attendu = new Date(LE_15_AOUT + PREAVIS_SUPPRESSION_JOURS * 86_400_000);
    expect(dateSuppressionPrevue(LE_15_AOUT)).toContain(String(attendu.getUTCDate()));
  });

  it("se dit en toutes lettres : la date part chez une personne", () => {
    expect(dateSuppressionPrevue(LE_15_AOUT)).toMatch(/^\d{1,2} [a-zéû]+ \d{4}$/);
  });
});
