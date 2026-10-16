import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * BOMBE DE DATE DANS LE DÉCOR (2026-10-14) : l'atelier « Répétition des
 * pitchs » de l'édition EN COURS était daté `DATE '2026-10-13'`. Le lendemain,
 * il est passé, la tâche « Pointer les présences » est apparue, et le parcours
 * « 4 tâches à faire » est tombé en CI sans qu'une ligne de code ait bougé.
 *
 * La règle : une date littérale PASSÉE le reste pour toujours, une date
 * littérale FUTURE finira par basculer. Tout ce qui doit rester « à venir »
 * s'écrit relatif à `CURRENT_DATE` / `now()`. Une date future fixe et
 * VOULUE (son effet ne dépend pas du jour) se déclare sur sa ligne avec le
 * marqueur `-- date fixe :` suivi de sa raison.
 *
 * L'ANNÉE a la même bombe, à plus longue mèche (P2 soldé le 2026-10-14) :
 * « Tremplin DevFest 2026 » garde son nom quand ses dates glissent en 2027, et
 * son édition de conférence sort des éditions récentes en 2028. L'année du
 * décor se dérive donc de `CURRENT_DATE`, côté seed comme côté e2e.
 */
const SEED = readFileSync(join(process.cwd(), "db/seed-preview.sql"), "utf8");
const DECOR = readFileSync(join(process.cwd(), "e2e/decor.ts"), "utf8");
const MARQUEUR = "-- date fixe :";

/** Le code SQL, commentaires retirés : une année citée en prose ne compte pas. */
const lignesDeCode = SEED.split("\n")
  .map((ligne, i) => ({ code: ligne.replace(/--.*$/, ""), ligne, n: i + 1 }))
  .filter(({ code }) => code.trim() !== "");

describe("db/seed-preview.sql — aucune date future en dur", () => {
  it("toute date littérale est passée, ou déclarée fixe avec sa raison", () => {
    // Date LOCALE (sv-SE rend AAAA-MM-JJ) : en UTC, avant 2 h à Paris, on lirait la veille.
    const aujourdhui = new Date().toLocaleDateString("sv-SE");
    const fautes = lignesDeCode
      .filter(({ ligne }) => !ligne.includes(MARQUEUR))
      .flatMap(({ code, n }) =>
        [...code.matchAll(/DATE '(\d{4}-\d{2}-\d{2})'/g)]
          .map((m) => m[1])
          .filter((d) => d >= aujourdhui)
          .map((d) => `ligne ${n} : ${d}`),
      );
    expect(fautes).toEqual([]);
  });

  it("aucune année en dur dans le code : noms, années et dates se dérivent du jour", () => {
    const fautes = lignesDeCode
      .filter(({ ligne }) => !ligne.includes(MARQUEUR))
      .filter(({ code }) => /\b20\d{2}\b/.test(code))
      .map(({ n, code }) => `ligne ${n} : ${code.trim()}`);
    expect(fautes).toEqual([]);
  });

  it("le seed et e2e/decor.ts datent la conférence du décor au même jour", () => {
    // Un seul décalage, écrit deux fois (SQL et TypeScript) : s'ils divergent,
    // l'import ne reconnaît plus l'édition et les URL des specs mènent à un 404.
    const seed = SEED.match(/date_conf\s+DATE\s*:=\s*CURRENT_DATE \+ (\d+);/);
    const decor = DECOR.match(/JOURS_AVANT_LA_CONF = (\d+);/);
    expect(seed?.[1]).toBeDefined();
    expect(decor?.[1]).toBe(seed?.[1]);
  });
});
