import { describe, it, expect, vi, beforeEach } from "vitest";
import { resoudreEvenementsNotist, viderCacheNotist } from "@/lib/notist-evenements";

/**
 * Le résolveur des fiches d'événements Notist : l'export d'un profil ne NOMME
 * pas les conférences, il pointe des fiches (`noti.st/events/<id>.json`) qui
 * portent titre, lieu et fenêtre de dates (vérifié par l'éclaireur du 16/08 :
 * « WeAreDevelopers Europe 2026 », Berlin, DE, 8-10 juillet).
 *
 * Contrat : hôte FIGÉ noti.st (rien d'autre n'est jamais consulté), une fiche
 * ratée est une fiche absente du résultat (jamais fatale au lot), et le nom
 * du pays s'écrit en français depuis le code région (DE → Allemagne).
 */

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function ficheNotist(titre: string, options: Partial<{ address: string; country_code: string; starts_on: string; ends_on: string }> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: [
        {
          type: "events",
          attributes: {
            title: titre,
            address: options.address ?? "Berlin, Germany",
            country_code: options.country_code ?? "DE",
            starts_on: options.starts_on ?? "2026-07-08 08:00:00",
            ends_on: options.ends_on ?? "2026-07-10 18:00:00",
          },
        },
      ],
    }),
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  viderCacheNotist();
});

describe("resoudreEvenementsNotist", () => {
  it("résout titre, ville, pays (en français) et fenêtre de dates", async () => {
    fetchMock.mockResolvedValue(ficheNotist("WeAreDevelopers Europe 2026"));
    const r = await resoudreEvenementsNotist(["4bUppk"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://noti.st/events/4bUppk.json",
      expect.anything(),
    );
    expect(r.get("4bUppk")).toEqual({
      titre: "WeAreDevelopers Europe 2026",
      ville: "Berlin",
      pays: "Allemagne",
      dateDebut: "2026-07-08",
      dateFin: "2026-07-10",
    });
  });

  it("chaque id n'est consulté qu'UNE fois, même répété (178 scènes, 154 événements)", async () => {
    fetchMock.mockResolvedValue(ficheNotist("Riviera Dev"));
    await resoudreEvenementsNotist(["KYlYA5", "KYlYA5", "KYlYA5"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("une fiche en échec (500, réseau) est ABSENTE du résultat, jamais fatale", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockRejectedValueOnce(new Error("réseau"))
      .mockResolvedValueOnce(ficheNotist("Riviera Dev", { address: "Valbonne, France", country_code: "FR" }));
    const r = await resoudreEvenementsNotist(["aaaa11", "bbbb22", "cccc33"]);
    expect(r.size).toBe(1);
    expect(r.get("cccc33")).toMatchObject({ titre: "Riviera Dev", ville: "Valbonne", pays: "France" });
  });

  it("un id hors format est refusé sans requête (l'hôte reste noti.st, toujours)", async () => {
    const r = await resoudreEvenementsNotist(["../../x", "https://evil.example", ""]);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(r.size).toBe(0);
  });

  it("la fiche accepte les DEUX formes JSON:API (data en tableau OU ressource seule)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: { type: "events", attributes: { title: "Conf Ressource Seule" } },
      }),
    });
    const r = await resoudreEvenementsNotist(["dddd44"]);
    expect(r.get("dddd44")).toMatchObject({ titre: "Conf Ressource Seule" });
  });

  it("mémoire courte : un second lot retrouve la fiche SANS re-consulter noti.st", async () => {
    fetchMock.mockResolvedValue(ficheNotist("Riviera Dev"));
    await resoudreEvenementsNotist(["KYlYA5"]);
    const r2 = await resoudreEvenementsNotist(["KYlYA5"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r2.get("KYlYA5")).toMatchObject({ titre: "Riviera Dev" });
  });

  it("budget de temps épuisé : plus AUCUNE fiche amorcée (l'import survit, en date seule)", async () => {
    fetchMock.mockResolvedValue(ficheNotist("Conf"));
    const r = await resoudreEvenementsNotist(["eeee55"], 0);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(r.size).toBe(0);
  });

  it("plafond du lot : au-delà de 200 événements, les suivants sont laissés de côté", async () => {
    fetchMock.mockResolvedValue(ficheNotist("Conf"));
    const beaucoup = Array.from({ length: 250 }, (_, i) => `id${String(i).padStart(4, "0")}`);
    await resoudreEvenementsNotist(beaucoup);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(200);
  });
});
