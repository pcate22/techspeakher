// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * LE CACHE DE DONNÉES DE L'ANNUAIRE (dette P1 « cacher la donnée, pas la
 * page »). La page /speakeuses reste `force-dynamic` — leçon du 2026-07-23 :
 * un vide de panne s'était figé dans le cache de PAGE — c'est la LECTURE qui
 * se met en cache, taguée, invalidée par les écritures.
 *
 * Le point dur, et ce que ce banc garde : un ÉCHEC ne se mémorise jamais. La
 * fonction cachée JETTE en panne (unstable_cache ne mémorise pas un rejet) et
 * la page dégrade hors cache — noindex + drapeau, comme avant.
 */

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn(
    (fn: (...a: unknown[]) => unknown) =>
      (...a: unknown[]) =>
        fn(...a),
  ),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));
vi.mock("@/lib/profiles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/profiles")>();
  return { ...actual, getPublishedAnnuaire: vi.fn(async () => []) };
});
vi.mock("@/lib/talks", () => ({
  getPublicTalkTextByProfile: vi.fn(async () => new Map()),
  getPublicTalkTitlesByProfile: vi.fn(async () => new Map()),
}));

import { unstable_cache, updateTag } from "next/cache";
import { getPublishedAnnuaire } from "@/lib/profiles";
import { generateMetadata } from "@/app/speakeuses/page";
import { TAG_ANNUAIRE, invaliderAnnuaire } from "@/lib/annuaire-cache";

beforeEach(() => {
  vi.mocked(getPublishedAnnuaire).mockReset();
});

describe("la lecture de l'annuaire : cachée, taguée, et une panne reste hors cache", () => {
  it("déclare le tag partagé et un filet de revalidation périodique", () => {
    // Posé au chargement du module de la page : c'est le CONTRAT du cache.
    // Le filet (5 min) borne le coût d'une invalidation oubliée par une
    // écriture future ; le tag est la voie nominale.
    expect(vi.mocked(unstable_cache)).toHaveBeenCalledWith(
      expect.any(Function),
      expect.anything(),
      expect.objectContaining({ tags: [TAG_ANNUAIRE], revalidate: 300 }),
    );
  });

  it("une panne JETTE dans la fonction cachée : rien à mémoriser", async () => {
    const fnCachee = vi.mocked(unstable_cache).mock.calls[0][0];
    vi.mocked(getPublishedAnnuaire).mockImplementationOnce(() =>
      Promise.reject(new Error("Neon dort")),
    );
    await expect(fnCachee()).rejects.toThrow();
  });

  it("la page dégrade quand même, hors cache : noindex + drapeau", async () => {
    vi.mocked(getPublishedAnnuaire).mockImplementationOnce(() =>
      Promise.reject(new Error("Neon dort")),
    );
    const meta = await generateMetadata();
    expect(meta.robots).toMatchObject({ index: false, follow: true });
  });
});

describe("invaliderAnnuaire — LE geste des écritures qui changent l'annuaire", () => {
  it("expire le tag partagé IMMÉDIATEMENT (updateTag, pas du stale-while-revalidate)", () => {
    // Une fiche masquée ou retirée (RGPD) ne doit pas être servie « stale
    // pendant que ça rafraîchit » : read-your-own-writes.
    invaliderAnnuaire();
    expect(vi.mocked(updateTag)).toHaveBeenCalledWith(TAG_ANNUAIRE);
  });
});
