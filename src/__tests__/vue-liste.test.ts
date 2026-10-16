import { describe, it, expect } from "vitest";
import { VUES, cleVue, avecVue, messageVide, type CleVue } from "@/lib/vue-liste";

/**
 * Une tâche groupée du cockpit (« Donner une date à 3 ateliers ») menait en HAUT
 * de la liste des ateliers : on arrivait quelque part, puis on cherchait. Elle
 * mène maintenant à une VUE de la liste — d'où ce petit registre partagé, seul
 * garant que la clé écrite par la tâche est bien celle que la page sait filtrer.
 */
describe("vues filtrées des listes admin", () => {
  const PAGE_ATELIERS: readonly CleVue[] = ["a-dater", "presences"];

  it("une clé connue ET permise sur la page passe", () => {
    expect(cleVue("a-dater", PAGE_ATELIERS)).toBe("a-dater");
    expect(cleVue("presences", PAGE_ATELIERS)).toBe("presences");
  });

  it("une clé connue mais étrangère à la page est ignorée", () => {
    expect(cleVue("sans-compte", PAGE_ATELIERS)).toBeNull();
  });

  it("une clé inventée est ignorée : aucun bandeau ne promet un filtre inexistant", () => {
    expect(cleVue("../../admin", PAGE_ATELIERS)).toBeNull();
    expect(cleVue("", PAGE_ATELIERS)).toBeNull();
  });

  it("un paramètre répété (?vue=a&vue=b) est ignoré", () => {
    expect(cleVue(["a-dater", "presences"], PAGE_ATELIERS)).toBeNull();
  });

  it("sans paramètre, la liste s'affiche entière", () => {
    expect(cleVue(undefined, PAGE_ATELIERS)).toBeNull();
  });

  it("le lien d'une tâche groupée porte sa vue", () => {
    expect(avecVue("/admin/tremplins/1/ateliers", "a-dater")).toBe(
      "/admin/tremplins/1/ateliers?vue=a-dater",
    );
  });

  it("chaque vue dit ce qui EST vrai quand elle ne retient rien (forme positive)", () => {
    for (const [cle, v] of Object.entries(VUES)) {
      expect(v.titre.length, cle).toBeGreaterThan(0);
      expect(v.vide, cle).toMatch(/\.$/);
      expect(v.videSansBase, cle).toMatch(/\.$/);
      // Wording toujours à la forme positive (CLAUDE.md) : on dit ce qui est,
      // jamais « ne … pas ». Le message « tâche réglée » (vide) va plus loin :
      // il célèbre l'état atteint, sans même un « aucun ». Le message de
      // vacuité, lui, constate une absence — « Aucun atelier passé » est la
      // forme validée par la charte (« Aucun talk pitché »).
      expect(v.vide.toLowerCase(), cle).not.toMatch(/\bn['e]|\bpas\b|\baucun/);
      expect(v.videSansBase.toLowerCase(), cle).not.toMatch(/\bn['e]|\bpas\b/);
    }
  });

  it("messageVide distingue « tâche réglée » de « population vide »", () => {
    expect(messageVide("presences", true)).toBe(
      "Les présences des ateliers passés sont pointées.",
    );
    expect(messageVide("presences", false)).toBe(
      "Aucun atelier passé pour l'instant\u00a0: rien à pointer.",
    );
    expect(messageVide("sans-compte", false)).toBe("Aucune inscrite pour l'instant.");
  });
});

/**
 * Les vues de la liste « À faire » (étape B, D4) : le MÊME contrat d'URL que
 * les listes d'ateliers — le filtre vit dans l'URL, un lien, pas un état.
 *
 * Une seule grammaire, un seul axe : POUR QUI est-ce ? (arbitrage B5). « Tout »
 * reste hors patron parce qu'il est l'absence de filtre — il n'a pas d'entrée
 * ici, son href est la page sans paramètre.
 */
describe("vues de la liste « À faire » — une clé par famille", () => {
  it("les trois familles ont leur vue, et la grammaire est « pour qui »", () => {
    expect(VUES.personnel.titre).toBe("Pour moi");
    expect(VUES.association.titre).toBe("Pour l'association");
    expect(VUES.accompagnement.titre).toBe("Pour mes coachées");
  });

  it("les clés sont les familles du moteur, mot pour mot", () => {
    // C'est ce qui permet d'intersecter la vue avec les familles CHARGÉES sans
    // table de correspondance — une correspondance serait une divergence en
    // attente (le jour où une famille se renomme d'un seul côté).
    for (const cle of ["personnel", "association", "accompagnement"] as const) {
      expect(cleVue(cle, [cle])).toBe(cle);
    }
  });

  it("chaque vue dit son état d'arrivée à la forme positive", () => {
    for (const cle of ["personnel", "association", "accompagnement"] as const) {
      expect(VUES[cle].vide).not.toMatch(/\bne\b.*\b(pas|plus)\b/i);
      expect(VUES[cle].vide.length).toBeGreaterThan(0);
      expect(VUES[cle].videSansBase.length).toBeGreaterThan(0);
    }
  });
});
