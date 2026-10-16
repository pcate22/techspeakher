import { describe, it, expect } from "vitest";
import {
  cohortePhaseAAjouter,
  type MembershipPhase,
} from "@/lib/tremplin-registration-phases";

// Règle unique de #29 « Activer toutes » : la cohorte à ajouter = les inscriptions
// de la phase visée qui ne sont PAS déjà membres de l'atelier. Testée ici en pur
// (le compteur UI et la cible de l'action la partagent).
const membres = (
  entries: [number, MembershipPhase[]][],
): Map<number, Set<MembershipPhase>> =>
  new Map(entries.map(([id, phases]) => [id, new Set(phases)]));

describe("cohortePhaseAAjouter", () => {
  it("ne retient que les inscriptions de la phase visée, hors membres actuels", () => {
    const phaseMembers = membres([
      [5, ["cfp_et_pitch"]],
      [6, ["montee_sur_scene"]], // autre phase → exclue
      [7, ["cfp_et_pitch", "montee_sur_scene"]],
      [10, ["cfp_et_pitch"]], // déjà membre → exclue
    ]);
    const aAjouter = cohortePhaseAAjouter(phaseMembers, "cfp_et_pitch", [10]);
    expect(aAjouter.sort((a, b) => a - b)).toEqual([5, 7]);
  });

  it("cohorte déjà entièrement membre → rien à ajouter", () => {
    const phaseMembers = membres([
      [5, ["cfp_et_pitch"]],
      [7, ["cfp_et_pitch"]],
    ]);
    expect(cohortePhaseAAjouter(phaseMembers, "cfp_et_pitch", [5, 7])).toEqual([]);
  });

  it("aucune inscription dans la phase → tableau vide (bouton masqué)", () => {
    const phaseMembers = membres([[6, ["montee_sur_scene"]]]);
    expect(cohortePhaseAAjouter(phaseMembers, "cfp_et_pitch", [])).toEqual([]);
  });

  it("l'union [...membresActuels, ...cohorte] est sans doublon (cohorte exclut les membres)", () => {
    const phaseMembers = membres([
      [5, ["cfp_et_pitch"]],
      [10, ["cfp_et_pitch"]],
    ]);
    const membresActuels = [10];
    const cible = [
      ...membresActuels,
      ...cohortePhaseAAjouter(phaseMembers, "cfp_et_pitch", membresActuels),
    ];
    expect(cible.sort((a, b) => a - b)).toEqual([5, 10]);
    expect(new Set(cible).size).toBe(cible.length);
  });
});
