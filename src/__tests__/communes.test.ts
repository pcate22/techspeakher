import { describe, it, expect, vi, afterEach } from "vitest";
import { searchCommunes, regionFromContext } from "@/lib/communes";

const feature = (
  name: string,
  postcode: string,
  citycode: string,
  context: string,
) => ({ properties: { name, postcode, citycode, context, type: "municipality" } });

const banResponse = (features: unknown[]) =>
  new Response(JSON.stringify({ features }), { status: 200 });

afterEach(() => vi.restoreAllMocks());

describe("regionFromContext", () => {
  it("prend le dernier segment du context BAN", () => {
    expect(regionFromContext("31, Haute-Garonne, Occitanie")).toBe("Occitanie");
    expect(regionFromContext("75, Paris, Île-de-France")).toBe("Île-de-France");
  });

  it("tolère un context vide ou absent", () => {
    expect(regionFromContext(undefined)).toBe("");
    expect(regionFromContext("")).toBe("");
    expect(regionFromContext(42)).toBe("");
  });
});

describe("searchCommunes", () => {
  it("mappe les features BAN en communes structurées", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        banResponse([feature("Toulouse", "31000", "31555", "31, Haute-Garonne, Occitanie")]),
      ),
    );
    const res = await searchCommunes("toulou");
    expect(res).toEqual([
      { nom: "Toulouse", codePostal: "31000", codeInsee: "31555", region: "Occitanie" },
    ]);
  });

  it("dédoublonne par code INSEE", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        banResponse([
          feature("Paris", "75001", "75056", "75, Paris, Île-de-France"),
          feature("Paris", "75002", "75056", "75, Paris, Île-de-France"),
        ]),
      ),
    );
    const res = await searchCommunes("paris");
    expect(res).toHaveLength(1);
    expect(res[0].region).toBe("Île-de-France");
  });

  it("requête trop courte : aucun appel réseau, []", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await searchCommunes("t")).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it("réponse non-ok : [] (résilient)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    expect(await searchCommunes("paris")).toEqual([]);
  });

  it("erreur réseau : [] (résilient, saisie libre préservée)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    expect(await searchCommunes("paris")).toEqual([]);
  });
});
