import { describe, it, expect } from "vitest";
import {
  emporteAtelier,
  apercuRetraitAtelier,
  confirmationRetraitAtelier,
} from "@/lib/atelier-retrait";

/**
 * Ce que la suppression d'un atelier EMPORTE, dit une seule fois : la page de
 * retrait le chiffre avant l'appui, et la confirmation de la liste redit ce qui
 * est parti. Deux écritures auraient divergé — c'est exactement ce que §10 des
 * principes demande d'éviter.
 */

const compte = (o: Partial<Record<string, number>> = {}) => {
  const c = { nbParticipantes: 0, nbSousGroupes: 0, nbSupports: 0, nbCoachs: 0, ...o };
  return { ...c, total: c.nbParticipantes + c.nbSousGroupes + c.nbSupports + c.nbCoachs };
};

describe("emporteAtelier", () => {
  it("vide : rien à énumérer", () => {
    expect(emporteAtelier(compte())).toEqual([]);
  });

  it("n'énumère QUE ce qui existe (pas de « 0 sous-groupe » en bruit de fond)", () => {
    expect(emporteAtelier(compte({ nbParticipantes: 6, nbSupports: 1 }))).toEqual([
      "6 participantes et leurs présences",
      "1 support",
    ]);
  });

  it("accorde les pluriels et nomme le rattachement des coachs", () => {
    expect(emporteAtelier(compte({ nbSousGroupes: 3, nbCoachs: 2 }))).toEqual([
      "3 sous-groupes",
      "le rattachement de 2 coachs",
    ]);
  });
});

describe("apercuRetraitAtelier", () => {
  // Typographie maison : guillemets français et espaces INSÉCABLES autour du
  // titre comme avant les deux-points.
  it("atelier vide : il part seul (aucune saisie à réclamer)", () => {
    expect(apercuRetraitAtelier("Écrire son abstract", compte())).toBe(
      "« Écrire son abstract » ne porte rien pour l'instant : il part seul.",
    );
  });

  it("atelier investi : le périmètre est CHIFFRÉ avant le clic", () => {
    expect(
      apercuRetraitAtelier("Répétition générale", compte({ nbParticipantes: 6, nbSousGroupes: 3 })),
    ).toBe(
      "Supprime « Répétition générale » et, avec lui, 6 participantes et leurs présences, 3 sous-groupes.",
    );
  });
});

describe("confirmationRetraitAtelier", () => {
  // Sans modale ni titre à retaper, c'est la confirmation APRÈS coup qui rend
  // compte de ce que le geste a emporté. Elle nomme l'atelier et le chiffre.
  it("atelier vide : la confirmation dit juste ce qui s'est passé", () => {
    expect(confirmationRetraitAtelier("Atelier créé en double", compte())).toBe(
      "« Atelier créé en double » est supprimé.",
    );
  });

  it("atelier investi : elle dit AUSSI ce qui est parti avec lui", () => {
    expect(
      confirmationRetraitAtelier(
        "Répétition générale",
        compte({ nbParticipantes: 6, nbSupports: 2 }),
      ),
    ).toBe(
      "« Répétition générale » est supprimé, avec 6 participantes et leurs présences, 2 supports.",
    );
  });
});
