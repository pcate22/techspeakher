import { describe, it, expect } from "vitest";
import { parseProfileForm, normalizeProfileSlug } from "@/lib/profile-form";
import { SECTEURS, SUJETS } from "@/data/domaines";

function fd(
  fields: Record<string, string>,
  multi: { secteurs?: string[]; sujets?: string[] } = {},
): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  for (const s of multi.secteurs ?? []) f.append("secteurs", s);
  for (const s of multi.sujets ?? []) f.append("sujets", s);
  return f;
}

describe("parseProfileForm", () => {
  it("valide un formulaire complet et normalise les champs", () => {
    const res = parseProfileForm(
      fd(
        {
          titreProfil: "Spécialiste IA",
          poste: "Dev",
          entreprise: "OVH",
          bio: "Salut, je parle d'IA.",
          website: "https://moi.fr",
          linkedin: "https://www.linkedin.com/in/moi",
          instagram: "",
        },
        { secteurs: [SECTEURS[0]], sujets: [SUJETS[0], SUJETS[3]] },
      ),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.titreProfil).toBe("Spécialiste IA");
      expect(res.data.poste).toBe("Dev");
      expect(res.data.instagram).toBeNull();
      expect(res.data.secteurs).toEqual([SECTEURS[0]]);
      expect(res.data.sujets).toEqual([SUJETS[0], SUJETS[3]]);
    }
  });

  it("met les champs optionnels vides à null et les listes à []", () => {
    const res = parseProfileForm(fd({ bio: "", website: "" }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.titreProfil).toBeNull();
      expect(res.data.secteurs).toEqual([]);
      expect(res.data.sujets).toEqual([]);
    }
  });

  // Ces champs se saisissent désormais dans une zone multi-lignes (pour qu'un
  // titre long se relise en entier) : la touche Entrée et un copier-coller
  // peuvent donc y glisser des retours à la ligne. Sur la fiche ils sont rendus
  // en UNE ligne (un paragraphe, un sous-titre) — on replie donc les blancs au
  // bord, plutôt que de stocker une valeur qui ne se réaffichera jamais telle
  // quelle.
  it("replie les retours à la ligne des champs d'une ligne (titre, poste, entreprise, ville)", () => {
    const res = parseProfileForm(
      fd({
        titreProfil: "Quand le design,\nle produit\net l'accessibilité",
        poste: "Head of product\r\ndesign",
        entreprise: "  OVH   cloud  ",
        ville: "Toulouse\n",
      }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.titreProfil).toBe("Quand le design, le produit et l'accessibilité");
      expect(res.data.poste).toBe("Head of product design");
      expect(res.data.entreprise).toBe("OVH cloud");
      expect(res.data.ville).toBe("Toulouse");
    }
  });

  // La bio, elle, est un vrai texte long : ses paragraphes doivent survivre.
  it("garde les retours à la ligne de la bio", () => {
    const res = parseProfileForm(fd({ bio: "Premier paragraphe.\n\nSecond." }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.bio).toBe("Premier paragraphe.\n\nSecond.");
  });

  it("ignore secteurs/sujets hors des listes cadrées (liste blanche)", () => {
    const res = parseProfileForm(
      fd({}, { secteurs: [SECTEURS[1], "secteur bidon"], sujets: ["sujet bidon"] }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.secteurs).toEqual([SECTEURS[1]]);
      expect(res.data.sujets).toEqual([]);
    }
  });

  it("rejette une URL invalide", () => {
    const res = parseProfileForm(fd({ linkedin: "pas-une-url" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.linkedin).toBeTruthy();
  });

  it("accepte une URL sans schéma et préfixe https://", () => {
    const res = parseProfileForm(fd({ website: "www.catelinesola.com" }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.website).toBe("https://www.catelinesola.com");
  });

  it("normalise les liens Sessionize / Conference Hall (URL optionnelles)", () => {
    const res = parseProfileForm(
      fd({
        sessionizeUrl: "sessionize.com/marie",
        conferenceHallUrl: "https://conference-hall.io/speaker/abc",
      }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.sessionizeUrl).toBe("https://sessionize.com/marie");
      expect(res.data.conferenceHallUrl).toBe(
        "https://conference-hall.io/speaker/abc",
      );
    }
  });

  it("met les liens CFP vides à null", () => {
    const res = parseProfileForm(fd({ sessionizeUrl: "", conferenceHallUrl: "" }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.sessionizeUrl).toBeNull();
      expect(res.data.conferenceHallUrl).toBeNull();
    }
  });

  it("rejette un lien Sessionize invalide", () => {
    const res = parseProfileForm(fd({ sessionizeUrl: "pas-une-url" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.sessionizeUrl).toBeTruthy();
  });

  it("normalise la casse du schéma (HTTPS:// → https://)", () => {
    const res = parseProfileForm(fd({ website: "HTTPS://moi.fr" }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.website).toBe("https://moi.fr");
  });

  it("rejette une bio trop longue", () => {
    const res = parseProfileForm(fd({ bio: "x".repeat(1001) }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.bio).toBeTruthy();
  });

  it("lit l'attestation (isWoman) selon la case cochée", () => {
    const sans = parseProfileForm(fd({ bio: "x" }));
    expect(sans.ok).toBe(true);
    if (sans.ok) expect(sans.data.isWoman).toBe(false);

    const avec = parseProfileForm(fd({ bio: "x", isWoman: "on" }));
    expect(avec.ok).toBe(true);
    if (avec.ok) expect(avec.data.isWoman).toBe(true);
  });

  it("normalise « Toute la France » côté serveur : le raccourci implique les 13 régions", () => {
    const f = fd({ bio: "x" });
    f.append("regions", "Toute la France"); // POST sans JS : raccourci seul
    const res = parseProfileForm(f);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.regions).toContain("Occitanie");
      expect(res.data.regions).toContain("Île-de-France");
      expect(res.data.regions).toHaveLength(14); // raccourci + 13 régions
    }
  });

  it("normalise dans l'autre sens : les 13 régions cochées ajoutent le raccourci", () => {
    const f = fd({ bio: "x" });
    for (const r of [
      "Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Bretagne",
      "Centre-Val de Loire", "Corse", "Grand Est", "Hauts-de-France",
      "Île-de-France", "Normandie", "Nouvelle-Aquitaine", "Occitanie",
      "Pays de la Loire", "Provence-Alpes-Côte d'Azur",
    ]) f.append("regions", r);
    const res = parseProfileForm(f);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.regions).toContain("Toute la France");
  });

  it("localisation : ville texte, régions et langues filtrées par liste blanche", () => {
    const f = fd({ bio: "x", ville: "  Toulouse  " });
    f.append("regions", "Occitanie");
    f.append("regions", "Pays inventé"); // ignoré (hors liste)
    f.append("regions", "Bretagne");
    f.append("langues", "Anglais");
    f.append("langues", "Klingon"); // ignoré
    const res = parseProfileForm(f);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.ville).toBe("Toulouse");
      expect(res.data.regions).toEqual(["Occitanie", "Bretagne"]);
      expect(res.data.langues).toEqual(["Anglais"]);
    }
  });

  it("consentement moissonneur : case cochée = suggestions, décochée = aucun (révocable)", () => {
    const avec = parseProfileForm(fd({ bio: "x", cfpSuggestionsOk: "on" }));
    expect(avec.ok).toBe(true);
    if (avec.ok) expect(avec.data.cfpSyncMode).toBe("suggestions");

    const sans = parseProfileForm(fd({ bio: "x" }));
    expect(sans.ok).toBe(true);
    if (sans.ok) expect(sans.data.cfpSyncMode).toBe("aucun");
  });

  it("slug : normalise la saisie et le propage dans data", () => {
    const res = parseProfileForm(fd({ bio: "x", slug: "Cateline Puccetti" }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.slug).toBe("cateline-puccetti");
  });

  it("slug : champ vide → null (auto-dérivé côté action)", () => {
    const res = parseProfileForm(fd({ bio: "x", slug: "" }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.slug).toBeNull();
  });

  it("slug : rejette une adresse tout en chiffres (réservée aux id)", () => {
    const res = parseProfileForm(fd({ bio: "x", slug: "12345" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.slug).toBeTruthy();
  });
});

describe("normalizeProfileSlug", () => {
  it("vide → slug null (auto-dérivation déléguée à l'action)", () => {
    expect(normalizeProfileSlug("")).toEqual({ slug: null });
    expect(normalizeProfileSlug("   ")).toEqual({ slug: null });
  });

  it("normalise espaces, points, underscores, accents et casse", () => {
    expect(normalizeProfileSlug("Cateline Puccetti")).toEqual({ slug: "cateline-puccetti" });
    expect(normalizeProfileSlug("cateline.puccetti")).toEqual({ slug: "cateline-puccetti" });
    expect(normalizeProfileSlug("Ada_Lovelace")).toEqual({ slug: "ada-lovelace" });
    expect(normalizeProfileSlug("Éléonore")).toEqual({ slug: "eleonore" });
  });

  it("erreur si la saisie ne produit aucun caractère utile", () => {
    expect(normalizeProfileSlug("!?/ - .")).toHaveProperty("error");
  });

  it("erreur si trop court (< 3)", () => {
    expect(normalizeProfileSlug("ab")).toHaveProperty("error");
  });

  it("erreur si trop long (> 60)", () => {
    expect(normalizeProfileSlug("a".repeat(61))).toHaveProperty("error");
  });

  it("erreur si tout en chiffres (réservé aux id numériques)", () => {
    expect(normalizeProfileSlug("2024")).toHaveProperty("error");
  });
});

describe("parseProfileForm — localisation structurée (BAN)", () => {
  it("garde CP / INSEE / région quand une ville est renseignée", () => {
    const res = parseProfileForm(
      fd({
        ville: "Toulouse",
        codePostal: "31000",
        codeInsee: "31555",
        regionResidence: "Occitanie",
      }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.ville).toBe("Toulouse");
      expect(res.data.codePostal).toBe("31000");
      expect(res.data.codeInsee).toBe("31555");
      expect(res.data.regionResidence).toBe("Occitanie");
    }
  });

  it("remet la localisation à zéro si la ville est vide (cohérence)", () => {
    const res = parseProfileForm(
      fd({
        ville: "",
        codePostal: "31000",
        codeInsee: "31555",
        regionResidence: "Occitanie",
      }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.ville).toBeNull();
      expect(res.data.codePostal).toBeNull();
      expect(res.data.codeInsee).toBeNull();
      expect(res.data.regionResidence).toBeNull();
    }
  });

  it("propose la région de résidence par défaut si aucune zone d'intervention n'est choisie", () => {
    const res = parseProfileForm(
      fd({ ville: "Toulouse", codeInsee: "31555", regionResidence: "Occitanie" }),
    );
    expect(res.ok).toBe(true);
    // Cohérence annuaire : apparaît dans le filtre « Occitanie » par défaut.
    if (res.ok) expect(res.data.regions).toEqual(["Occitanie"]);
  });

  it("n'écrase pas les zones d'intervention déjà choisies", () => {
    const f = fd({ ville: "Toulouse", codeInsee: "31555", regionResidence: "Occitanie" });
    f.append("regions", "Bretagne");
    const res = parseProfileForm(f);
    expect(res.ok).toBe(true);
    // Choix explicite conservé, la région de résidence n'est PAS ajoutée d'office.
    if (res.ok) expect(res.data.regions).toEqual(["Bretagne"]);
  });

  it("ne propose pas de défaut hors métropole (région absente du vocabulaire)", () => {
    const res = parseProfileForm(
      fd({ ville: "Cayenne", codeInsee: "97302", regionResidence: "Guyane" }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.regions).toEqual([]);
  });
});
