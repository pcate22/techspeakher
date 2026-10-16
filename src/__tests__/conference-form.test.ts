import { describe, it, expect } from "vitest";
import {
  parseConferenceForm,
  parseEditionForm,
  parseMemberEditionForm,
  ENDPOINT_REGEX,
} from "@/lib/conference-form";
import { fd } from "./test-helpers";

describe("ENDPOINT_REGEX (la vraie défense anti-SSRF : format strict)", () => {
  it("accepte un id d'endpoint Sessionize (alphanumérique 6-32)", () => {
    expect(ENDPOINT_REGEX.test("abc123def")).toBe(true);
    expect(ENDPOINT_REGEX.test("A1B2C3")).toBe(true);
  });
  it("rejette URL, slug à tirets, chemins et injections", () => {
    for (const bad of [
      "https://sessionize.com/api/v2/x/view/All",
      "devfest-toulouse-2026",
      "../../etc/passwd",
      "abc 123",
      "abc123def%2F",
      "x".repeat(33),
      "court",
      "",
    ]) {
      expect(ENDPOINT_REGEX.test(bad), bad).toBe(false);
    }
  });
});

describe("parseConferenceForm", () => {
  it("valide une conférence complète", () => {
    const r = parseConferenceForm(
      fd({ nom: "DevFest Toulouse", type: "conference", ville: "Toulouse", pays: "France", siteUrl: "https://devfesttoulouse.fr" }),
    );
    expect(r).toEqual({
      ok: true,
      data: {
        nom: "DevFest Toulouse",
        type: "conference",
        ville: "Toulouse",
        pays: "France",
        siteUrl: "https://devfesttoulouse.fr",
      },
    });
  });

  it("refuse un nom vide et une URL invalide", () => {
    const r = parseConferenceForm(fd({ nom: " ", type: "asso", siteUrl: "javascript:x" }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.nom).toBeTruthy();
      expect(r.errors.siteUrl).toBeTruthy();
    }
  });

  it("refuse un nom sans caractère alphanumérique (slug vide → conf inatteignable)", () => {
    // 2+ caractères (passe min(2)) mais aucun [a-z0-9] → slugifyConference = "".
    const r = parseConferenceForm(fd({ nom: "!! ??", type: "conference" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.nom).toBeTruthy();
  });
});

describe("parseEditionForm", () => {
  it("valide une édition avec endpoint et date", () => {
    const r = parseEditionForm(
      fd({ conferenceId: "3", annee: "2026", dateDebut: "2026-11-19", ville: "", lieu: "", url: "", endpoint: "abc123def" }),
    );
    expect(r).toMatchObject({
      ok: true,
      data: { conferenceId: 3, annee: 2026, dateDebut: "2026-11-19", endpoint: "abc123def" },
    });
  });

  it("champs vides → null (édition connue sans moisson)", () => {
    const r = parseEditionForm(fd({ conferenceId: "3", annee: "", dateDebut: "", endpoint: "" }));
    expect(r).toMatchObject({ ok: true, data: { annee: null, dateDebut: null, endpoint: null } });
  });

  it("refuse un endpoint au mauvais format, une année et une date invalides", () => {
    const r = parseEditionForm(
      fd({ conferenceId: "3", annee: "203", dateDebut: "19/11/2026", endpoint: "devfest-toulouse" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.annee).toBeTruthy();
      expect(r.errors.dateDebut).toBeTruthy();
      expect(r.errors.endpoint).toBeTruthy();
    }
  });

  it("accepte l'adresse https de la page programme (l'action en détecte l'id)", () => {
    // Les ids sont introuvables à la main : l'orga colle la page programme,
    // le détecteur (garde SSRF) extrait l'id côté action, avant tout test.
    const r = parseEditionForm(
      fd({ conferenceId: "3", annee: "2026", endpoint: "https://devfesttoulouse.fr/programme" }),
    );
    expect(r).toMatchObject({
      ok: true,
      data: { endpoint: "https://devfesttoulouse.fr/programme" },
    });
  });

  it("refuse une adresse en http : le détecteur travaille en https seul", () => {
    const r = parseEditionForm(
      fd({ conferenceId: "3", annee: "2026", endpoint: "http://devfesttoulouse.fr/programme" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.endpoint).toBeTruthy();
  });

  // La date de FIN dit si l'événement couvre plusieurs jours : c'est elle qui
  // décide ce qu'une édition lègue à la date d'un talk (dateLegueeParEdition).
  it("accepte une date de fin (événement sur plusieurs jours)", () => {
    const r = parseEditionForm(
      fd({ conferenceId: "3", annee: "2026", dateDebut: "2026-11-19", dateFin: "2026-11-21", endpoint: "" }),
    );
    expect(r).toMatchObject({
      ok: true,
      data: { dateDebut: "2026-11-19", dateFin: "2026-11-21" },
    });
  });

  it("refuse une fin qui précède le début", () => {
    const r = parseEditionForm(
      fd({ conferenceId: "3", annee: "2026", dateDebut: "2026-11-19", dateFin: "2026-11-18", endpoint: "" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.dateFin).toBeTruthy();
  });

  it("refuse une fin sans début (la fenêtre a besoin de ses deux bords)", () => {
    const r = parseEditionForm(
      fd({ conferenceId: "3", annee: "2026", dateDebut: "", dateFin: "2026-11-21", endpoint: "" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.dateFin).toBeTruthy();
  });
});

describe("parseMemberEditionForm (« Ta conf n'y est pas ? »)", () => {
  it("valide un ajout minimal (nom seul) comme un ajout complet", () => {
    expect(parseMemberEditionForm(fd({ nomConference: "Sunny Tech" }))).toMatchObject({
      ok: true,
      data: { nomConference: "Sunny Tech", annee: null, endpoint: null },
    });
    expect(
      parseMemberEditionForm(
        fd({ nomConference: "Sunny Tech", annee: "2026", ville: "Montpellier", url: "https://sunny-tech.io", endpoint: "abc123def" }),
      ),
    ).toMatchObject({ ok: true, data: { annee: 2026, endpoint: "abc123def" } });
  });

  it("refuse un endpoint qui ressemble à une URL", () => {
    const r = parseMemberEditionForm(
      fd({ nomConference: "Sunny Tech", endpoint: "https://sessionize.com/x" }),
    );
    expect(r.ok).toBe(false);
  });
});
