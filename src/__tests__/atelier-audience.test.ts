import { describe, it, expect } from "vitest";
import {
  AUDIENCES_ATELIER,
  DEFAULT_AUDIENCE,
  audienceParCle,
  libelleAudience,
  aideAudience,
  programmePublicParDefaut,
  PROGRAMME_PUBLIC_AIDE,
} from "@/lib/atelier-audience";
import { atelierVisiblePour, canViewEditionSpace } from "@/lib/tremplin-guards";
import type { Registration } from "@/lib/tremplin-registrations";
import type { MembershipPhase } from "@/lib/tremplin-registration-phases";

/**
 * QUI voit un atelier — UNE question, UNE réponse.
 *
 * Avant : deux interrupteurs indépendants, « ouvert à toutes » d'un côté et une
 * liste nominative de l'autre. Le plus permissif gagnait EN SILENCE — on
 * activait les participantes d'une phase sur un atelier ouvert à toutes, elles
 * s'ajoutaient bien, et rien ne changeait pour personne. C'est le bug que ce
 * fichier interdit de revenir.
 *
 * Désormais l'audience est un CHOIX EXCLUSIF, et la liste nominative n'est plus
 * qu'un des trois choix possibles. Les membres redeviennent ce qu'ils auraient
 * dû rester : le registre des PRÉSENCES.
 */

const inscription = (id = 5): Registration => ({ id, editionId: 2 }) as Registration;
const phases = (...p: MembershipPhase[]) => new Set(p);

const voit = (o: Partial<Parameters<typeof atelierVisiblePour>[0]> = {}) =>
  atelierVisiblePour({
    audience: "toutes",
    phase: "cfp_et_pitch",
    membres: [],
    registration: inscription(),
    phasesDeLInscrite: phases("cfp_et_pitch"),
    isOrga: false,
    ...o,
  });

describe("Le registre des audiences", () => {
  it("trois choix, et le plus fermé par défaut", () => {
    expect(AUDIENCES_ATELIER.map((a) => a.cle)).toEqual(["selection", "phase", "toutes"]);
    expect(DEFAULT_AUDIENCE).toBe("selection");
  });

  it("une clé inventée ne devient jamais une audience", () => {
    for (const brut of ["constructor", "__proto__", "", undefined, "TOUTES"]) {
      expect(audienceParCle(brut), String(brut)).toBeNull();
    }
    expect(audienceParCle("phase")).toBe("phase");
  });

  /**
   * « Les participantes de sa phase » ne dit rien tout seul : le libellé NOMME
   * la phase. Et il la nomme avec les mots de l'inscription (« Préparation à la
   * conférence »), pas avec le repère de la liste d'ateliers (« Après la
   * soirée ») — ici on parle de personnes, pas de calendrier.
   */
  it("l'audience « phase » nomme la phase concernée, en toutes lettres", () => {
    expect(libelleAudience("phase", "montee_sur_scene")).toMatch(
      /préparation à la conférence/i,
    );
    expect(libelleAudience("phase", "cfp_et_pitch")).toMatch(/préparation au CFP/i);
  });

  it("les deux autres libellés se suffisent à eux-mêmes", () => {
    expect(libelleAudience("toutes", "cfp_et_pitch")).toMatch(/toutes les inscrites/i);
    expect(libelleAudience("selection", "cfp_et_pitch")).toMatch(/sélection/i);
  });

  it("chaque audience s'explique, à la forme positive", () => {
    for (const a of AUDIENCES_ATELIER) {
      const aide = aideAudience(a.cle, "montee_sur_scene");
      expect(aide.length, a.cle).toBeGreaterThan(15);
      expect(aide, a.cle).not.toMatch(/\bne\b|\bpas\b/i);
    }
  });
});

