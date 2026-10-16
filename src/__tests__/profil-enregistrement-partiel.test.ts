import { describe, it, expect } from "vitest";
import {
  parseProfileForm,
  parseProfilChamps,
  normaliserProfil,
} from "@/lib/profile-form";
import { SECTIONS_PROFIL, sectionParCle } from "@/lib/profil-sections";
import type { ProfileInput } from "@/lib/profiles";
import { REGION_TOUTE_LA_FRANCE, REGIONS_METROPOLE } from "@/data/domaines";

/**
 * Lot I — la fiche s'édite SECTION PAR SECTION. Une page qui ne soumet que ses
 * propres champs ne doit vider aucun des autres : c'est LA condition pour que
 * l'édition par section soit sûre, et c'est ce que ce fichier verrouille.
 *
 * Deux briques : `parseProfilChamps` ne lit et ne rend QUE les champs qu'on lui
 * nomme ; `normaliserProfil` porte les règles de cohérence qui traversent les
 * sections (la ville et sa localisation, la région de repli) — elles ne peuvent
 * plus vivre dans le parseur, qui ne voit qu'un morceau du profil.
 */

const fd = (entrees: Record<string, string | string[]>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entrees)) {
    for (const item of Array.isArray(v) ? v : [v]) f.append(k, item);
  }
  return f;
};

const profil = (o: Partial<ProfileInput> = {}): ProfileInput => ({
  slug: "lea-dubois",
  titreProfil: "Développeuse plateforme",
  poste: "Staff engineer",
  entreprise: "Airbus",
  bio: "Dix ans de systèmes distribués.",
  website: "https://lea.dev",
  linkedin: "https://linkedin.com/in/lea",
  instagram: null,
  sessionizeUrl: null,
  conferenceHallUrl: null,
  ville: "Toulouse",
  codePostal: "31000",
  codeInsee: "31555",
  regionResidence: "Occitanie",
  regions: ["Occitanie"],
  langues: ["Français"],
  secteurs: ["Industrie / Manufacturing"],
  sujets: ["Cloud / DevOps / Infra"],
  contactEmailOk: true,
  isWoman: true,
  cfpSyncMode: "suggestions",
  ...o,
});

describe("parseProfilChamps — une section ne lit que SES champs", () => {
  it("rend exactement les champs demandés, et aucun autre", () => {
    const r = parseProfilChamps(fd({ sujets: ["Cloud / DevOps / Infra", "Mobile"] }), ["sujets"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.data)).toEqual(["sujets"]);
    expect(r.data.sujets).toEqual(["Cloud / DevOps / Infra", "Mobile"]);
  });

  /**
   * Le piège de l'enregistrement partiel : un champ ABSENT du formulaire vaut
   * « inchangé », jamais « effacé ». Sans ça, éditer ses sujets viderait sa bio.
   */
  it("un champ hors périmètre est absent du résultat, PAS mis à null", () => {
    const r = parseProfilChamps(fd({ sujets: ["Mobile"] }), ["sujets"]);
    if (!r.ok) throw new Error("parse en échec");
    expect("bio" in r.data).toBe(false);
    expect("titreProfil" in r.data).toBe(false);
    expect("linkedin" in r.data).toBe(false);
  });

  it("une case à cocher hors périmètre reste absente (elle ne repasse pas à false)", () => {
    const r = parseProfilChamps(fd({ secteurs: ["Industrie / Manufacturing"] }), ["secteurs"]);
    if (!r.ok) throw new Error("parse en échec");
    expect("contactEmailOk" in r.data).toBe(false);
    expect("isWoman" in r.data).toBe(false);
  });

  it("une case à cocher DANS le périmètre et décochée passe bien à false", () => {
    const r = parseProfilChamps(fd({}), ["contactEmailOk"]);
    if (!r.ok) throw new Error("parse en échec");
    expect(r.data.contactEmailOk).toBe(false);
  });

  it("valide les champs du périmètre : une URL invalide est refusée", () => {
    const r = parseProfilChamps(fd({ linkedin: "pas une url du tout" }), ["linkedin"]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.linkedin).toBeTruthy();
  });

  /**
   * Et surtout : une valeur déjà EN BASE qui ne passerait plus la validation
   * (une bio migrée trop longue, par exemple) ne doit pas bloquer l'édition
   * d'une autre section — elle n'est simplement pas relue.
   */
  it("ne valide QUE son périmètre : le reste du formulaire est ignoré", () => {
    const r = parseProfilChamps(
      fd({ sujets: ["Cloud / DevOps / Infra"], linkedin: "pas une url du tout" }),
      ["sujets"],
    );
    expect(r.ok).toBe(true);
  });
});

