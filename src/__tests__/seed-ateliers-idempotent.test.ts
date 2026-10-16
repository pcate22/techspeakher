import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Garde anti-régression sur `db/sync-to-latest.sql` — le script rejoué à CHAQUE
 * déploiement.
 *
 * Le défaut constaté en prod le 01/08 : trois exemplaires de chacune des quatre
 * séances en duo du coaching 2026. Le seed 046 se garde par TITRE ; le bloc 050
 * RENOMME ces mêmes titres (« (1) » → « (séance 1) »). Tant que le renommage
 * passait APRÈS le seed, chaque déploiement rejouait « je cherche "(1)", je ne
 * le trouve plus (renommé au déploiement précédent), donc je réinsère » : quatre
 * doublons de plus à chaque mise en prod. Et une suppression à la main dans
 * l'admin ne tenait pas — les lignes revenaient au déploiement suivant.
 *
 * Trois invariants ferment la porte, et ce sont eux qu'on tient ici :
 *  1. le renommage passe AVANT le seed et AVANT le backfill de nature ;
 *  2. le seed ne porte que des titres d'ARRIVÉE (aucun que le renommage
 *     transformerait) ;
 *  3. le seed est un AMORÇAGE : il ne s'exécute que sur une édition qui ne
 *     porte encore aucun atelier de la phase — sans quoi une séance supprimée
 *     exprès par l'orga (séance annulée) reviendrait au déploiement suivant,
 *     et la suppression livrée à côté ne tiendrait pas ses promesses.
 *
 * Ils valent pour toute réécriture future du fichier, pas seulement pour ces
 * quatre titres.
 */

const sql = readFileSync(resolve(process.cwd(), "db/sync-to-latest.sql"), "utf8");

/** Le motif exact du renommage 050 : « (N) » en fin de titre. */
const MOTIF_RENOMMAGE = /\((\d+)\)$/;

const posRenommage = sql.indexOf("SET titre = regexp_replace(titre, '\\((\\d+)\\)$'");
const posSeed = sql.indexOf("INSERT INTO tremplin_ateliers");

describe("sync-to-latest — le seed d'ateliers reste idempotent d'un déploiement à l'autre", () => {
  it("les deux blocs sont bien présents (le test garde ce qu'il croit garder)", () => {
    expect(posRenommage).toBeGreaterThan(-1);
    expect(posSeed).toBeGreaterThan(-1);
  });

  it("le RENOMMAGE des titres passe AVANT le seed qui se garde par titre", () => {
    expect(posRenommage).toBeLessThan(posSeed);
  });

  it("le RENOMMAGE passe aussi avant le backfill de nature (049), qui cible par titre", () => {
    expect(posRenommage).toBeLessThan(sql.indexOf("SET nature = 'sous_groupes'"));
  });

  it("le seed n'AMORCE que : il ne s'exécute pas si la phase porte déjà des ateliers", () => {
    // Sans cette garde, supprimer une séance annulée dans l'admin ne tiendrait
    // pas : le titre n'existant plus, le seed la recrée au déploiement suivant.
    const seed = sql.slice(posSeed, sql.indexOf(";", sql.indexOf("NOT EXISTS", posSeed)) + 1);
    expect(seed).toMatch(/a\.phase = 'montee_sur_scene'/);
  });

  it("aucun titre du seed ne serait transformé par le renommage", () => {
    // Sinon le garde « NOT EXISTS par titre » comparerait un titre de départ à
    // des lignes déjà renommées, et réinsérerait.
    const seed = sql.slice(posSeed, sql.indexOf(";", sql.indexOf("NOT EXISTS", posSeed)));
    const titres = [...seed.matchAll(/\(\s*\d+,\s*'([^']+)'/g)].map((m) => m[1]);
    expect(titres.length).toBeGreaterThan(0);
    expect(titres.filter((t) => MOTIF_RENOMMAGE.test(t))).toEqual([]);
  });

  it("le backfill de nature (049) cible les mêmes titres que le seed", () => {
    // S'ils divergeaient, les séances en duo repartiraient en « collectif » sur
    // une base neuve — et l'admin leur réclamerait présences, lieu et coach.
    const seed = sql.slice(posSeed, sql.indexOf(";", sql.indexOf("NOT EXISTS", posSeed)));
    const titresSeed = new Set([...seed.matchAll(/\(\s*\d+,\s*'([^']+)'/g)].map((m) => m[1]));
    const posNature = sql.indexOf("SET nature = 'sous_groupes'");
    expect(posNature).toBeGreaterThan(-1);
    const bloc = sql.slice(posNature, sql.indexOf(";", posNature));
    const cibles = [...bloc.matchAll(/'([^']*\(séance \d+\)[^']*)'/g)].map((m) => m[1]);
    expect(cibles.length).toBeGreaterThan(0);
    for (const cible of cibles) expect(titresSeed).toContain(cible);
  });
});
