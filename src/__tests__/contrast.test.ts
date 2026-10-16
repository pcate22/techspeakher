// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Contrôle de CONTRASTE (WCAG 2.1) des couleurs du design système. axe ne peut
 * pas mesurer le contraste sous jsdom (pas de moteur de rendu) : on le calcule
 * ici directement depuis les tokens de `globals.css`, source unique de vérité.
 *
 * Ce test échoue si un token dérive et fait passer une paire approuvée sous son
 * seuil : c'est le garde-fou des risques de contraste, réels avec notre palette
 * (le magenta sur les fonds violets est limite).
 *
 * Seuils AA : texte normal >= 4.5 ; grand texte (>= 24px, ou >= 18.66px gras)
 * et composants d'UI >= 3.0.
 */

const AA_NORMAL = 4.5;
const AA_GRAND = 3.0;

/** Extrait les tokens `--color-*: #hex` de globals.css. */
function lireTokens(): Record<string, string> {
  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
  const tokens: Record<string, string> = {};
  const re = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) tokens[m[1]] = m[2].toLowerCase();
  return tokens;
}

/** Luminance relative WCAG d'une couleur #rrggbb. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = canal((n >> 16) & 255);
  const g = canal((n >> 8) & 255);
  const b = canal(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ratio de contraste WCAG entre deux couleurs (1 à 21). */
function ratio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

const T = lireTokens();
const r = (fg: string, bg: string) => ratio(T[fg], T[bg]);

/**
 * Couleur d'un token posé à N % d'opacité sur un fond opaque : la composition
 * sRGB des navigateurs (et des classes `couleur/50` de Tailwind), canal par
 * canal, AVANT la linéarisation — mélanger les luminances donnerait un autre
 * résultat que l'écran.
 */
function fondu(fg: string, bg: string, alpha: number): string {
  const n = (h: string) => parseInt(h.slice(1), 16);
  const a = n(T[fg]);
  const b = n(T[bg]);
  const mix = (shift: number) => {
    const ca = (a >> shift) & 255;
    const cb = (b >> shift) & 255;
    return Math.round(alpha * ca + (1 - alpha) * cb);
  };
  return `#${((mix(16) << 16) | (mix(8) << 8) | mix(0)).toString(16).padStart(6, "0")}`;
}

/**
 * MATRICE APPROUVÉE (à garder synchro avec docs/principes-conception-ui.md).
 * Chaque paire texte/fond réellement employée, avec son usage minimal autorisé.
 */
const FONDS = ["navy", "navy-light", "navy-lighter"] as const;

// Textes sûrs en TOUTE TAILLE (>= 4.5) sur les trois fonds sombres.
const TEXTE_NORMAL_OK = [
  "white",
  "gray-light",
  "cyan",
  "cyan-light",
  "magenta-light",
  "orange",
  "gold",
  "silver",
  "cream",
];

