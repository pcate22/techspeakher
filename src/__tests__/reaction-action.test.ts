import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Les garde-fous de `reactionAction` (lot N4) : entrées en listes fermées,
 * réponse UNIFORME sur tout refus (zéro oracle des brouillons), rate-limit
 * sur la pose (large sur le retrait — il reste toujours possible pour une
 * humaine), et JAMAIS un throw vers le client : une base indisponible ou une
 * table absente (preview sans la migration 063) devient l'état d'erreur.
 */

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/auth-guards", () => ({
  requireUserId: vi.fn(async () => 7),
  requireOrgaId: vi.fn(async () => 1),
  getSession: vi.fn(async () => ({ user: { id: "7" } })),
}));
vi.mock("@/lib/reactions", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  poserReaction: vi.fn(async () => true),
  retirerReaction: vi.fn(async () => {}),
}));
vi.mock("@/lib/rate-limit", () => ({ isRateLimited: vi.fn(() => false) }));

import { reactionAction } from "@/app/mon-espace/actions";
import { poserReaction, retirerReaction } from "@/lib/reactions";
import { isRateLimited } from "@/lib/rate-limit";
import { IDLE } from "@/lib/action-state";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(poserReaction).mockResolvedValue(true);
  vi.mocked(isRateLimited).mockReturnValue(false);
});

describe("reactionAction — les garde-fous", () => {
  it("applaudir une cible valide : succès, la lib reçoit la session et la cible", async () => {
    const res = await reactionAction(IDLE, fd({ type: "venue", id: "5", intention: "applaudir" }));
    expect(res).toEqual({ status: "success" });
    expect(poserReaction).toHaveBeenCalledWith(7, { type: "venue", id: 5 });
  });

  it("retirer : succès, sans borne de visibilité (la lib est bornée à user_id)", async () => {
    const res = await reactionAction(IDLE, fd({ type: "scene", id: "9", intention: "retirer" }));
    expect(res).toEqual({ status: "success" });
    expect(retirerReaction).toHaveBeenCalledWith(7, { type: "scene", id: 9 });
  });

  it("type inconnu, id invalide, intention inconnue : MÊME refus, mot pour mot (zéro oracle)", async () => {
    const refus = [
      await reactionAction(IDLE, fd({ type: "fiche", id: "5", intention: "applaudir" })),
      await reactionAction(IDLE, fd({ type: "venue", id: "-2", intention: "applaudir" })),
      await reactionAction(IDLE, fd({ type: "venue", id: "abc", intention: "applaudir" })),
      await reactionAction(IDLE, fd({ type: "venue", id: "5", intention: "aimer" })),
    ];
    for (const r of refus) expect(r).toEqual(refus[0]);
    expect(refus[0].status).toBe("error");
    expect(poserReaction).not.toHaveBeenCalled();
    expect(retirerReaction).not.toHaveBeenCalled();
  });

  it("cible refusée par la lib (invisible, inexistante ou sienne) : le MÊME message que l'entrée invalide", async () => {
    vi.mocked(poserReaction).mockResolvedValue(false);
    const refusLib = await reactionAction(IDLE, fd({ type: "venue", id: "5", intention: "applaudir" }));
    const refusEntree = await reactionAction(IDLE, fd({ type: "fiche", id: "5", intention: "applaudir" }));
    expect(refusLib).toEqual(refusEntree);
  });

  it("la pose est bornée en débit ; le retrait a sa propre borne, LARGE", async () => {
    vi.mocked(isRateLimited).mockReturnValue(true);
    const pose = await reactionAction(IDLE, fd({ type: "venue", id: "5", intention: "applaudir" }));
    expect(pose.status).toBe("error");
    expect(poserReaction).not.toHaveBeenCalled();
    // Les deux branches ont chacune leur clé (le retrait reste servi à part).
    const cles = vi.mocked(isRateLimited).mock.calls.map((c) => String(c[0]));
    await reactionAction(IDLE, fd({ type: "venue", id: "5", intention: "retirer" }));
    const clesApres = vi.mocked(isRateLimited).mock.calls.map((c) => String(c[0]));
    expect(clesApres.length).toBeGreaterThan(cles.length);
    expect(clesApres.at(-1)).not.toBe(cles[0]);
  });

  it("base indisponible ou table absente : l'échec SE DIT (état d'erreur), jamais un throw vers la page", async () => {
    vi.mocked(poserReaction).mockRejectedValue(
      Object.assign(new Error('relation "fil_reactions" does not exist'), { code: "42P01" }),
    );
    const res = await reactionAction(IDLE, fd({ type: "venue", id: "5", intention: "applaudir" }));
    expect(res.status).toBe("error");
    vi.mocked(retirerReaction).mockRejectedValue(new Error("connexion coupée"));
    const res2 = await reactionAction(IDLE, fd({ type: "venue", id: "5", intention: "retirer" }));
    expect(res2.status).toBe("error");
  });
});
