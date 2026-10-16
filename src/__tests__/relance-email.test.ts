import { describe, it, expect } from "vitest";
import { chantiersRestants, buildRelanceEmail } from "@/lib/relance-email";
import type { SpeakerProfile } from "@/lib/profiles";

/**
 * L'e-mail de relance d'une fiche en sommeil. Deux exigences de fond :
 *   1. il dit CE QU'IL RESTE À FAIRE, tiré de la même source que la checklist
 *      de /mon-espace (`espaceChecklist`) — sinon les deux dérivent ;
 *   2. il tient le wording maison (forme positive, pas de cadratin).
 */

function profil(over: Partial<SpeakerProfile> = {}): SpeakerProfile {
  return {
    id: 1,
    userId: 10,
    slug: null,
    name: "Ada Lovelace",
    image: null,
    titreProfil: null,
    poste: null,
    entreprise: null,
    bio: null,
    website: null,
    linkedin: null,
    instagram: null,
    sessionizeUrl: null,
    conferenceHallUrl: null,
    ville: null,
    codePostal: null,
    codeInsee: null,
    regionResidence: null,
    regions: [],
    langues: [],
    secteurs: [],
    sujets: [],
    contactEmailOk: false,
    isWoman: false,
    status: "brouillon",
    publishedAt: null,
    updatedAt: null,
    submittedAt: null,
    validatedBy: null,
    validatedAt: null,
    refusMotif: null,
    cfpSyncMode: "suggestions",
    ...over,
  } as SpeakerProfile;
}

/** Fiche complète : tous les chantiers de contenu sont faits, rien n'est soumis. */
function profilComplet(): SpeakerProfile {
  return profil({
    titreProfil: "Ingénieure plateforme",
    bio: "Une bio.",
    linkedin: "https://www.linkedin.com/in/ada",
    isWoman: true,
  });
}

describe("chantiersRestants", () => {
  it("liste ce qui manque, sans l'action « Soumettre »", () => {
    const restants = chantiersRestants(profil(), 0);
    // « Soumis à l'annuaire » est une ACTION, pas un champ à remplir : elle
    // pilote la variante d'e-mail, elle n'entre pas dans la liste des chantiers.
    expect(restants).toEqual([
      "Profil rempli",
      "Un talk ou une proposition de sujet",
      "Moyen de contact",
      "Attestation",
    ]);
  });

  it("laisse de côté ce qui est déjà fait", () => {
    const restants = chantiersRestants(
      profil({ titreProfil: "Ingénieure", isWoman: true }),
      2,
    );
    expect(restants).toEqual(["Moyen de contact"]);
  });

  it("réclame le nom quand le compte n'en porte aucun (cohorte lien magique)", () => {
    const restants = chantiersRestants(profil({ name: null }), 0);
    expect(restants[0]).toBe("Prénom et nom");
  });

  it("rend une liste vide quand la fiche est complète", () => {
    expect(chantiersRestants(profilComplet(), 1)).toEqual([]);
  });
});

describe("buildRelanceEmail", () => {
  it("annonce le nombre d'étapes restantes et les énumère", () => {
    const { subject, htmlContent } = buildRelanceEmail({
      name: "Ada Lovelace",
      chantiers: ["Moyen de contact", "Attestation"],
    });
    expect(subject).toContain("2 étapes");
    expect(htmlContent).toContain("Salut Ada,");
    expect(htmlContent).toContain("Moyen de contact");
    expect(htmlContent).toContain("Attestation");
    expect(htmlContent).toContain("/mon-espace");
  });

  it("accorde le singulier sur une seule étape", () => {
    const { subject } = buildRelanceEmail({
      name: "Ada",
      chantiers: ["Attestation"],
    });
    expect(subject).toContain("1 étape");
    expect(subject).not.toContain("étapes");
  });

  it("bascule sur « prête à paraître » quand tout est rempli", () => {
    const { subject, htmlContent } = buildRelanceEmail({
      name: "Ada",
      chantiers: [],
    });
    expect(subject).toContain("prête");
    // Le seul geste restant est de la soumettre : l'e-mail le nomme.
    expect(htmlContent).toContain("Soumettre");
    expect(htmlContent).not.toContain("<ul>");
  });

  it("échappe le nom du compte (il vient d'un fournisseur ou d'une saisie)", () => {
    const { htmlContent } = buildRelanceEmail({
      name: "<script>alert(1)</script> Lovelace",
      chantiers: [],
    });
    expect(htmlContent).not.toContain("<script>");
    expect(htmlContent).toContain("&lt;script&gt;");
  });

  it("salue sans prénom quand le compte n'a pas de nom", () => {
    const { htmlContent } = buildRelanceEmail({ name: null, chantiers: [] });
    expect(htmlContent).toContain("Salut,");
  });

  it("mène aux réglages, dans les deux variantes", () => {
    // Un e-mail qui parle d'une fréquence réglable sans donner le chemin ne
    // règle rien : le lien est dans le pied, avec ce qu'il fait écrit dessus.
    for (const chantiers of [[], ["Attestation"]]) {
      const { htmlContent } = buildRelanceEmail({ name: "Ada", chantiers });
      expect(htmlContent).toContain("/mon-espace/reglages");
      expect(htmlContent).toMatch(/fréquence de ces rappels/i);
    }
  });

  it("cesse de promettre ce que le code ne tient pas", () => {
    // Le pied disait « on te réécrira le jour où ta fiche bougera » : une fiche
    // restée en sommeil rentre pourtant dans le lot suivant.
    const { htmlContent } = buildRelanceEmail({ name: "Ada", chantiers: [] });
    expect(htmlContent).not.toMatch(/le jour où ta fiche bougera/i);
  });

  it("tient le wording maison : forme positive, pas de cadratin", () => {
    for (const chantiers of [[], ["Attestation"]]) {
      const { subject, htmlContent } = buildRelanceEmail({
        name: "Ada",
        chantiers,
      });
      const texte = `${subject} ${htmlContent}`;
      // « ne … pas » ET sa forme élidée « n'… pas » : sans le second cas, la
      // porte laissait passer « ta fiche n'est pas visible » (mesuré).
      expect(texte).not.toMatch(/\bn(?:e\b|['’])[^.<]{0,40}\b(?:pas|plus)\b/i);
      expect(texte).not.toContain("—");
    }
  });
});
