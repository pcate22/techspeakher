// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Garde-fou « sombre renforcé » (docs/principes-conception-ui.md §9) : sur nos
 * fonds sombres, un texte atténué en opacité (`text-<token>/70`, `/80`…) tombe
 * sous le seuil AA (ex. gray-light/70 ≈ 4.3:1 sur navy-lighter) et devient
 * illisible au soleil. La hiérarchie se fait par la TAILLE et la GRAISSE, jamais
 * par un contraste dégradé. Ce test interdit la réintroduction du motif.
 *
 * (On ne vise QUE `text-*` : les opacités de fond/bordure — `bg-white/5`,
 * `border-.../30` — restent légitimes.)
 */

const MOTIF =
  /text-(gray-light|magenta-light|cyan-light|cyan|cream|silver|white|gold|orange|coral|peach)\/(?:\d{2})\b/g;

function fichiersSources(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...fichiersSources(p));
    else if (/\.(tsx?|ts)$/.test(p)) out.push(p);
  }
  return out;
}

describe("sombre renforcé — pas de texte atténué en opacité", () => {
  it("aucun `text-<token>/NN` dans src (contraste dégradé interdit)", () => {
    const offenders: string[] = [];
    for (const f of fichiersSources(resolve(process.cwd(), "src"))) {
      const src = readFileSync(f, "utf8");
      const rel = f.slice(f.indexOf("src/"));
      src.split("\n").forEach((ligne, i) => {
        const m = ligne.match(MOTIF);
        if (m) offenders.push(`${rel}:${i + 1} → ${m.join(", ")}`);
      });
    }
    expect(
      offenders,
      `Texte atténué en opacité interdit (utiliser le token plein, cf. principes §9) :\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
