import { describe, it, expect } from "vitest";
import {
  PHASE_ATELIER_LABEL,
  PHASES_ATELIER,
  ordonnerParPhase,
  voisinDansLaPhase,
  type PhaseAtelier,
} from "@/lib/tremplin-ateliers";
import { MEMBERSHIP_PHASE_LABEL } from "@/lib/tremplin-phases";

/**
 * La CADENCE d'un tremplin, telle que l'orga la conçoit.
 *
 * Retour orga : « la date définit la phase mais on n'a pas forcément la date
 * quand on définit les ateliers et leur cadence. On a surtout un ordre
 * d'atelier dans une phase de préparation. »
 *
 * Deux conséquences, verrouillées ici :
 *
 * 1. La phase se NOMME par ce qu'elle est — une préparation — et pas par un
 *    repère de calendrier (« Avant / Après la soirée »). Un même objet nommé
 *    deux fois dans deux tables de libellés finit toujours par diverger, et
 *    l'un des deux noms est faux : ici c'est celui du calendrier.
 * 2. L'ordre vit DANS la phase. Le programme se conçoit avant les dates, donc
 *    le rang d'une séance ne peut pas dépendre d'elles.
 */

const at = (id: number, phase: PhaseAtelier, ordre: number) => ({ id, phase, ordre });

describe("La phase se nomme par ce qu'elle est", () => {
  it("les libellés d'atelier et d'inscription sont les MÊMES mots", () => {
    for (const phase of PHASES_ATELIER) {
      expect(PHASE_ATELIER_LABEL[phase], phase).toBe(MEMBERSHIP_PHASE_LABEL[phase]);
    }
  });

  it("aucun libellé de phase ne parle du calendrier", () => {
    for (const phase of PHASES_ATELIER) {
      expect(PHASE_ATELIER_LABEL[phase], phase).not.toMatch(/soirée|avant|après/i);
      expect(PHASE_ATELIER_LABEL[phase], phase).toMatch(/préparation/i);
    }
  });

  it("les deux phases, dans l'ordre du parcours", () => {
    expect(PHASES_ATELIER).toEqual(["cfp_et_pitch", "montee_sur_scene"]);
  });
});

describe("ordonnerParPhase — le programme, phase par phase", () => {
  /**
   * L'ordre se lit sur `ordre`, JAMAIS sur la date : c'est tout l'intérêt. Une
   * séance non datée garde son rang, au lieu de tomber dans un tas « à dater ».
   */
  it("chaque phase rend ses séances dans leur ordre, datées ou pas", () => {
    const groupes = ordonnerParPhase([
      at(3, "montee_sur_scene", 8),
      at(1, "cfp_et_pitch", 2),
      at(2, "cfp_et_pitch", 1),
      at(4, "montee_sur_scene", 6),
    ]);
    expect(groupes.map((g) => g.phase)).toEqual(["cfp_et_pitch", "montee_sur_scene"]);
    expect(groupes[0].ateliers.map((a) => a.id)).toEqual([2, 1]);
    expect(groupes[1].ateliers.map((a) => a.id)).toEqual([4, 3]);
  });

  it("les deux phases sont toujours rendues, même vides (le parcours a deux temps)", () => {
    const groupes = ordonnerParPhase([at(1, "cfp_et_pitch", 1)]);
    expect(groupes).toHaveLength(2);
    expect(groupes[1].ateliers).toEqual([]);
  });

  it("un ordre en doublon garde un classement STABLE (par id)", () => {
    const groupes = ordonnerParPhase([
      at(9, "cfp_et_pitch", 1),
      at(4, "cfp_et_pitch", 1),
    ]);
    expect(groupes[0].ateliers.map((a) => a.id)).toEqual([4, 9]);
  });
});

describe("voisinDansLaPhase — monter ou descendre d'un rang", () => {
  const programme = [
    at(10, "cfp_et_pitch", 1),
    at(11, "cfp_et_pitch", 2),
    at(12, "cfp_et_pitch", 3),
    at(20, "montee_sur_scene", 4),
  ];

  it("monter échange avec la séance juste au-dessus, DANS la phase", () => {
    expect(voisinDansLaPhase(programme, 11, "haut")?.id).toBe(10);
    expect(voisinDansLaPhase(programme, 12, "haut")?.id).toBe(11);
  });

  it("descendre échange avec celle juste en dessous", () => {
    expect(voisinDansLaPhase(programme, 10, "bas")?.id).toBe(11);
    expect(voisinDansLaPhase(programme, 11, "bas")?.id).toBe(12);
  });

  /**
   * Aux extrémités, il n'y a rien à échanger — et surtout PAS la séance d'à
   * côté dans l'autre phase. Un « descendre » sur la dernière du CFP ne doit
   * pas la faire glisser dans la préparation à la conférence.
   */
  it("aux extrémités de la phase, aucun voisin (et jamais celui de l'autre phase)", () => {
    expect(voisinDansLaPhase(programme, 10, "haut")).toBeNull();
    expect(voisinDansLaPhase(programme, 12, "bas")).toBeNull();
    expect(voisinDansLaPhase(programme, 20, "haut")).toBeNull();
    expect(voisinDansLaPhase(programme, 20, "bas")).toBeNull();
  });

  it("une séance inconnue n'a pas de voisin", () => {
    expect(voisinDansLaPhase(programme, 999, "haut")).toBeNull();
  });
});
