import { describe, it, expect } from "vitest";
import {
  SECTIONS_PROFIL,
  CLES_SECTION,
  sectionParCle,
  sectionDuChamp,
  SECTION_PAR_CLE,
  type CleSection,
} from "@/lib/profil-sections";
import { CHAMPS_PROFIL } from "@/app/mon-espace/champs-profil";

/**
 * Lot I — la fiche s'édite SECTION PAR SECTION (« façon LinkedIn ») : chaque
 * crayon de la fiche ouvre une page qui ne porte que sa section.
 *
 * Le registre est ce qui rend l'enregistrement partiel SÛR : c'est lui qui
 * borne les champs qu'une section a le droit d'écrire. D'où les invariants
 * ci-dessous — un champ oublié serait un champ qu'aucune page ne peut plus
 * modifier ; un champ dans DEUX sections serait un champ qu'une section écrase
 * en enregistrant l'autre.
 */

describe("SECTIONS_PROFIL — le registre est complet et sans recouvrement", () => {
  it("chaque champ nommé du formulaire appartient à UNE section", () => {
    const orphelins = Object.keys(CHAMPS_PROFIL).filter((nom) => !sectionDuChamp(nom));
    expect(orphelins).toEqual([]);
  });

  it("aucun champ n'appartient à DEUX sections (sinon l'une écrase l'autre)", () => {
    const vus = new Map<string, CleSection[]>();
    for (const s of SECTIONS_PROFIL) {
      for (const champ of s.champs) {
        vus.set(champ, [...(vus.get(champ) ?? []), s.cle]);
      }
    }
    const doublons = [...vus.entries()].filter(([, cles]) => cles.length > 1);
    expect(doublons).toEqual([]);
  });

  it("les clés sont uniques et utilisables dans une URL", () => {
    expect(new Set(CLES_SECTION).size).toBe(CLES_SECTION.length);
    for (const cle of CLES_SECTION) expect(cle).toMatch(/^[a-z]+$/);
  });

  it("chaque section porte au moins un champ (une section vide n'a rien à éditer)", () => {
    for (const s of SECTIONS_PROFIL) expect(s.champs.length).toBeGreaterThan(0);
  });

  it("chaque section se présente en MOTS : un titre et une aide, jamais un nom de champ", () => {
    for (const s of SECTIONS_PROFIL) {
      expect(s.titre.length).toBeGreaterThan(2);
      expect(s.aide.length).toBeGreaterThan(10);
      // Le titre s'affiche en tête de page ET sur la fiche : pas de « camelCase ».
      expect(s.titre).not.toMatch(/[a-z][A-Z]/);
    }
  });
});

describe("sectionParCle / sectionDuChamp — la résolution ne devine jamais", () => {
  it("une clé connue renvoie sa section", () => {
    expect(sectionParCle("identite")?.cle).toBe("identite");
    expect(sectionParCle("interventions")?.cle).toBe("interventions");
  });

  it("une clé inconnue renvoie null (l'appelant fera un notFound, pas un repli muet)", () => {
    expect(sectionParCle("constructor")).toBeNull();
    expect(sectionParCle("inconnue")).toBeNull();
    expect(sectionParCle(undefined)).toBeNull();
  });

  it("l'EN-TÊTE de la fiche s'édite d'un seul crayon : bio ET ville y sont", () => {
    // Un crayon en haut de fiche doit ouvrir tout ce qui s'affiche en haut —
    // sinon on cherche sa ville dans une autre page que son titre de profil.
    expect(sectionDuChamp("bio")?.cle).toBe("identite");
    expect(sectionDuChamp("ville")?.cle).toBe("identite");
    expect(sectionDuChamp("titreProfil")?.cle).toBe("identite");
  });

  it("« Où tu interviens » porte la PORTÉE, pas le domicile", () => {
    expect(sectionDuChamp("regions")?.cle).toBe("interventions");
    expect(sectionDuChamp("langues")?.cle).toBe("interventions");
  });

  it("les listes à cocher ont leur propre section (elles sont longues à elles seules)", () => {
    expect(sectionDuChamp("secteurs")?.cle).toBe("secteurs");
    expect(sectionDuChamp("sujets")?.cle).toBe("sujets");
  });

  it("un champ inconnu n'appartient à aucune section", () => {
    expect(sectionDuChamp("champFantome")).toBeNull();
    expect(sectionDuChamp("toString")).toBeNull();
  });

  /**
   * L'attestation conditionne la présence dans l'annuaire. Sans section à elle,
   * une fiche qui la perdrait affichait « Coche l'attestation » avec un lien
   * qui ne menait nulle part — plus aucun écran ne savait l'écrire.
   */
  it("l'attestation a SA section : elle reste éditable après la création", () => {
    expect(sectionDuChamp("isWoman")?.cle).toBe("attestation");
  });
});

/**
 * Ce que le registre porte DEPUIS qu'il porte l'état vide d'une section : la
 * phrase affichée et le prédicat qui décide de l'afficher.
 *
 * Ces garde-fous existaient — dans les tests de `profil-resume.ts`, supprimé avec
 * son sommaire. Les reperdre au passage aurait laissé merger en vert une phrase à
 * la forme négative, ou un `estVide` qui change ce que l'annuaire PUBLIC affiche.
 */
