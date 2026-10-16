import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import {
  requireUserId,
  requireOrgaId,
  requireOrgaPage,
  requireCoachId,
  requireOrgaJson,
  requireUserJson,
} from "@/lib/auth-guards";

beforeEach(() => vi.clearAllMocks());

describe("requireUserId", () => {
  it("renvoie l'id (number) de la session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    expect(await requireUserId()).toBe(7);
  });
  it("sans session → /connexion", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(requireUserId()).rejects.toThrow("REDIRECT:/connexion");
  });
});

describe("requireOrgaId", () => {
  it("renvoie l'id si orga", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", isOrga: true } } as never);
    expect(await requireOrgaId()).toBe(3);
  });
  it("non-orga → /connexion", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", isOrga: false } } as never);
    await expect(requireOrgaId()).rejects.toThrow("REDIRECT:/connexion");
  });
  it("sans session → /connexion", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(requireOrgaId()).rejects.toThrow("REDIRECT:/connexion");
  });
});

describe("requireOrgaPage (garde de PAGE : la non-orga rejoint SON espace)", () => {
  it("orga : laisse passer", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", isOrga: true } } as never);
    await expect(requireOrgaPage()).resolves.toBeUndefined();
  });
  it("membre connectée NON orga → /mon-espace (pas de reboucle sur la connexion)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", isOrga: false } } as never);
    await expect(requireOrgaPage()).rejects.toThrow("REDIRECT:/mon-espace");
  });
  it("sans session → /connexion", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(requireOrgaPage()).rejects.toThrow("REDIRECT:/connexion");
  });
});

describe("requireUserJson (garde de ROUTE API membre : réponse JSON, jamais de redirect)", () => {
  it("renvoie l'id (number) de la session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    expect(await requireUserJson()).toBe(7);
  });
  it("sans session → 401 JSON (jamais de redirect)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await requireUserJson();
    expect(res).not.toBe(7);
    expect((res as Response).status).toBe(401);
  });
});

describe("requireOrgaJson (garde de ROUTE API : réponse JSON, jamais de redirect)", () => {
  it("orga : laisse passer (null)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", isOrga: true } } as never);
    expect(await requireOrgaJson()).toBeNull();
  });
  it("membre connectée non-orga → 403 JSON", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", isOrga: false } } as never);
    const res = await requireOrgaJson();
    expect(res?.status).toBe(403);
  });
  it("sans session → 401 JSON (jamais de redirect, un fetch ne la suivrait pas)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await requireOrgaJson();
    expect(res?.status).toBe(401);
  });
});

describe("requireCoachId", () => {
  it("renvoie l'id si animateur/coach", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "5", isCoach: true } } as never);
    expect(await requireCoachId()).toBe(5);
  });
  it("membre sans profil coach → /connexion", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "5", isCoach: false } } as never);
    await expect(requireCoachId()).rejects.toThrow("REDIRECT:/connexion");
  });
  it("une orga SANS profil coach n'entre pas (rôles distincts, cumulables)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "5", isOrga: true } } as never);
    await expect(requireCoachId()).rejects.toThrow("REDIRECT:/connexion");
  });
  it("sans session → /connexion", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(requireCoachId()).rejects.toThrow("REDIRECT:/connexion");
  });
});
