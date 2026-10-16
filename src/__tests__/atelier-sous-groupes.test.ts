import { describe, it, expect } from "vitest";
import { couvertureSousGroupes, repartitionComplete } from "@/lib/atelier-sous-groupes";

/**
 * « Le but des sous-groupes est de s'assurer que tout le monde a un sous-groupe
 * dans un ensemble donné » (orga, 01/08). Cet ensemble, c'est l'AUDIENCE de
 * l'atelier — résolue par `getCohorteAtelier`, testée avec elle. Ici on ne
 * teste que la confrontation : cohorte vs sous-groupes.
 *
 * Ces fonctions sont partagées par la liste des ateliers, la fiche et la page
 * de répartition, pour que les trois écrans ne racontent jamais deux choses
 * différentes.
 */

/** Cohorte type : quatre participantes concernées par l'atelier. */
const COHORTE = [1, 2, 3, 4];

describe("couvertureSousGroupes — qui reste sans sous-groupe", () => {
  it("répartition partielle : le reste est nommé, dans l'ordre de la cohorte", () => {
    const c = couvertureSousGroupes(COHORTE, [[1, 2]]);
    expect(c.total).toBe(4);
    expect(c.nbRangees).toBe(2);
    expect(c.aRanger).toEqual([3, 4]);
    expect(c.complete).toBe(false);
  });

  it("tout le monde rangé : complète", () => {
    const c = couvertureSousGroupes(COHORTE, [
      [1, 2],
      [3, 4],
    ]);
    expect(c.aRanger).toEqual([]);
    expect(c.complete).toBe(true);
  });

  it("aucun sous-groupe : toute la cohorte reste à ranger", () => {
    const c = couvertureSousGroupes(COHORTE, []);
    expect(c.aRanger).toEqual([1, 2, 3, 4]);
    expect(c.complete).toBe(false);
  });

  it("une rangée HORS cohorte ne fait pas croire à une couverture complète", () => {
    // Sortie de la phase après avoir été rangée : elle ne compense pas
    // l'absence de quelqu'un d'autre — sinon « 4 sur 4 » alors qu'il en manque.
    const c = couvertureSousGroupes(COHORTE, [[1, 2, 3, 99]]);
    expect(c.nbRangees).toBe(3);
    expect(c.aRanger).toEqual([4]);
    expect(c.complete).toBe(false);
  });

  it("cohorte vide : jamais « complète » (rien à couvrir n'est pas une réussite)", () => {
    const c = couvertureSousGroupes([], []);
    expect(c.total).toBe(0);
    expect(c.complete).toBe(false);
  });

  it("ids en désordre ou en double : triés, dédoublonnés, comptés une fois", () => {
    // Deux rendus serveur doivent donner la même page.
    const c = couvertureSousGroupes([4, 1, 1, 3], [[1]]);
    expect(c.total).toBe(3);
    expect(c.aRanger).toEqual([3, 4]);
  });
});

describe("repartitionComplete — « rien à couvrir » n'est pas « couvert »", () => {
  it("une cohorte vide n'est jamais complète", () => {
    expect(repartitionComplete(0, 0)).toBe(false);
  });

  it("complète dès que tout le monde est rangé", () => {
    expect(repartitionComplete(3, 3)).toBe(true);
    expect(repartitionComplete(3, 2)).toBe(false);
  });
});