describe("contraste WCAG — tokens du design système", () => {
  it("tous les tokens attendus existent dans globals.css", () => {
    for (const c of [...FONDS, ...TEXTE_NORMAL_OK, "magenta", "navy"])
      expect(T[c], `token --color-${c} manquant`).toBeTruthy();
  });

  describe("texte normal (>= 4.5) sur fonds sombres", () => {
    for (const bg of FONDS)
      for (const fg of TEXTE_NORMAL_OK)
        it(`${fg} sur ${bg}`, () => {
          expect(r(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
        });
  });

  describe("texte navy sur fonds clairs (boutons / badges pleins)", () => {
    for (const bg of ["cyan", "gold", "cream", "white", "magenta", "silver"])
      it(`navy sur ${bg}`, () => {
        expect(r("navy", bg)).toBeGreaterThanOrEqual(AA_NORMAL);
      });
  });

  describe("magenta : réservé au GRAND texte / éléments d'UI, pas au corps de texte", () => {
    // Le magenta plein passe le corps de texte sur navy et navy-light, mais PAS
    // sur navy-lighter (4.12) : pour du texte normal, utiliser magenta-light.
    it("magenta sur navy-lighter reste >= 3.0 (grand texte / bordure OK)", () => {
      expect(r("magenta", "navy-lighter")).toBeGreaterThanOrEqual(AA_GRAND);
    });
    it("magenta sur navy-lighter est SOUS 4.5 (donc interdit en corps de texte)", () => {
      // Verrou de documentation : si un jour le token passe >= 4.5, relâcher la
      // contrainte dans le design système ; tant qu'il est sous 4.5, magenta-light
      // est le token à utiliser pour le texte normal.
      expect(r("magenta", "navy-lighter")).toBeLessThan(AA_NORMAL);
    });
    it("magenta-light, lui, est sûr en corps de texte sur les trois fonds", () => {
      for (const bg of FONDS)
        expect(r("magenta-light", bg)).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  });

  // Contraste NON TEXTUEL (WCAG 1.4.11) : un contour de champ/contrôle est un
  // composant d'UI, seuil >= 3.0. L'ancien `border-navy-lighter` (#2A2068) sur
  // un champ `bg-navy` tombait à ~1.26 : invisible, a fortiori au soleil (cf.
  // principes §9). Le token `field-border` doit rester lisible sur les 3 fonds.
  describe("contraste non textuel — contours de champs (>= 3.0)", () => {
    it("le token --color-field-border existe dans globals.css", () => {
      expect(T["field-border"], "token --color-field-border manquant").toBeTruthy();
    });
    for (const bg of FONDS)
      it(`field-border sur ${bg}`, () => {
        expect(r("field-border", bg)).toBeGreaterThanOrEqual(AA_GRAND);
      });
  });

  // Pastille agenda (rappels du tableau de bord + liste des ateliers) : les
  // tuiles vivent sur une rangée `bg-navy`, leur contour porte la limite du
  // composant (1.4.11, >= 3.0). On l'assure avec des tokens PLEINS (gold /
  // orange / field-border) : les bords en opacité fractionnaire d'avant
  // tombaient sous le seuil sur navy (border-gold/40 ~ 2,5 ; border-orange/50
  // ~ 2,9 ; border-navy-lighter ~ 1,26) et s'effaçaient au soleil (cf. §9).
  describe("contraste non textuel — contour des pastilles agenda (>= 3.0 sur navy)", () => {
    for (const bord of ["gold", "orange", "field-border"] as const)
      it(`${bord} sur navy`, () => {
        expect(r(bord, "navy")).toBeGreaterThanOrEqual(AA_GRAND);
      });
  });
});

/**
 * BORDURES D'INTERFACE À OPACITÉ RÉDUITE (WCAG 1.4.11, seuil 3:1).
 *
 * Le contour au repos des puces de « À faire » (`PucesVue`) est `cyan/50` : la
 * conception (D4, R3) a MESURÉ 3,81:1 et rejeté `cyan/30` (2,13:1). Mais
 * jusqu'ici, seul le NOM de la classe était gardé (une chaîne dans un banc de
 * compo) : changer le token `--color-cyan` dans globals.css aurait cassé le
 * ratio en silence — et les puces ne passent sous axe qu'à partir de deux
 * familles de tâches, atteignables par personne aujourd'hui. Le ratio se garde
 * donc ICI, calculé depuis les tokens (relevé de la passe justesse du lot 5,
 * fermé le 2026-08-18).
 */
describe("bordures d'interface à opacité réduite (1.4.11)", () => {
  it("cyan/50 sur navy et navy-light tient 3:1 (le contour des puces)", () => {
    expect(ratio(fondu("cyan", "navy", 0.5), T["navy"])).toBeGreaterThanOrEqual(AA_GRAND);
    expect(ratio(fondu("cyan", "navy-light", 0.5), T["navy-light"])).toBeGreaterThanOrEqual(
      AA_GRAND,
    );
  });

  it("cyan/30 est SOUS 3:1 — le verrou qui documente pourquoi /50", () => {
    // Si le token cyan s'éclaircit un jour au point que /30 passe, relâcher
    // la contrainte en connaissance ; tant qu'il est sous 3:1, /30 est
    // interdit sur une bordure porteuse d'état (même verrou que magenta).
    expect(ratio(fondu("cyan", "navy", 0.3), T["navy"])).toBeLessThan(AA_GRAND);
  });
});
