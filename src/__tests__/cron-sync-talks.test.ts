import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/cfp-sync", () => ({ syncCfpEvents: vi.fn() }));
vi.mock("@/lib/meetup-sync", () => ({ syncTechHubMeetups: vi.fn() }));
vi.mock("@/lib/cron-auth", () => ({ isAuthorizedCron: vi.fn() }));

import { revalidateTag } from "next/cache";
import { syncCfpEvents } from "@/lib/cfp-sync";
import { syncTechHubMeetups } from "@/lib/meetup-sync";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { GET } from "@/app/api/cron/sync-talks/route";

function req(): Request {
  return new Request("http://localhost/api/cron/sync-talks", {
    headers: { authorization: "Bearer secret" },
  });
}

const CFP_ZERO = { events: 0, suggestions: 0, majs: 0, erreurs: 0, notifs: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(syncTechHubMeetups).mockResolvedValue({ meetups: 0, erreurs: 0 });
});

describe("cron /api/cron/sync-talks", () => {
  it("refuse sans autorisation (401), sans moissonner ni synchroniser", async () => {
    vi.mocked(isAuthorizedCron).mockReturnValue(false);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(syncCfpEvents).not.toHaveBeenCalled();
    expect(syncTechHubMeetups).not.toHaveBeenCalled();
  });

  it("moissonne, synchronise les meetups et retourne les compteurs fusionnés", async () => {
    vi.mocked(isAuthorizedCron).mockReturnValue(true);
    vi.mocked(syncCfpEvents).mockResolvedValue({
      events: 2,
      suggestions: 3,
      majs: 1,
      erreurs: 0,
      notifs: 3,
    });
    vi.mocked(syncTechHubMeetups).mockResolvedValue({ meetups: 5, erreurs: 0 });

    const res = await GET(req());
    expect(res.status).toBe(200);
    // La moisson peut réécrire des titres de talks affichés sur les cartes :
    // l'annuaire expire en différé (cron = route handler, updateTag interdit).
    expect(revalidateTag).toHaveBeenCalledWith("annuaire", "max");
    expect(await res.json()).toEqual({
      events: 2,
      suggestions: 3,
      majs: 1,
      erreurs: 0,
      notifs: 3,
      meetups: 5,
    });
  });

  it("les meetups sont synchronisés MÊME sans événement CFP actif (pas de court-circuit)", async () => {
    vi.mocked(isAuthorizedCron).mockReturnValue(true);
    vi.mocked(syncCfpEvents).mockResolvedValue(CFP_ZERO);
    vi.mocked(syncTechHubMeetups).mockResolvedValue({ meetups: 4, erreurs: 0 });

    const res = await GET(req());
    expect(syncTechHubMeetups).toHaveBeenCalledTimes(1);
    expect(await res.json()).toMatchObject({ meetups: 4 });
  });

  it("répond 207 si au moins un événement a échoué (observable sans lire les logs)", async () => {
    vi.mocked(isAuthorizedCron).mockReturnValue(true);
    vi.mocked(syncCfpEvents).mockResolvedValue({ ...CFP_ZERO, events: 2, erreurs: 1 });

    const res = await GET(req());
    expect(res.status).toBe(207);
  });

  it("répond 207 si la sync des meetups a échoué (erreurs fusionnées)", async () => {
    vi.mocked(isAuthorizedCron).mockReturnValue(true);
    vi.mocked(syncCfpEvents).mockResolvedValue(CFP_ZERO);
    vi.mocked(syncTechHubMeetups).mockResolvedValue({ meetups: 0, erreurs: 1 });

    const res = await GET(req());
    expect(res.status).toBe(207);
    expect(await res.json()).toMatchObject({ erreurs: 1 });
  });

  it("un crash de la sync meetups ne fait pas échouer la moisson (compté en erreur)", async () => {
    vi.mocked(isAuthorizedCron).mockReturnValue(true);
    vi.mocked(syncCfpEvents).mockResolvedValue({ ...CFP_ZERO, suggestions: 2 });
    vi.mocked(syncTechHubMeetups).mockRejectedValue(new Error("boom"));

    const res = await GET(req());
    expect(res.status).toBe(207);
    expect(await res.json()).toMatchObject({ suggestions: 2, meetups: 0, erreurs: 1 });
  });
});
