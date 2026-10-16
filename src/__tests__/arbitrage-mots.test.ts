import { describe, it, expect } from "vitest";
import { effetDuRefus } from "@/lib/proposition-arbitrage";

/**
 * Les mots de l'arbitrage. Ce banc existe parce que la phrase d'un geste de
 * PALIER 2 est contrainte par la charte sur trois points à la fois — forme
 * positive, nom de la chose concernée, périmètre chiffré — et qu'aucun de ces
 * trois-là ne se voit à la relecture d'une diff. Il existe aussi parce qu'un
 * test ne peut pas lire le contenu d'une modale Radix fermée : la phrase doit
 * vivre hors du JSX pour être gardée.
 */
describe("effetDuRefus — ce qu'écarter emporte, dit avant le clic", () => {
  const cas = [
    { nom: "DevoxxFR", nbSaisies: 1, proposeParNom: "Aurélie Vache" },
    { nom: "KubeCon + CloudNativeCon EU", nbSaisies: 3, proposeParNom: "Ada" },
    // Compte supprimé entre la proposition et l'arbitrage : la phrase tient.
    { nom: "Cloudbees - Internal", nbSaisies: 0, proposeParNom: null },
  ];

  it("dit le périmètre CHIFFRÉ des saisies, au bon nombre", () => {
    expect(effetDuRefus(cas[0])).toContain("1 talk restera hors ligne");
    expect(effetDuRefus(cas[1])).toContain("3 talks resteraient hors ligne");
    expect(effetDuRefus(cas[2])).toContain("Aucune saisie derrière elle.");
  });

  it("NOMME la conférence, et l'autrice quand on la connaît", () => {
    expect(effetDuRefus(cas[0])).toContain("« DevoxxFR »");
    expect(effetDuRefus(cas[0])).toContain("Aurélie Vache verra");
    expect(effetDuRefus(cas[2])).toContain("Son autrice verra");
  });

  it("dit le second effet, celui qu'aucun écran ne montre", () => {
    // Le refus vaut pour le NOM, toutes années confondues : c'est ce que
    // `findPropositionByNom` renvoie ensuite à la membre, et rien dans le
    // produit ne le défait.
    for (const c of cas) {
      expect(effetDuRefus(c)).toContain("refusé pour toute année");
      expect(effetDuRefus(c)).toContain("ouvrir la base");
    }
  });

  it("reste à la forme POSITIVE : elle dit ce qui EST", () => {
    // La règle du dépôt (CLAUDE.md) : « ne … pas », « ne … plus » interdits dans
    // les libellés et les messages. La première version disait « elle ne pourra
    // plus le proposer sous ce nom » — même information, forme interdite.
    for (const c of cas) {
      const phrase = effetDuRefus(c).toLowerCase();
      expect(phrase, c.nom).not.toMatch(/\bne\b|\bn['’]|\bpas\b|\bplus\b|\bjamais\b/);
    }
  });
});
