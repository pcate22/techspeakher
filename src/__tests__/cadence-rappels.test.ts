import { describe, it, expect } from "vitest";
import {
  CADENCES,
  CADENCE_CHOIX,
  cadenceValide,
  seuilsCadence,
  type CadenceRappel,
} from "@/lib/cadence-rappels";

/**
 * La cadence de rappel choisie par la speakeuse. Brique PURE : elle ne connaît
 * que les deux e-mails qui POUSSENT (rappel de mise à jour, relance de
 * brouillon). Les e-mails qui annoncent un fait (connexion, modération, message
 * reçu) ne passent pas par ici, et c'est toute la promesse du réglage.
 */

describe("CADENCES — les choix offerts", () => {
  it("propose quatre choix, du plus fréquent au plus rare, puis « Aucun »", () => {
    expect(CADENCE_CHOIX).toEqual(["mensuel", "bimestriel", "semestriel", "aucun"]);
  });

  it("nomme chaque choix en clair, sans jargon ni forme négative", () => {
    for (const choix of CADENCE_CHOIX) {
      const label = CADENCES[choix].label;
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toMatch(/\bn(?:e\b|['’])[^.]{0,40}\b(?:pas|plus)\b/i);
      expect(label).not.toContain("—");
    }
    expect(CADENCES.mensuel.label).toBe("Tous les mois");
    expect(CADENCES.aucun.label).toBe("Aucun");
  });

  it("traduit chaque choix en jours, « Aucun » restant sans durée", () => {
    expect(CADENCES.mensuel.jours).toBe(30);
    expect(CADENCES.bimestriel.jours).toBe(60);
    expect(CADENCES.semestriel.jours).toBe(180);
    // `null` et pas 0 : un 0 jour se lirait « tout le temps », l'exact inverse.
    expect(CADENCES.aucun.jours).toBeNull();
  });
});

describe("cadenceValide — ce qui vient du navigateur", () => {
  it("accepte les quatre choix connus", () => {
    for (const choix of CADENCE_CHOIX) expect(cadenceValide(choix)).toBe(choix);
  });

  it("rend null pour « défaut de l'équipe » et pour tout le reste", () => {
    // Le champ vide EST un choix : « laisse l'équipe décider ».
    expect(cadenceValide("")).toBeNull();
    expect(cadenceValide("defaut")).toBeNull();
    expect(cadenceValide("hebdomadaire")).toBeNull();
    expect(cadenceValide(null)).toBeNull();
    expect(cadenceValide(undefined)).toBeNull();
    // Pas de clé de prototype prise pour un choix valide.
    expect(cadenceValide("toString")).toBeNull();
  });
});

describe("seuilsCadence — les instants passés au SQL", () => {
  const MAINTENANT = Date.parse("2026-08-15T12:00:00Z");
  const jours = (d: Date) => Math.round((MAINTENANT - d.getTime()) / 86_400_000);

  it("rend un instant par cadence, plus celui du défaut de l'équipe", () => {
    const s = seuilsCadence(180, MAINTENANT);
    expect(jours(s.mensuel)).toBe(30);
    expect(jours(s.bimestriel)).toBe(60);
    expect(jours(s.semestriel)).toBe(180);
    expect(jours(s.defaut)).toBe(180);
  });

  it("suit le délai de l'équipe, différent d'un flux à l'autre", () => {
    // 30 pour la relance de brouillon, 180 pour le rappel semestriel : le
    // défaut de CHAQUE flux reste sa valeur d'aujourd'hui, donc rien ne bouge
    // pour celles qui n'ont rien choisi.
    expect(jours(seuilsCadence(30, MAINTENANT).defaut)).toBe(30);
  });

  it("se range dans l'ordre attendu par les requêtes ($1 à $4)", () => {
    const s = seuilsCadence(180, MAINTENANT);
    expect(s.params).toEqual([s.mensuel, s.bimestriel, s.semestriel, s.defaut]);
  });

  it("laisse « Aucun » hors des seuils : il se traite par exclusion", () => {
    const s = seuilsCadence(180, MAINTENANT) as Record<string, unknown>;
    expect(s.aucun).toBeUndefined();
  });
});

describe("le réglage ne porte QUE les rappels", () => {
  it("l'énumération des cadences ne connaît aucun e-mail de compte", () => {
    // Garde de sens : si un jour quelqu'un ajoute ici « connexion » ou
    // « modération », c'est que la frontière du réglage a bougé — et la
    // promesse faite à la speakeuse avec.
    const clefs: CadenceRappel[] = [...CADENCE_CHOIX];
    for (const interdit of ["connexion", "moderation", "message", "newsletter"]) {
      expect(clefs).not.toContain(interdit as CadenceRappel);
    }
  });
});
