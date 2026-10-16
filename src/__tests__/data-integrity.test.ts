import { describe, it, expect } from "vitest";
import { allActualites, behindTheScenes } from "@/data/actualites";
import { COULEURS_TAG } from "@/components/TagBadge";
import { CATEGORIES, TAGS } from "@/lib/contenu-form";
import { prix, faq, accompagnement, jury } from "@/data/tremplin";
import { TREMPLIN1_PARTICIPANTES, TREMPLIN1_RESULTATS } from "@/lib/tremplin-seed";
import { SOIREE_TREMPLIN_URL } from "@/constants/site";
import { pourquoi, partenaires, typesSoutien } from "@/data/partenaires";
import { codeDeConduite } from "@/data/charte";

describe("Actualités (unifiées)", () => {
  it("chaque catégorie appartient au vocabulaire du site", () => {
    // Le fixture de seed parle le même vocabulaire que l'éditeur : une
    // catégorie inventée ici arriverait en base sans filtre ni chip.
    for (const a of allActualites) {
      expect(CATEGORIES as readonly string[]).toContain(a.category);
    }
  });

  it("chaque item a un titre, une date, un tag et une catégorie", () => {
    for (const a of allActualites) {
      expect(a.title).toBeTruthy();
      expect(a.date).toBeTruthy();
      expect(a.tag).toBeTruthy();
      expect(a.category).toBeTruthy();
    }
  });

  it("les tags sont connus de TagBadge", () => {
    for (const a of allActualites) {
      expect(Object.keys(COULEURS_TAG)).toContain(a.tag);
    }
  });

  it("chaque catégorie et chaque tag a une couleur de chip", () => {
    // La chip du type de contenu s'affiche sur trois surfaces (accueil, liste,
    // article) : une catégorie ajoutée sans couleur passerait en gris neutre
    // sans que rien n'échoue.
    for (const c of CATEGORIES) expect(COULEURS_TAG[c], `couleur manquante : ${c}`).toBeTruthy();
    for (const t of TAGS) expect(COULEURS_TAG[t], `couleur manquante : ${t}`).toBeTruthy();
  });

  it("les liens externes ont un label explicite", () => {
    for (const a of allActualites) {
      if (a.externalLink) {
        expect(a.externalLinkLabel).toBeTruthy();
      }
    }
  });

  it("chaque item a un lien interne ou externe", () => {
    for (const a of allActualites) {
      expect(a.link || a.externalLink).toBeTruthy();
    }
  });

  it("behind the scenes a au moins une interview", () => {
    expect(behindTheScenes.length).toBeGreaterThanOrEqual(1);
    for (const bts of behindTheScenes) {
      expect(bts.name).toBeTruthy();
      expect(bts.quote).toBeTruthy();
      expect(bts.url).toMatch(/^https?:\/\//);
    }
  });
});

describe("Tremplin", () => {
  it("les prix ont une place et une récompense", () => {
    expect(prix.length).toBeGreaterThanOrEqual(3);
    for (const p of prix) {
      expect(p.place).toBeTruthy();
      expect(p.reward).toBeTruthy();
    }
  });

  it("la FAQ a des questions et réponses non vides", () => {
    expect(faq.length).toBeGreaterThanOrEqual(3);
    for (const f of faq) {
      expect(f.q).toBeTruthy();
      expect(f.a).toBeTruthy();
    }
  });

  it("le parcours d'accompagnement compte 5 thèmes valides", () => {
    expect(accompagnement).toHaveLength(5);
    const seenNumbers = new Set<string>();
    for (const t of accompagnement) {
      expect(t.number).toMatch(/^\d{2}$/);
      expect(seenNumbers.has(t.number)).toBe(false);
      seenNumbers.add(t.number);
      expect(t.title).toBeTruthy();
      expect(t.description.length).toBeGreaterThan(20);
    }
  });

  it("le jury est composé de profils complets et uniques", () => {
    expect(jury.length).toBeGreaterThanOrEqual(6);
    const seenNames = new Set<string>();
    for (const j of jury) {
      expect(j.name).toBeTruthy();
      expect(j.role).toBeTruthy();
      expect(seenNames.has(j.name)).toBe(false);
      seenNames.add(j.name);
    }
  });

  it("l'URL d'inscription à la soirée est une URL valide", () => {
    expect(SOIREE_TREMPLIN_URL).toMatch(/^https:\/\/.+/);
  });

});

describe("Participantes du Tremplin", () => {
  it("compte 8 finalistes", () => {
    expect(TREMPLIN1_PARTICIPANTES).toHaveLength(8);
  });

  it("chaque participante a un profil complet", () => {
    for (const p of TREMPLIN1_PARTICIPANTES) {
      expect(p.name).toBeTruthy();
      expect(p.role).toBeTruthy();
      expect(p.bio.length).toBeGreaterThan(20);
      expect(p.sujet).toBeTruthy();
      expect(p.linkedin).toMatch(/^https:\/\/(www\.)?linkedin\.com/);
      if (p.website) {
        expect(p.website).toMatch(/^https?:\/\//);
      }
    }
  });

  it("pas de doublons de noms", () => {
    const names = TREMPLIN1_PARTICIPANTES.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("chaque gagnante (TREMPLIN1_RESULTATS) correspond exactement à une finaliste", () => {
    // Le seed Tremplin rattache la récompense par nom (nom de gagnante →
    // nom de finaliste). Un nom sans correspondance = récompense perdue en
    // silence à l'import. Ce test attrape la divergence en CI.
    const noms = new Set(TREMPLIN1_PARTICIPANTES.map((p) => p.name));
    for (const r of TREMPLIN1_RESULTATS) {
      expect(noms.has(r.nom), `Gagnante « ${r.nom} » absente des participantes`).toBe(true);
    }
  });
});

describe("Partenaires", () => {
  it("les raisons ont un titre et une description", () => {
    for (const p of pourquoi) {
      expect(p.title).toBeTruthy();
      expect(p.description).toBeTruthy();
    }
  });

});

describe("Code de conduite", () => {
  it("chaque section a un titre et du texte", () => {
    for (const section of codeDeConduite) {
      expect(section.titre.trim().length).toBeGreaterThan(0);
      const texte = [...section.paragraphes, ...(section.liste ?? []), ...(section.apresListe ?? [])];
      expect(texte.length, `Section vide : ${section.titre}`).toBeGreaterThan(0);
    }
  });

  it("les ancres de section sont uniques (elles servent d'id HTML)", () => {
    const ids = codeDeConduite.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Partenaires actuels", () => {
  it("chaque structure a un nom, et un lien http(s) s'il y en a un", () => {
    expect(partenaires.length).toBeGreaterThanOrEqual(1);
    for (const p of partenaires) {
      expect(p.name).toBeTruthy();
      if (p.url) expect(p.url).toMatch(/^https?:\/\//);
      if (p.pageInterne) expect(p.pageInterne).toMatch(/^\//);
    }
  });

  it("aucun nom en double dans l'annuaire des partenaires", () => {
    const names = partenaires.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("chaque façon d'aider a un titre, une phrase, et un rôle pour chaque structure", () => {
    const ids = typesSoutien.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of typesSoutien) {
      expect(t.titre).toBeTruthy();
      expect(t.aide).toBeTruthy();
      for (const m of t.membres) expect(m.role, `${t.id} / ${m.nom}`).toBeTruthy();
    }
  });
});

describe("Sécurité", () => {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

  it("aucune adresse email en clair dans les données publiques", () => {
    const allTexts: { source: string; text: string }[] = [];

    for (const a of allActualites) {
      allTexts.push({ source: `actualites: ${a.title}`, text: a.title });
      allTexts.push({ source: `actualites: ${a.title}`, text: a.description });
      if (a.externalLinkLabel) allTexts.push({ source: `actualites: ${a.title}`, text: a.externalLinkLabel });
    }
    for (const f of faq) {
      allTexts.push({ source: `FAQ: ${f.q}`, text: f.q });
      allTexts.push({ source: `FAQ: ${f.q}`, text: f.a });
    }
    for (const p of pourquoi) {
      allTexts.push({ source: `partenaires: ${p.title}`, text: p.description });
    }

    const violations: string[] = [];
    for (const { source, text } of allTexts) {
      if (emailRegex.test(text)) {
        violations.push(`[${source}] contient une adresse email en clair`);
      }
    }

    if (violations.length > 0) {
      expect.fail(
        `Adresse(s) email trouvée(s) dans le contenu public (spam risk) :\n${violations.map((v) => `  - ${v}`).join("\n")}`,
      );
    }
  });
});
