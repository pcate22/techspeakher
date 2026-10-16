import ts from "typescript";
import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * La COPIE d'un fichier source : ce qui a une chance d'atteindre un écran.
 *
 * Extrait par l'AST TypeScript, et pas par une expression régulière sur le
 * texte : un commentaire parle du code (il peut dire « orga », « asso », citer
 * une classe condamnée), une chaîne parle à quelqu'un. Chaque morceau de
 * gabarit est jugé séparément — la ponctuation vit dans le texte, jamais dans
 * l'interpolation.
 *
 * Deux exclusions, qui ne sont pas des exceptions mais la définition même de
 * « copie » :
 * - un message de `console.*` n'atteint aucun écran ;
 * - une REQUÊTE n'est pas une phrase (`SELECT`, `INSERT`… avec ses commentaires
 *   SQL, qui contiennent du français mais ne sont lus par personne).
 *
 * Vit ici, partagé : `french-spelling.test.ts` et les cliquets de vocabulaire
 * jugent le même corpus. Recopié, il aurait divergé — c'est déjà arrivé aux
 * classes de titre (`ListeSection`).
 */

const RESSEMBLE_A_DU_SQL =
  // Un mot-clé, ou une ligne de commentaire SQL (`-- …`) : les requêtes du
  // dépôt sont abondamment commentées en français, et le commentaire vit
  // souvent dans un morceau de gabarit qui, lui, ne porte aucun mot-clé.
  /\b(SELECT|INSERT INTO|UPDATE|DELETE FROM|CREATE TABLE|ALTER TABLE|FROM|WHERE|JOIN)\b|(^|\n)\s*--\s/;

export function textesAffichables(fichier: string, code: string): string[] {
  const src = ts.createSourceFile(fichier, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  const estLog = (n: ts.Node): boolean =>
    ts.isCallExpression(n) &&
    ts.isPropertyAccessExpression(n.expression) &&
    n.expression.expression.getText(src) === "console";
  const visite = (n: ts.Node) => {
    if (estLog(n)) return;
    // Une requête est jugée d'un bloc : ses commentaires SQL sont du français
    // que personne ne lit, et ils vivent dans les MORCEAUX du gabarit, pas
    // dans le morceau qui porte le mot-clé.
    if (
      (ts.isTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n)) &&
      RESSEMBLE_A_DU_SQL.test(n.getText(src))
    )
      return;
    if (
      ts.isStringLiteral(n) ||
      ts.isNoSubstitutionTemplateLiteral(n) ||
      ts.isTemplateHead(n) ||
      ts.isTemplateMiddle(n) ||
      ts.isTemplateTail(n) ||
      ts.isJsxText(n)
    ) {
      if (!RESSEMBLE_A_DU_SQL.test(n.text)) out.push(n.text);
    }
    n.forEachChild(visite);
  };
  visite(src);
  return out;
}

/** Fichiers `.ts`/`.tsx` de `src`, tests exclus. */
export function fichiersSources(): string[] {
  const racine = resolve(process.cwd(), "src");
  const parcourt = (dir: string): string[] => {
    const out: string[] = [];
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) out.push(...parcourt(p));
      else if (/\.tsx?$/.test(p)) out.push(p);
    }
    return out;
  };
  return parcourt(racine)
    // `relative` depuis le cwd, jamais `indexOf("src/")` : un dossier de
    // travail contenant lui-même un segment `src/` couperait au mauvais
    // endroit et ferait échouer toute la suite (relecture 2026-08-16).
    .map((f) => relative(process.cwd(), f))
    .filter((rel) => !rel.startsWith("src/__tests__/"));
}
