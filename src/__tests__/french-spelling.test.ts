import { readFileSync } from "node:fs";
import { textesAffichables } from "./copie-affichee";
import { describe, it, expect } from "vitest";
import { allActualites, behindTheScenes } from "@/data/actualites";
import { prix, faq } from "@/data/tremplin";
import { pourquoi, typesSoutien } from "@/data/partenaires";
import { codeDeConduite } from "@/data/charte";
import { aSavoirAdhesion, introAdhesion, tarifsAdhesion } from "@/data/adhesion";
import { verbatims } from "@/data/verbatims";
import { SECTEURS, SUJETS, REGIONS, LANGUES } from "@/data/domaines";
import {
  MOISSONNEUR_TITRE,
  MOISSONNEUR_INTRO,
  MOISSONNEUR_ETAPES,
  MOISSONNEUR_GARANTIES,
} from "@/data/moissonneur";
import {
  A_VENIR,
  BLOCS_NOUVEAUTES,
  NOUVEAUTES_PLATEFORME,
  ET_AUSSI,
} from "@/data/nouveautes-plateforme";

/**
 * Test d'orthographe et de typographie française.
 *
 * On maintient une liste de fautes courantes (type Voltaire) :
 * - Fautes d'accord, de conjugaison, de typographie
 * - Mots fréquemment mal orthographiés
 * - Typographie française (espaces insécables avant !?:;)
 *
 * Pour ajouter une règle : ajouter une entrée dans SPELLING_RULES.
 */

interface SpellingRule {
  pattern: RegExp;
  message: string;
}