describe("l'état vide d'une section, dit par le registre", () => {
  it("chaque section dit ce qui manque, à la forme POSITIVE", () => {
    for (const s of SECTIONS_PROFIL) {
      // Forme positive : jamais « ne … pas », jamais « 0 secteur ».
      expect(s.vide, s.cle).not.toMatch(/\bne\b|\bn['’]|\bpas\b|\bplus de\b/i);
      expect(s.vide, s.cle).not.toMatch(/\b0\s/);
      // Une phrase à elle, pas un nom de champ : majuscule et ponctuation finale.
      expect(s.vide, s.cle).toMatch(/^[A-ZÀÂÉÈÊÎÔÙÛÜÇ]/);
      expect(s.vide, s.cle).toMatch(/[.!?]$/);
      expect(s.vide.length, s.cle).toBeGreaterThan(10);
    }
  });

  /** Un profil complet n'a AUCUNE section vide : sinon la fiche publique masque
   * un contenu qui existe, et « Ma fiche » réclame ce qui est déjà là. */
  it("un profil complet : aucune section vide", () => {
    const complet = {
      titreProfil: "Développeuse plateforme",
      poste: "Staff engineer",
      entreprise: "Airbus",
      bio: "Dix ans de systèmes distribués.",
      ville: "Toulouse",
      secteurs: ["Industrie / Manufacturing"],
      sujets: ["Cloud / DevOps / Infra"],
      regions: ["Occitanie"],
      langues: ["Français"],
      linkedin: "https://linkedin.com/in/lea",
      website: null,
      instagram: null,
      contactEmailOk: true,
      isWoman: true,
    };
    for (const s of SECTIONS_PROFIL) expect(s.estVide(complet), s.cle).toBe(false);
  });

  it("un profil nu : toutes les sections sont vides", () => {
    const nu = {
      titreProfil: null,
      poste: null,
      entreprise: null,
      bio: null,
      ville: null,
      secteurs: [],
      sujets: [],
      regions: [],
      langues: [],
      linkedin: null,
      website: null,
      instagram: null,
      contactEmailOk: false,
      isWoman: false,
    };
    for (const s of SECTIONS_PROFIL) expect(s.estVide(nu), s.cle).toBe(true);
  });

  /**
   * La MÊME règle de « rempli » que la jauge de complétude : une bio réduite à
   * des espaces rendait la fiche « remplie » et la jauge « à faire ». Deux écrans
   * qui décrivent la même fiche différemment, ce que ce registre existe pour
   * empêcher.
   */
  it("des espaces ne remplissent rien", () => {
    const base = {
      titreProfil: "   ",
      poste: "  ",
      entreprise: " ",
      bio: "\n ",
      ville: "  ",
      secteurs: [],
      sujets: [],
      regions: [],
      langues: [],
      linkedin: "   ",
      website: " ",
      instagram: "  ",
      contactEmailOk: false,
      isWoman: false,
    };
    expect(SECTION_PAR_CLE.identite.estVide(base)).toBe(true);
    expect(SECTION_PAR_CLE.contact.estVide(base)).toBe(true);
  });

  /** Chaque section AFFICHÉE compte : l'entreprise s'affiche dans le sous-titre,
   * l'oublier faisait dire « ton nom seul » à une fiche qui montrait « Airbus ». */
  it("l'identité tient compte de tout ce qui s'affiche", () => {
    const nu = {
      titreProfil: null, poste: null, entreprise: null, bio: null, ville: null,
      secteurs: [], sujets: [], regions: [], langues: [],
      linkedin: null, website: null, instagram: null, contactEmailOk: false, isWoman: false,
    };
    for (const champ of ["titreProfil", "poste", "entreprise", "bio", "ville"] as const) {
      expect(SECTION_PAR_CLE.identite.estVide({ ...nu, [champ]: "quelque chose" }), champ).toBe(
        false,
      );
    }
  });

  /** Sessionize et Conference Hall s'affichent dans « Talks & conférences », pas
   * dans le contact : les compter ici annonçait une section « vide » dont le
   * résumé listait « Sessionize ». */
  it("le contact ignore les portfolios de talks", () => {
    const nu = {
      titreProfil: null, poste: null, entreprise: null, bio: null, ville: null,
      secteurs: [], sujets: [], regions: [], langues: [],
      linkedin: null, website: null, instagram: null, contactEmailOk: false, isWoman: false,
    };
    expect(SECTION_PAR_CLE.contact.estVide(nu)).toBe(true);
    expect(SECTION_PAR_CLE.contact.estVide({ ...nu, contactEmailOk: true })).toBe(false);
  });

  /** L'accès par clé est TOTAL : une clé de l'union sans entrée est une erreur de
   * compilation, là où un `find` casté plantait au rendu de l'annuaire public. */
  it("chaque clé de l'union a son entrée", () => {
    for (const cle of CLES_SECTION) expect(SECTION_PAR_CLE[cle]?.cle).toBe(cle);
  });
});
