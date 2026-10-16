import { describe, it, expect } from "vitest";
import { verbatims, verbatimsRecueillis } from "@/data/verbatims";
import { jury } from "@/data/tremplin";

/**
 * Les verbatims sont la parole de personnes réelles, publiée avec leur nom ou
 * leur prénom : les garde-fous ici ne sont pas de la cosmétique.
 *
 * 1. CONSENTEMENT — seul un accord « libre » se publie. Un accord assorti d'une
 *    validation préalable ne part pas sur le site tant que la personne n'a pas
 *    revu la phrase exacte (cf. docs/roadmap.md, « consentement par usage »).
 * 2. ATTRIBUTION — celle qui a été consentie, et pas une autre : nom complet
 *    pour les jurées (le formulaire disait « avec votre nom »), prénom seul pour
 *    les participantes (« avec votre prénom »).
 * 3. SOURCE UNIQUE — la fonction d'une jurée vit dans `jury`, jamais recopiée
 *    ici : le jour où elle change de poste, un seul endroit bouge.
 */

describe("verbatims — consentement", () => {
  it("ne publie que les accords libres", () => {
    expect(verbatims.length).toBeGreaterThan(0);
    for (const v of verbatims) {
      const recueilli = verbatimsRecueillis.find((r) => r.citation === v.citation);
      expect(recueilli?.consentement, `verbatim de ${v.auteur}`).toBe("libre");
    }
  });

  it("écarte de la publication tout accord soumis à validation préalable", () => {
    const aValider = verbatimsRecueillis.filter(
      (r) => r.consentement === "validation_prealable",
    );
    for (const r of aValider) {
      expect(
        verbatims.some((v) => v.citation === r.citation),
        `« ${r.auteur} » attend une validation : sa phrase reste hors du site`,
      ).toBe(false);
    }
  });
});

describe("verbatims — attribution", () => {
  it("nomme les jurées comme le jury du Tremplin, et rien d'autre", () => {
    for (const v of verbatims.filter((v) => v.qualite.startsWith("Jurée"))) {
      expect(
        jury.map((membre) => membre.name),
        `« ${v.auteur} » doit figurer dans le jury`,
      ).toContain(v.auteur);
    }
  });

  it("reprend la fonction des jurées depuis `jury` (aucune recopie)", () => {
    for (const v of verbatims.filter((v) => v.qualite.startsWith("Jurée"))) {
      const membre = jury.find((j) => j.name === v.auteur);
      expect(v.role, `fonction de ${v.auteur}`).toBe(membre?.role);
    }
  });

  it("n'attribue aux participantes que leur prénom", () => {
    // Leur consentement portait sur le prénom : publier « Prénom Nom » serait
    // publier plus que ce qui a été accordé.
    for (const v of verbatims.filter((v) => !v.qualite.startsWith("Jurée"))) {
      expect(v.auteur, `attribution de « ${v.auteur} »`).not.toMatch(/\s/);
      expect(v.role, `${v.auteur} : pas de fonction publiée`).toBeUndefined();
    }
  });

  it("dit à chaque fois d'où parle la personne", () => {
    for (const v of verbatims) {
      expect(v.qualite.length, `qualité de ${v.auteur}`).toBeGreaterThan(0);
    }
  });
});

describe("verbatims — citations publiables", () => {
  it("tient dans une carte de carrousel", () => {
    // Au-delà, la carte devient un pavé : sur téléphone le verbatim déborde et
    // les pastilles passent sous la flottaison.
    for (const v of verbatims) {
      expect(v.citation.length, `citation de ${v.auteur}`).toBeLessThanOrEqual(240);
      expect(v.citation.trim()).toBe(v.citation);
    }
  });

  it("garde une typographie de site, pas de copier-coller de formulaire", () => {
    for (const v of verbatims) {
      // Emojis : un lecteur d'écran les épelle (« biceps fléchi ») au milieu
      // d'une phrase. Cadratins : bannis du contenu affiché (CLAUDE.md).
      expect(v.citation, `citation de ${v.auteur}`).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(v.citation, `citation de ${v.auteur}`).not.toMatch(/—/);
      // Ponctuation double : espace insécable, comme partout ailleurs.
      expect(v.citation, `citation de ${v.auteur}`).not.toMatch(/\w[!?;:]/);
      expect(v.citation, `citation de ${v.auteur}`).not.toMatch(/ [!?;:]/);
      expect(v.citation, `citation de ${v.auteur}`).not.toMatch(/ {2}/);
    }
  });

  it("ne publie jamais deux fois la même voix", () => {
    const auteurs = verbatims.map((v) => v.auteur);
    expect(new Set(auteurs).size).toBe(auteurs.length);
  });

  it("alterne les points de vue plutôt que d'aligner les jurées", () => {
    // La force du bloc, c'est le croisement des regards : deux jurées de suite
    // le font glisser vers un mur de recommandations institutionnelles.
    const estJuree = verbatims.map((v) => v.qualite.startsWith("Jurée"));
    for (let i = 1; i < estJuree.length; i++) {
      expect(
        estJuree[i] === estJuree[i - 1],
        `verbatims ${i} et ${i + 1} viennent du même côté`,
      ).toBe(false);
    }
  });
});