const SPELLING_RULES: SpellingRule[] = [
  // --- Fautes d'orthographe courantes ---
  { pattern: /\bpackageé/i, message: "« packageé » → « packagé »" },
  { pattern: /\bparmis\b/i, message: "« parmis » → « parmi » (jamais de s)" },
  { pattern: /\bmalgré que\b/i, message: "« malgré que » → « bien que » ou « malgré + nom »" },
  { pattern: /\bau jour d'aujourd'hui\b/i, message: "« au jour d'aujourd'hui » → pléonasme, utiliser « aujourd'hui »" },
  { pattern: /\bau coiffeur\b/i, message: "« au coiffeur » → « chez le coiffeur »" },
  { pattern: /\bcomme même\b/i, message: "« comme même » → « quand même »" },
  { pattern: /\bsoit disant\b/i, message: "« soit disant » → « soi-disant »" },
  { pattern: /\bbien sur\b(?!e)/i, message: "« bien sur » → « bien sûr »" },
  { pattern: /\bdu coup\b/i, message: "« du coup » → préférer « donc », « alors », « par conséquent »" },
  { pattern: /\bpallier à\b/i, message: "« pallier à » → « pallier » (transitif direct)" },
  { pattern: /\bavant que.*\bindicatif\b/i, message: "« avant que » exige le subjonctif" },
  { pattern: /\bse rappeler de\b/i, message: "« se rappeler de » → « se rappeler + COD » ou « se souvenir de »" },
  { pattern: /\bà l'attention\b/i, message: "« à l'attention » (courrier) — vérifier si « à l'intention » (dédié à) n'est pas voulu" },
  { pattern: /\bautant pour moi\b/i, message: "« autant pour moi » → « au temps pour moi »" },

  // --- Accords fréquemment ratés ---
  { pattern: /\bquelque soit\b/i, message: "« quelque soit » → « quel que soit » (en deux mots + accord)" },
  { pattern: /\bquoi que il\b/i, message: "« quoi que il » → « quoiqu'il » (élision)" },
  { pattern: /\bces des\b/i, message: "« ces des » → confusion ces/ses/c'est ?" },

  // --- Typographie française ---
  { pattern: /\w[!?;:](?!\/)/, message: "Espace insécable manquant avant ! ? ; : (typographie française)" },
  // Espace NORMALE avant la ponctuation double : il faut l'insécable ( ).
  { pattern: / [!?;:](?!\/)/, message: "Espace normale avant ! ? ; : → utiliser l'espace insécable (\\u00A0)" },
  // Guillemets français : l'espace intérieure doit être insécable.
  { pattern: /« |\S »/, message: "Espace intérieure des guillemets « » → insécable (\\u00A0)" },

  // --- Anglicismes courants à vérifier ---
  { pattern: /\béventuel(?:lement)?\b.*\bpossib/i, message: "« éventuellement » ≠ « eventually » — vérifier le sens" },
  { pattern: /\bopportunit(?:é|ies)\b/i, message: "« opportunité » : anglicisme pour « occasion » — vérifier le contexte" },

  // --- Doubles espaces ---
  { pattern: /  +/, message: "Double espace détecté" },
];

/** Exceptions : mots/patterns autorisés (noms propres, termes techniques, etc.) */
const EXCEPTIONS: RegExp[] = [
  /du coup/i, // trop courant à l'oral, accepté dans le contenu informel
  /opportunit/i, // utilisé volontairement dans certains contextes
];

/** Collecter toutes les chaînes de texte visibles du site */
function collectAllTexts(): { source: string; text: string }[] {
  const texts: { source: string; text: string }[] = [];

  for (const a of allActualites) {
    texts.push({ source: `actualites: ${a.title}`, text: a.title });
    texts.push({ source: `actualites: ${a.title}`, text: a.description });
  }
  for (const bts of behindTheScenes) {
    texts.push({ source: `BTS: ${bts.name}`, text: bts.quote });
    texts.push({ source: `BTS: ${bts.name}`, text: bts.context });
    texts.push({ source: `BTS: ${bts.name}`, text: bts.insight });
  }
  // Verbatims : la parole d'autrui, publiée avec son nom. La typographie et
  // l'orthographe s'y relisent comme le reste du site (les écarts au texte reçu
  // sont documentés dans `src/data/verbatims.ts`).
  for (const v of verbatims) {
    texts.push({ source: `verbatim: ${v.auteur}`, text: v.citation });
    texts.push({ source: `verbatim: ${v.auteur}`, text: v.qualite });
  }
  for (const p of prix) {
    texts.push({ source: `prix: ${p.place}`, text: p.reward });
    if (p.detail) texts.push({ source: `prix: ${p.place}`, text: p.detail });
  }
  for (const f of faq) {
    texts.push({ source: `FAQ: ${f.q}`, text: f.q });
    texts.push({ source: `FAQ: ${f.q}`, text: f.a });
  }
  for (const p of pourquoi) {
    texts.push({ source: `partenaires: ${p.title}`, text: p.title });
    texts.push({ source: `partenaires: ${p.title}`, text: p.description });
  }
  for (const t of typesSoutien) {
    texts.push({ source: `façon d'aider: ${t.id}`, text: t.titre });
    texts.push({ source: `façon d'aider: ${t.id}`, text: t.aide });
    for (const m of t.membres) texts.push({ source: `partenaire: ${t.id}/${m.nom}`, text: m.role });
  }
  for (const s of codeDeConduite) {
    for (const t of [s.titre, ...s.paragraphes, ...(s.liste ?? []), ...(s.apresListe ?? [])]) {
      texts.push({ source: `code de conduite: ${s.id}`, text: t });
    }
  }
  for (const t of [introAdhesion, ...tarifsAdhesion, ...aSavoirAdhesion]) {
    texts.push({ source: "adhésion", text: t });
  }
  // Taxonomies : libellés affichés au profil, en filtres et sur les fiches.
  for (const v of [...SECTEURS, ...SUJETS, ...REGIONS, ...LANGUES]) {
    texts.push({ source: `taxonomie: ${v}`, text: v });
  }
  // Moissonneur : explication affichée dans les pages internes.
  texts.push({ source: "moissonneur: titre", text: MOISSONNEUR_TITRE });
  texts.push({ source: "moissonneur: intro", text: MOISSONNEUR_INTRO });
  for (const e of MOISSONNEUR_ETAPES) {
    texts.push({ source: `moissonneur étape: ${e.titre}`, text: e.titre });
    texts.push({ source: `moissonneur étape: ${e.titre}`, text: e.detail });
  }
  for (const g of MOISSONNEUR_GARANTIES) {
    texts.push({ source: "moissonneur: garantie", text: g });
  }
  // Annonce des nouveautés : la copie part par E-MAIL, où rien ne se corrige
  // après coup — elle se relit donc au moins aussi sévèrement que le site.
  for (const n of NOUVEAUTES_PLATEFORME) {
    texts.push({ source: `nouveauté: ${n.titre}`, text: n.titre });
    texts.push({ source: `nouveauté: ${n.titre}`, text: n.texte });
    texts.push({ source: `nouveauté: ${n.titre}`, text: n.lienLabel });
    // `alt` est vide quand la nouveauté vit sans capture : rien à relire.
    if (n.alt) texts.push({ source: `nouveauté (alt): ${n.titre}`, text: n.alt });
  }
  for (const a of ET_AUSSI) {
    texts.push({ source: "nouveautés: et aussi", text: a.texte });
  }
  for (const a of A_VENIR) {
    texts.push({ source: "nouveautés: à venir", text: a.texte });
  }
  for (const b of BLOCS_NOUVEAUTES) {
    texts.push({ source: `bloc: ${b.titre}`, text: b.titre });
    if (b.intro) texts.push({ source: `bloc: ${b.titre}`, text: b.intro });
  }

  return texts;
}

/**
 * La copie ne vit plus seulement dans `src/data` : les modules de DÉRIVATION
 * (`atelier-etat`, `recit-edition`, `taches`…) et les composants partagés
 * produisent désormais leurs propres phrases — hors de tout garde-fou, si bien
 * qu'une réécriture a pu y perdre des espaces insécables sans que la CI bronche.
 *
 * On y applique les règles de TYPOGRAPHIE seulement (l'orthographe ferait trop
 * de faux positifs sur du code), et sur les seules règles qu'une chaîne
 * technique ne peut pas déclencher : une classe Tailwind (`sm:grid-cols-2`) n'a
 * pas d'espace avant son deux-points.
 *
 * La lecture passe par l'AST TypeScript, pas par une expression régulière : un
 * gabarit imbriqué (`${n > 1 ? "s" : ""}`) découpé au regex produit des bouts
 * comme « ? " » et « : "" » qui déclenchent la règle à tort. Les arguments de
 * `console.*` sont ignorés — un message de log n'est pas de la copie.
 *
 * Liste EXPLICITE de fichiers, pas un dossier entier : le reste de `src/lib` et
 * `src/components` porte encore des manquements antérieurs (e-mails, messages
 * de formulaire), dont la reprise est suivie dans docs/dette-technique.md.
 * Étendre cette liste au fil des reprises est le but — un fichier ajouté ici
 * n'en sort plus.
 */
const FICHIERS_COPIE = [
  // Les e-mails sont de la COPIE comme les écrans — le digest orga écrivait
  // ses deux-points sans insécable et rien ne l'attrapait (lot 7).
  "src/lib/digest-email.ts",
  "src/lib/atelier-audience.ts",
  "src/lib/atelier-etat.ts",
  "src/lib/recit-edition.ts",
  "src/lib/agenda-ateliers.ts",
  "src/lib/mon-agenda.ts",
  "src/lib/format.ts",
  "src/lib/taches.ts",
  "src/lib/taches-chargement.ts",
  "src/components/FaitsAtelier.tsx",
  "src/components/ColonneDate.tsx",
  "src/components/LienVisio.tsx",
  "src/components/ListeSection.tsx",
  "src/components/ListeTaches.tsx",
  "src/components/EditionListItem.tsx",
  "src/components/EcheanceCard.tsx",
  "src/components/AtelierDetail.tsx",
  "src/components/SousGroupeDetail.tsx",
  "src/components/QuandAtelier.tsx",
  "src/components/Heures.tsx",
  "src/components/NavRow.tsx",
  "src/components/BottomNav.tsx",
  // La navigation connectée (2026-10-15) : un « ? » sans insécable dans la
  // feuille ➕ et des guillemets sans insécables dans la fenêtre « Une date »
  // sont passés parce que ces fichiers manquaient ici (revue RGAA).
  "src/components/RailEspace.tsx",
  "src/components/FeuilleCreer.tsx",
  "src/app/mon-espace/AjoutDateRapide.tsx",
  // L'e-mail d'annonce : sa copie vit dans le module qui la met en forme, et
  // une faute partie par e-mail reste partie.
  "src/lib/nouveautes-email.ts",
  // Ajoutés en revue RGAA d'`/actualites` (08-02) : la page produit désormais de
  // la copie pour lecteur d'écran (compléments d'intitulés, résumé de filtre),
  // que rien ne relisait.
  "src/app/actualites/ActualitesListe.tsx",
  "src/app/actualites/page.tsx",
  // Lot N4 (Bravo) : la rangée, ses libellés et les messages de l'action
  // sont de la copie d'écran — la typographie s'y relit comme ailleurs.
  "src/components/ReactionRow.tsx",
  "src/lib/reaction-libelle.ts",
  "src/app/mon-espace/actions.ts",
  // Ajoutée en revue wording du 08-16 : la page porte les messages d'échec du
  // geste irréversible, et une espace ordinaire avant « : » y était passée. La
  // règle existait, le fichier manquait à la liste — corriger la phrase sans
  // l'ajouter aurait laissé la suivante passer pareil.
  "src/app/mon-espace/supprimer/page.tsx",
  // Ajoutés en revue wording du 08-16 (correctif des propositions partagées) :
  // `actions.ts` était relu, les deux écrans qui AFFICHENT ses messages ne
  // l'étaient pas — les insécables s'arrêtaient donc à la frontière du module.
  // Même leçon qu'au-dessus : la règle existait, les fichiers manquaient.
  "src/app/mon-espace/talks/[id]/page.tsx",
  "src/app/mon-espace/OccurrenceForm.tsx",
  // Lot 1 de l'agenda public (l'entrée : recherche et facettes) : la lib
  // COMPOSE la phrase qui nomme le filtre actif (« à Toulouse ou en ligne »,
  // « correspondant à ta recherche « … » »), la barre porte ses étiquettes, et
  // les deux pages leur mot de vide. Ajoutés AVEC le code, plutôt qu'à la
  // première faute constatée — c'est la leçon des entrées du 08-16.
  "src/lib/agenda-filtres.ts",
  "src/app/agenda/AgendaFiltres.tsx",
  "src/app/agenda/page.tsx",
  "src/app/agenda/[annee]/page.tsx",
];

const REGLES_TYPO_SOURCE: SpellingRule[] = [
  {
    pattern: / [!?;:](?!\/)/,
    message: "Espace normale avant ! ? ; : → utiliser l'espace insécable (\\u00A0)",
  },
  { pattern: /« |\S »/, message: "Espace intérieure des guillemets « » → insécable (\\u00A0)" },
];

describe("Typographie française du code qui produit de la copie", () => {
  const sources = FICHIERS_COPIE.map((f) => ({
    fichier: f,
    textes: textesAffichables(f, readFileSync(f, "utf8")),
  }));

  it("tous les fichiers listés portent bien de la copie (garde-fou jamais à vide)", () => {
    // Un fichier renommé fait échouer la lecture plus haut. Ici on vérifie
    // qu'aucun n'est devenu muet : un module qui ne produit plus de texte n'a
    // rien à garder et doit quitter la liste, sinon le test rassure pour rien.
    expect(sources.filter((s) => s.textes.length === 0).map((s) => s.fichier)).toEqual([]);
  });

  for (const regle of REGLES_TYPO_SOURCE) {
    it(regle.message, () => {
      const violations: string[] = [];
      for (const { fichier, textes } of sources) {
        for (const t of textes) {
          if (regle.pattern.test(t)) violations.push(`[${fichier}] "${t.slice(0, 80)}…"`);
        }
      }
      if (violations.length > 0) {
        expect.fail(
          `${regle.message}\n\nTrouvé dans :\n${violations.map((v) => `  - ${v}`).join("\n")}`,
        );
      }
    });
  }
});

describe("Orthographe et typographie française", () => {
  const allTexts = collectAllTexts();

  for (const rule of SPELLING_RULES) {
    // Skip rules that are in the exceptions list
    const isException = EXCEPTIONS.some((ex) => ex.source === rule.pattern.source);
    if (isException) continue;

    it(`pas de « ${rule.message.split("»")[0].split("«")[1]?.trim() || rule.message} »`, () => {
      const violations: string[] = [];

      for (const { source, text } of allTexts) {
        if (rule.pattern.test(text)) {
          violations.push(`[${source}] "${text.slice(0, 80)}…"`);
        }
      }

      if (violations.length > 0) {
        expect.fail(
          `${rule.message}\n\nTrouvé dans :\n${violations.map((v) => `  - ${v}`).join("\n")}`,
        );
      }
    });
  }

  it("pas de texte vide dans les données", () => {
    for (const { source, text } of allTexts) {
      expect(text.trim().length, `Texte vide dans ${source}`).toBeGreaterThan(0);
    }
  });
});