describe("normaliserProfil — les règles qui traversent les sections", () => {
  it("sans ville, la localisation structurée repart à zéro", () => {
    const p = normaliserProfil(profil({ ville: null }));
    expect(p.codePostal).toBeNull();
    expect(p.codeInsee).toBeNull();
    expect(p.regionResidence).toBeNull();
  });

  it("avec une ville, la localisation structurée est conservée", () => {
    const p = normaliserProfil(profil());
    expect(p.codePostal).toBe("31000");
    expect(p.regionResidence).toBe("Occitanie");
  });

  /**
   * La règle qui rendait le découpage nécessaire : la zone d'intervention se
   * déduit de la région de RÉSIDENCE, et les deux vivent dans deux sections
   * différentes. Le parseur d'une section ne peut donc plus la porter.
   */
  it("aucune zone d'intervention choisie : la région de résidence sert de repli", () => {
    const p = normaliserProfil(profil({ regions: [], regionResidence: "Occitanie" }));
    expect(p.regions).toEqual(["Occitanie"]);
  });

  it("un choix explicite de zones n'est jamais écrasé par la résidence", () => {
    const p = normaliserProfil(
      profil({ regions: ["Bretagne"], regionResidence: "Occitanie" }),
    );
    expect(p.regions).toEqual(["Bretagne"]);
  });

  it("« Toute la France » implique les 13 régions métropolitaines", () => {
    const p = normaliserProfil(profil({ regions: [REGION_TOUTE_LA_FRANCE] }));
    for (const r of REGIONS_METROPOLE) expect(p.regions).toContain(r);
  });

  it("les 13 régions cochées impliquent « Toute la France »", () => {
    const p = normaliserProfil(profil({ regions: [...REGIONS_METROPOLE] }));
    expect(p.regions).toContain(REGION_TOUTE_LA_FRANCE);
  });

  it("est idempotente : normaliser deux fois donne le même profil", () => {
    const une = normaliserProfil(profil({ regions: [], regionResidence: "Occitanie" }));
    expect(normaliserProfil(une)).toEqual(une);
  });
});

describe("Fusion section + existant — rien d'autre ne bouge", () => {
  /**
   * Le scénario réel : elle ouvre « Tes sujets », change ses sujets, enregistre.
   * Tout le reste de sa fiche doit être STRICTEMENT identique après coup.
   */
  it("enregistrer une section ne modifie que les colonnes de cette section", () => {
    const existant = profil();
    const r = parseProfilChamps(fd({ sujets: ["Cloud / DevOps / Infra", "Mobile"] }), [
      ...sectionParCle("sujets")!.champs,
    ]);
    if (!r.ok) throw new Error("parse en échec");
    const apres = normaliserProfil({ ...existant, ...r.data });
    expect(apres.sujets).toEqual(["Cloud / DevOps / Infra", "Mobile"]);
    expect(apres).toEqual({ ...existant, sujets: ["Cloud / DevOps / Infra", "Mobile"] });
  });

  /**
   * Un champ n'est touché QUE par la section qui le porte. Vérifié sur les deux
   * cases les plus coûteuses à perdre en silence : l'attestation (elle
   * conditionne la présence dans l'annuaire) et le consentement au moissonneur
   * (un consentement re-coché tout seul serait un défaut RGPD, décoché tout
   * seul une fonctionnalité qui s'éteint sans qu'on comprenne).
   */
  it("un champ ne bouge QUE depuis sa propre section", () => {
    const existant = profil({ isWoman: true, cfpSyncMode: "suggestions" });
    // Formulaire VIDE : la section propriétaire lit ses cases comme décochées
    // (retrait volontaire), toutes les autres n'y touchent pas.
    for (const section of SECTIONS_PROFIL) {
      const r = parseProfilChamps(fd({}), section.champs);
      if (!r.ok) throw new Error(`parse en échec : ${section.cle}`);
      const apres = normaliserProfil({ ...existant, ...r.data });
      expect(apres.isWoman, section.cle).toBe(section.cle !== "attestation");
      expect(apres.cfpSyncMode, section.cle).toBe(
        section.cle === "contact" ? "aucun" : "suggestions",
      );
    }
  });

  it("chaque case à cocher a bien UNE section propriétaire", () => {
    for (const champ of ["isWoman", "cfpSuggestionsOk", "contactEmailOk"]) {
      const proprietaires = SECTIONS_PROFIL.filter((s) => s.champs.includes(champ));
      expect(proprietaires.map((s) => s.cle), champ).toHaveLength(1);
    }
  });
});

describe("parseProfileForm — l'assistant de création reste inchangé", () => {
  it("rend un profil COMPLET, cohérence comprise", () => {
    const r = parseProfileForm(
      fd({
        titreProfil: "Développeuse",
        ville: "Toulouse",
        regionResidence: "Occitanie",
        linkedin: "linkedin.com/in/lea",
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Le repli de zone d'intervention s'applique toujours au parcours complet.
    expect(r.data.regions).toEqual(["Occitanie"]);
    expect(r.data.linkedin).toBe("https://linkedin.com/in/lea");
    expect(r.data.isWoman).toBe(false);
  });

  it("une localisation orpheline (sans ville) est nettoyée", () => {
    const r = parseProfileForm(fd({ codePostal: "31000", regionResidence: "Occitanie" }));
    if (!r.ok) throw new Error("parse en échec");
    expect(r.data.codePostal).toBeNull();
    expect(r.data.regionResidence).toBeNull();
    expect(r.data.regions).toEqual([]);
  });
});
