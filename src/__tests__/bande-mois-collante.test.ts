import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RACINE = join(process.cwd(), "src");

/**
 * LA BANDE DE MOIS DES AGENDAS A UNE HAUTEUR, ET UNE SEULE.
 *
 * `EnTetePeriode` est la TROISIÈME barre collante du site : elle s'ajoute à
 * l'en-tête et au fil d'Ariane, que le `scroll-padding-top` de `globals.css`
 * réserve déjà. Ce que l'on amène en vue dessous (le jour même à l'ouverture de
 * « Mon agenda », un lien de carte qui prend le focus) ajoute donc SA hauteur —
 * et rien de plus.
 *
 * Sans source unique, cette hauteur dérive. Elle a dérivé : les cartes des deux
 * agendas réservaient `scroll-mt-40`, soit 10 rem pour une bande de 2,5. Un lien
 * focalisé se posait alors si bas que la bande affichée au-dessus de lui était
 * celle du mois PRÉCÉDENT — la version clavier du défaut remonté de la prod le
 * 16/08/2026 (« je vois encore mai »), où l'arrivée sur la page cumulait deux
 * marges de défilement. Trop réserver ne masque rien, mais laisse en haut de
 * l'écran un titre qui ment.
 *
 * Même garde que `--hauteur-onglets` (cf. `barre-action-collante.test.ts`) :
 * la valeur vit dans un token, et rien ne la recopie.
 */

function fichiersSources(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...fichiersSources(p));
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const relatif = (f: string) => f.slice(f.indexOf("src/"));

/** Ce fichier-ci cite les valeurs interdites pour les expliquer : il s'exclut. */
const CE_FICHIER = "src/__tests__/bande-mois-collante.test.ts";

describe("bande de mois collante — une hauteur, un seul endroit", () => {
  it("aucune marge de défilement chiffrée à la main (le token, jamais un nombre)", () => {
    const offenders: string[] = [];
    for (const f of fichiersSources(RACINE)) {
      if (relatif(f) === CE_FICHIER) continue;
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((ligne, i) => {
          // Tout `scroll-mt-…` qui ne nomme pas le token : une valeur en dur
          // (`scroll-mt-40`) comme une valeur arbitraire (`scroll-mt-[2.5rem]`).
          const m = ligne.match(/\bscroll-mt-(?!bande-mois\b)[\w[\]./-]+/);
          if (m) offenders.push(`${relatif(f)}:${i + 1} → ${m[0]}`);
        });
    }
    expect(
      offenders,
      "Ce qui se range sous la bande de mois réserve `scroll-mt-bande-mois` " +
        "(globals.css), jamais une valeur recopiée : sinon le focus se pose sous " +
        "la bande, ou si bas qu'elle affiche le mois précédent.\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("la hauteur de la bande a une source unique, et l'en-tête s'y tient", () => {
    const css = readFileSync(join(RACINE, "app/globals.css"), "utf8");
    expect(css).toMatch(/--spacing-bande-mois:/);
    // Le token dit la hauteur RÉELLE de `EnTetePeriode` (py-2 + text-sm +
    // bordure). Si la bande grandit, c'est cette ligne-là qui change.
    const entete = readFileSync(join(RACINE, "components/EnTetePeriode.tsx"), "utf8");
    expect(
      entete,
      "`EnTetePeriode` doit rester collée sous les deux barres du site (`top-barres`) : " +
        "c'est ce qui fait d'elle la troisième barre que `--spacing-bande-mois` mesure",
    ).toMatch(/sticky top-barres/);
  });
});
