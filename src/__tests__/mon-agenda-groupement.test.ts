import { describe, it, expect } from "vitest";
import { grouperParMois, avecAujourdhui } from "@/lib/mon-agenda";
import { makeAtelierAgenda } from "./test-helpers";

/**
 * LE JOUR MÊME EST UNE DATE DU FIL, pas une frontière entre deux zones : sa
 * ligne existe toujours, à sa place chronologique, même vide (le défaut qui l'a
 * imposé est au registre, `docs/principes-conception-ui.md`, 16/08/2026).
 */

const atelier = (date: string, atelierId = 1) => makeAtelierAgenda({ atelierId, date });

const dates = (mois: ReturnType<typeof avecAujourdhui>) =>
  mois.flatMap((m) => m.jours.map((j) => j.date));

describe("avecAujourdhui — le jour même a sa ligne", () => {
  it("mois courant ABSENT : il naît, à sa place chronologique", () => {
    const mois = grouperParMois([atelier("2026-09-01"), atelier("2026-10-06", 2)]);
    const avec = avecAujourdhui(mois, "2026-08-16");
    expect(avec.map((m) => m.mois)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(dates(avec)).toEqual(["2026-08-16", "2026-09-01", "2026-10-06"]);
    // Vide : c'est la page qui dira « rien à l'agenda aujourd'hui ».
    expect(avec[0].jours[0].echeances).toEqual([]);
  });

  it("mois courant PRÉSENT mais pas le jour : le jour s'insère dans l'ordre", () => {
    // Le premier jour du mois est ANTÉRIEUR à aujourd'hui : une fenêtre en cours
    // (« du 10 au 20 ») reste à venir tant que sa fin n'est pas passée, et se
    // range sous son jour de début. Insérer en tête aurait cassé l'ordre.
    const mois = grouperParMois([atelier("2026-08-10"), atelier("2026-08-25", 2)]);
    const avec = avecAujourdhui(mois, "2026-08-16");
    expect(avec).toHaveLength(1);
    expect(dates(avec)).toEqual(["2026-08-10", "2026-08-16", "2026-08-25"]);
  });

  it("le jour même a DÉJÀ ses échéances : rien n'est ajouté, rien n'est vidé", () => {
    const mois = grouperParMois([atelier("2026-08-16"), atelier("2026-08-25", 2)]);
    const avec = avecAujourdhui(mois, "2026-08-16");
    expect(dates(avec)).toEqual(["2026-08-16", "2026-08-25"]);
    expect(avec[0].jours[0].echeances).toHaveLength(1);
  });

  it("plus rien devant : le fil se termine sur le jour même", () => {
    const avec = avecAujourdhui([], "2026-08-16");
    expect(dates(avec)).toEqual(["2026-08-16"]);
  });

  it("le mois courant se range APRÈS un mois plus ancien resté à venir", () => {
    // Une fenêtre de juillet toujours ouverte : elle précède le mois courant.
    const mois = grouperParMois([atelier("2026-07-30")]);
    const avec = avecAujourdhui(mois, "2026-08-16");
    expect(avec.map((m) => m.mois)).toEqual(["2026-07", "2026-08"]);
  });
});