describe("atelierVisiblePour — le choix décide, et lui seul", () => {
  it("« toutes » : chaque inscrite le voit", () => {
    expect(voit({ audience: "toutes" })).toBe(true);
  });

  it("« phase » : seules les participantes de CETTE phase", () => {
    expect(
      voit({
        audience: "phase",
        phase: "montee_sur_scene",
        phasesDeLInscrite: phases("montee_sur_scene"),
      }),
    ).toBe(true);
    expect(
      voit({
        audience: "phase",
        phase: "montee_sur_scene",
        phasesDeLInscrite: phases("cfp_et_pitch"),
      }),
    ).toBe(false);
  });

  it("« sélection » : seules les inscrites nommées", () => {
    expect(voit({ audience: "selection", membres: [5] })).toBe(true);
    expect(voit({ audience: "selection", membres: [404] })).toBe(false);
  });

  /**
   * LE bug d'origine, verrouillé : une inscrite hors sélection ne voit plus
   * l'atelier parce qu'il traînait un « ouvert à toutes » oublié. Le choix est
   * exclusif — il n'y a plus de « en plus ».
   */
  it("une liste nominative n'ouvre RIEN au-delà d'elle-même", () => {
    expect(voit({ audience: "selection", membres: [404], registration: inscription(5) })).toBe(
      false,
    );
  });

  it("et un membre pointé présent n'élargit pas une audience de phase", () => {
    // La ligne de présence existe (elle a été pointée), mais l'inscrite n'est
    // pas de la phase : elle ne voit pas l'atelier pour autant.
    expect(
      voit({
        audience: "phase",
        phase: "montee_sur_scene",
        membres: [5],
        phasesDeLInscrite: phases("cfp_et_pitch"),
      }),
    ).toBe(false);
  });

  it("hors inscription, on ne voit rien — quelle que soit l'audience", () => {
    for (const audience of ["toutes", "phase", "selection"] as const) {
      expect(voit({ audience, registration: null, membres: [5] }), audience).toBe(false);
    }
  });

  it("l'orga voit tout (prévisualisation)", () => {
    for (const audience of ["toutes", "phase", "selection"] as const) {
      expect(voit({ audience, registration: null, isOrga: true }), audience).toBe(true);
    }
  });

  /**
   * Repli NON exposant : sans appartenance de phase connue (migration 025 pas
   * jouée), une audience de phase ne s'ouvre à personne plutôt qu'à tout le
   * monde.
   */
  it("appartenance de phase inconnue : l'atelier de phase reste fermé", () => {
    expect(voit({ audience: "phase", phasesDeLInscrite: undefined })).toBe(false);
  });

  it("canViewEditionSpace reste la garde d'entrée de l'espace", () => {
    expect(canViewEditionSpace(null, false)).toBe(false);
    expect(canViewEditionSpace(null, true)).toBe(true);
    expect(canViewEditionSpace(inscription(), false)).toBe(true);
  });
});

describe("La visibilité sur le site public", () => {
  /**
   * Elle était DÉDUITE de l'audience ; elle est désormais COCHÉE (migration 056).
   * Il ne reste ici qu'un DÉFAUT de création : une séance qui vise une cohorte
   * fait partie du parcours qu'on raconte, une sélection nominative naît
   * réservée. La suite appartient à l'orga, et la colonne fait foi.
   *
   * L'histoire, pour qui relit : la publication a d'abord dépendu du NOMBRE de
   * participantes désignées — pointer une présence publiait la séance, avec son
   * lieu. La 051 a répondu en fusionnant publication et audience. Ce que cette
   * fusion corrigeait n'était pas « deux réglages » mais un réglage INVISIBLE :
   * d'où la 056, qui en refait deux, dont un écrit en toutes lettres.
   */
  it("le défaut de création suit l'audience : cohorte visible, sélection réservée", () => {
    expect(programmePublicParDefaut("toutes")).toBe(true);
    expect(programmePublicParDefaut("phase")).toBe(true);
    expect(programmePublicParDefaut("selection")).toBe(false);
  });

  /**
   * L'aide d'audience ne parle plus QUE de qui voit la séance dans son espace.
   * Tant qu'elle annonçait aussi la conséquence publique, l'orga croyait avoir
   * réglé la vitrine en réglant l'audience — c'est ce couplage qu'on défait.
   */
  it("l'aide d'audience répond à « qui voit », et à rien d'autre", () => {
    for (const { cle } of AUDIENCES_ATELIER) {
      expect(aideAudience(cle, "montee_sur_scene").includes("site public"), cle).toBe(false);
      expect(aideAudience(cle, "montee_sur_scene").includes("programme public"), cle).toBe(false);
    }
  });

  /**
   * Ce que la vitrine annonce se dit CHAMP PAR CHAMP. L'aide disait « titre et
   * dates » alors que la description partait aussi : on pouvait l'écrire en
   * croyant qu'elle restait entre soi. Et elle dit ce qui NE part pas — le lieu —
   * parce que c'est la question de celle qui hésite.
   */
  it("l'aide de publication nomme les champs publiés, et rassure sur le lieu", () => {
    for (const mot of ["nom", "dates", "description"]) {
      expect(PROGRAMME_PUBLIC_AIDE.toLowerCase().includes(mot), mot).toBe(true);
    }
    expect(PROGRAMME_PUBLIC_AIDE.toLowerCase().includes("lieu")).toBe(true);
  });

  /**
   * Forme positive (règle du projet), et UNE phrase vraie dans les deux états :
   * dérivée du prop serveur, elle contredisait l'interrupteur optimiste le temps
   * de l'aller-retour.
   */
  it("l'aide se dit sans négation, et sans dépendre de l'état", () => {
    for (const aide of [PROGRAMME_PUBLIC_AIDE]) {
      // Ancré sur des MOTS entiers : sans `\b`, le « ne » de « une séance »
      // déclenchait une fausse alerte au premier libellé un peu long.
      expect(/\b(ne|n'en|n'y|pas|plus)\b/i.test(aide), aide).toBe(false);
    }
  });
});
