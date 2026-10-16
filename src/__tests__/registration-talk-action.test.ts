// @vitest-environment node
import { updateTag } from "next/cache";
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Garde-fous de la Server Action orga qui rattache un talk à une participante
 * depuis sa fiche : identité orga, compte requis (le talk vit sur le profil),
 * et chaîne de rattachement (profil → talk → lien sur l'inscription).
 */

vi.mock("@/lib/auth-guards", () => ({ requireOrgaId: vi.fn(async () => 1) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/tremplin-registrations", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getRegistrationById: vi.fn(),
  setRegistrationTalk: vi.fn(async () => true),
}));
vi.mock("@/lib/talks", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  addTalk: vi.fn(async () => 99),
  updateTalk: vi.fn(async () => {}),
  getTalkById: vi.fn(),
}));
vi.mock("@/lib/profiles", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ensureProfileId: vi.fn(async () => 3),
}));
vi.mock("@/lib/talk-form", () => ({ parseTalkIdentityForm: vi.fn() }));

import { addRegistrationTalkAction, updateRegistrationTalkAction } from "@/app/admin/tremplins/actions";
import { getRegistrationById, setRegistrationTalk } from "@/lib/tremplin-registrations";
import { addTalk, updateTalk, getTalkById } from "@/lib/talks";
import { parseTalkIdentityForm } from "@/lib/talk-form";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

beforeEach(() => vi.clearAllMocks());

describe("addRegistrationTalkAction", () => {
  it("sans compte relié : refuse et ne crée aucun talk", async () => {
    vi.mocked(getRegistrationById).mockResolvedValue({ id: 7, userId: null } as never);
    const res = await addRegistrationTalkAction(
      {},
      fd({ ctxEditionId: "3", registrationId: "7" }),
    );
    expect(res.ok).toBe(false);
    expect(res.errors?.titre).toMatch(/compte/i);
    expect(addTalk).not.toHaveBeenCalled();
    expect(setRegistrationTalk).not.toHaveBeenCalled();
  });

  it("avec compte : crée l'IDENTITÉ du talk (titre/type/résumé, sans conf ni date) sur le profil et le rattache à l'inscription", async () => {
    vi.mocked(getRegistrationById).mockResolvedValue({ id: 7, userId: 42 } as never);
    vi.mocked(parseTalkIdentityForm).mockReturnValue({
      ok: true,
      data: { titre: "Mon sujet", type: "Conférence", description: null },
    } as never);

    await expect(
      addRegistrationTalkAction({}, fd({ ctxEditionId: "3", registrationId: "7" })),
    ).rejects.toThrow(/REDIRECT:\/admin\/tremplins\/3\/participantes\/7\/talk/);

    // L'identité SEULE part en base : les conférences (occurrences) se
    // rattachent ailleurs, aucun champ conf/date n'est requis au formulaire.
    expect(addTalk).toHaveBeenCalledWith(3, {
      titre: "Mon sujet",
      type: "Conférence",
      description: null,
    });
    expect(setRegistrationTalk).toHaveBeenCalledWith(7, 3, 99);
    // Une participante peut être une speakeuse PUBLIÉE : le talk créé peut
    // s'afficher sur sa carte d'annuaire — le cache de données expire.
    expect(vi.mocked(updateTag)).toHaveBeenCalledWith("annuaire");
  });

  it("l'édition du contenu d'un talk pitché expire aussi l'annuaire", async () => {
    // Même raison que la création : le titre édité s'affiche sur la carte
    // d'annuaire d'une participante déjà publiée.
    vi.mocked(getRegistrationById).mockResolvedValue({ id: 7, userId: 42 } as never);
    vi.mocked(getTalkById).mockResolvedValue({ id: 99 } as never);
    vi.mocked(parseTalkIdentityForm).mockReturnValue({
      ok: true,
      data: { titre: "Sujet précisé", type: "Conférence", description: null },
    } as never);
    await expect(
      updateRegistrationTalkAction(
        {},
        fd({ ctxEditionId: "3", registrationId: "7", talkId: "99" }),
      ),
    ).rejects.toThrow(/REDIRECT:/);
    expect(updateTalk).toHaveBeenCalledWith(99, 3, {
      titre: "Sujet précisé",
      type: "Conférence",
      description: null,
    });
    expect(vi.mocked(updateTag)).toHaveBeenCalledWith("annuaire");
  });

  it("édition invalide : refuse", async () => {
    const res = await addRegistrationTalkAction({}, fd({ ctxEditionId: "0", registrationId: "7" }));
    expect(res.ok).toBe(false);
    expect(getRegistrationById).not.toHaveBeenCalled();
  });
});
