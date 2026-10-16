// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { textesAffichables, fichiersSources } from "./copie-affichee";

/**
 * Cliquet : la copie affichée dit des MOTS ENTIERS.
 *
 * « orga » et « asso » sont des troncatures de jargon interne. Elles supposent
 * qu'on connaît déjà la maison — c'est justement ce qu'une nouvelle venue n'a
 * pas, et c'est un obstacle net pour une lectrice avec une déficience
 * intellectuelle légère ou un trouble du langage : un mot tronqué n'est
 * reconnaissable que si on l'a déjà appris (`docs/principes-conception-ui.md`,
 * checklist COGA — « les mots »).
 *
 * L'espace organisatrices a été renommé le 2026-08-16, mais la relecture RGAA
 * a montré que la règle ne tenait qu'à cet endroit : plus de trente phrases
 * disaient encore « l'orga », dont une sur `/connexion` — une page PUBLIQUE,
 * lue par quelqu'un qui n'a pas de compte et à qui le mot ne peut rien dire.
 * Corriger un écran ne corrige pas une règle ; ce test la rend opposable
 * partout.
 *
 * `orga` est jugé en minuscules seulement : « Orga » capitalisé apparaît dans
 * des noms propres qui ne s'écrivent pas autrement (un intitulé de poste chez
 * un partenaire), et une troncature dans une phrase française est toujours en
 * bas de casse.
 */

const TRONCATURES: { motif: RegExp; message: string }[] = [
  { motif: /\borgas?\b/, message: "« orga » → « organisatrice » (mot entier)" },
  { motif: /\bassos?\b/i, message: "« asso » → « association » (mot entier)" },
];

/**
 * Une chaîne d'un seul tenant (`"asso"`, `"orga"`) n'est pas une phrase : c'est
 * une valeur — un `type` en base, une clé de tri. On ne juge que la PROSE.
 * Corollaire assumé : une étiquette d'un seul mot passe entre les mailles ;
 * c'est le prix d'un cliquet qui ne demande jamais d'exception pour du code.
 */
const estDeLaProse = (t: string) => /\s/.test(t.trim());

describe("copie affichée — des mots entiers, jamais du jargon tronqué", () => {
  const corpus = fichiersSources().map((rel) => ({
    fichier: rel,
    textes: textesAffichables(rel, readFileSync(resolve(process.cwd(), rel), "utf8")).filter(
      estDeLaProse,
    ),
  }));

  it("le corpus n'est pas vide (un garde-fou muet ne garde rien)", () => {
    expect(corpus.filter((c) => c.textes.length > 0).length).toBeGreaterThan(100);
  });

  for (const { motif, message } of TRONCATURES) {
    it(message, () => {
      const violations: string[] = [];
      for (const { fichier, textes } of corpus) {
        for (const t of textes) {
          if (motif.test(t))
            violations.push(`[${fichier}] « ${t.trim().replace(/\s+/g, " ").slice(0, 90)} »`);
        }
      }
      expect(
        violations,
        `${message}\n\nTrouvé dans :\n${violations.map((v) => `  - ${v}`).join("\n")}`,
      ).toEqual([]);
    });
  }
});
