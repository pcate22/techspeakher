import { describe, it, expect } from "vitest";
import {
  parseTalkIdentityForm,
  parseOccurrenceForm,
  DESCRIPTION_MAX,
} from "@/lib/talk-form";
import { fd } from "./test-helpers";

// ─── Identité du talk (titre, type, résumé) ───

describe("parseTalkIdentityForm", () => {
  it("valide une identité complète (titre, type, description)", () => {
    const res = parseTalkIdentityForm(
      fd({
        titre: "L'IA à l'épreuve du monde physique",
        type: "Meetup",
        description: "Un retour d'expérience.",
      }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.titre).toBe("L'IA à l'épreuve du monde physique");
      expect(res.data.type).toBe("Meetup");
      expect(res.data.description).toBe("Un retour d'expérience.");
    }
  });

  it("exige un titre", () => {
    const res = parseTalkIdentityForm(fd({ titre: "  ", type: "Meetup" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.titre).toBeTruthy();
  });

  // Le champ de saisie est multi-ligne (titre lisible en entier) : un collage
  // depuis un CFP peut donc arriver avec des retours à la ligne. Un titre reste
  // UNE ligne, en base comme à l'affichage.
  it("aplatit un titre collé sur plusieurs lignes", () => {
    const res = parseTalkIdentityForm(
      fd({ titre: "Votre IA s'en sort moins bien\n  que vos utilisateurs\n", type: "Meetup" }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.titre).toBe(
        "Votre IA s'en sort moins bien que vos utilisateurs",
      );
    }
  });

  // La typographie française du titre est de la DONNÉE : un aplatissement de
  // tous les blancs (`\s+`) mangeait les espaces insécables avant « : ! ? ; ».
  it("garde les espaces insécables du titre (typographie française)", () => {
    const res = parseTalkIdentityForm(
      fd({ titre: "L'IA : quel socle ?", type: "Meetup" }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.titre).toBe("L'IA : quel socle ?");
  });

  it("type inconnu → 'Conférence' par défaut", () => {
    const res = parseTalkIdentityForm(
      fd({ titre: "T", type: "n'importe quoi" }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.type).toBe("Conférence");
  });

  it("garde le type « Sujet proposé » (sujet pas encore donné, sans conférence)", () => {
    const res = parseTalkIdentityForm(
      fd({ titre: "Parler d'accessibilité", type: "Sujet proposé" }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.type).toBe("Sujet proposé");
  });

  it("rejette une description trop longue", () => {
    const res = parseTalkIdentityForm(
      fd({
        titre: "T",
        type: "Conférence",
        description: "x".repeat(DESCRIPTION_MAX + 1),
      }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.description).toBeTruthy();
  });
});

// ─── Occurrence (une conférence rattachée à un talk) ───

describe("parseOccurrenceForm", () => {
  it("valide une occurrence complète (conf/ville/pays, date, liens)", () => {
    const res = parseOccurrenceForm(
      fd({
        conference: "DevFest",
        ville: "Toulouse",
        pays: "France",
        annee: "2026",
        mois: "11",
        jour: "19",
        lienConf: "https://conf.example/x",
        lienSlides: "https://slides.example/x",
      }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.conference).toBe("DevFest");
      expect(res.data.date).toBe("2026-11-19");
      expect(res.data.lienConf).toBe("https://conf.example/x");
      expect(res.data.lienVideo).toBeNull();
    }
  });

  it("rejette un lien invalide", () => {
    const res = parseOccurrenceForm(
      fd({ annee: "2026", lienSlides: "pas-une-url" }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.lienSlides).toBeTruthy();
  });

  it("accepte année seule / mois+année / jour+mois+année", () => {
    const cas: [Record<string, string>, string][] = [
      [{ annee: "2026" }, "2026"],
      [{ annee: "2026", mois: "11" }, "2026-11"],
      [{ annee: "2026", mois: "11", jour: "19" }, "2026-11-19"],
    ];
    for (const [parts, attendu] of cas) {
      const res = parseOccurrenceForm(fd(parts));
      expect(res.ok, attendu).toBe(true);
      if (res.ok) expect(res.data.date).toBe(attendu);
    }
  });

  it("refuse un jour sans mois", () => {
    const res = parseOccurrenceForm(fd({ annee: "2026", jour: "19" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.date).toBeTruthy();
  });

  it("année vide → date null, sans erreur (occurrence pas encore datée)", () => {
    const res = parseOccurrenceForm(fd({ conference: "DevFest" }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.date).toBeNull();
  });
});

describe("parseOccurrenceForm — un jour ou un mois sans année", () => {
  // Depuis le 2026-10-15, l'année cesse d'être exigée quand une édition est
  // choisie (le serveur reprend sa date). Un jour ou un mois tapé SANS année
  // était alors jeté sans un mot : on le dit (revue justesse rejouée).
  it("mois sans année : une erreur sur la date, rien d'ignoré en silence", () => {
    const res = parseOccurrenceForm(fd({ annee: "", mois: "7", jour: "3" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.date).toBe("Choisis aussi l'année.");
  });

  it("ni jour, ni mois, ni année : pas de date, et aucune erreur", () => {
    const res = parseOccurrenceForm(fd({ annee: "", mois: "", jour: "", conference: "DevFest" }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.date).toBeNull();
  });
});

describe("parseOccurrenceForm — conferenceId / editionId (lien vers le registre)", () => {
  const base = { annee: "2026", mois: "", jour: "" };

  it("relaye conferenceId et editionId entiers positifs (revalidés ensuite côté action)", () => {
    const r = parseOccurrenceForm(
      fd({ ...base, conferenceId: "7", editionId: "42" }),
    );
    expect(r).toMatchObject({
      ok: true,
      data: { conferenceId: 7, editionId: 42 },
    });
  });

  it("ignore une valeur douteuse (vide, texte, négatif, décimal) → null, jamais d'erreur", () => {
    for (const v of ["", "abc", "-3", "3.5"]) {
      const r = parseOccurrenceForm(fd({ ...base, conferenceId: v, editionId: v }));
      expect(r).toMatchObject({
        ok: true,
        data: { conferenceId: null, editionId: null },
      });
    }
  });
});

/**
 * Conférence hors registre (migration 068) : le nom saisi remplace le choix au
 * registre, il en subit donc les mêmes exigences — sans quoi une conférence
 * inatteignable (slug vide) entrerait au répertoire à la validation.
 */
describe("parseOccurrenceForm — conférence proposée hors registre", () => {
  const base = { conference: "", ville: "Lille", pays: "France", annee: "2025" };

  it("nom valide → relayé à l'action, sans lien au registre", () => {
    const r = parseOccurrenceForm(fd({ ...base, conferenceProposee: " Cloud Nord " }));
    expect(r).toMatchObject({
      ok: true,
      conferenceProposee: "Cloud Nord",
      data: { conferenceId: null, editionId: null },
    });
  });

  it("champ vide → rien de proposé (l'action tranchera), jamais d'erreur ici", () => {
    const r = parseOccurrenceForm(fd({ ...base, conferenceProposee: "" }));
    expect(r).toMatchObject({ ok: true, conferenceProposee: null });
  });

  it("champ rempli d'ESPACES → erreur SUR CE CHAMP (le `required` HTML le laisse passer)", () => {
    const r = parseOccurrenceForm(fd({ ...base, conferenceProposee: "   " }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.conferenceProposee).toBeTruthy();
  });

  it("nom sans lettre ni chiffre → refusé (son slug serait vide, conf inatteignable)", () => {
    const r = parseOccurrenceForm(fd({ ...base, conferenceProposee: "«»" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.conferenceProposee).toBeTruthy();
  });

  it("nom trop long → refusé (borne du répertoire)", () => {
    const r = parseOccurrenceForm(fd({ ...base, conferenceProposee: "A".repeat(161) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.conferenceProposee).toBeTruthy();
  });

  it("une conférence du registre choisie l'emporte : le nom résiduel est ignoré", () => {
    const r = parseOccurrenceForm(
      fd({ ...base, conferenceId: "7", conferenceProposee: "Cloud Nord" }),
    );
    expect(r).toMatchObject({
      ok: true,
      conferenceProposee: null,
      data: { conferenceId: 7 },
    });
  });
});
