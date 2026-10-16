// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/newsletter", () => ({ desabonnerParEmail: vi.fn() }));

import { desabonnerParEmail } from "@/lib/newsletter";
import { POST } from "@/app/api/brevo/desabonnement/route";

/** Requête webhook telle que Brevo l'envoie (jeton en paramètre d'URL). */
function requete(corps: unknown, token = "secret-test"): Request {
  return new Request(`https://techspeakher.fr/api/brevo/desabonnement?token=${token}`, {
    method: "POST",
    body: JSON.stringify(corps),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BREVO_WEBHOOK_SECRET", "secret-test");
  vi.mocked(desabonnerParEmail).mockResolvedValue(1);
});

describe("webhook de désabonnement Brevo", () => {
  it("refuse sans jeton valide, sans rien écrire", async () => {
    const reponse = await POST(requete({ event: "unsubscribed", email: "a@ex.fr" }, "faux"));

    expect(reponse.status).toBe(401);
    expect(desabonnerParEmail).not.toHaveBeenCalled();
  });

  it("refuse quand aucun secret n'est configuré (fermé par défaut)", async () => {
    vi.stubEnv("BREVO_WEBHOOK_SECRET", "");

    const reponse = await POST(requete({ event: "unsubscribed", email: "a@ex.fr" }));

    expect(reponse.status).toBe(401);
    expect(desabonnerParEmail).not.toHaveBeenCalled();
  });

  it("désabonne sur « unsubscribed »", async () => {
    const reponse = await POST(requete({ event: "unsubscribed", email: "a@ex.fr" }));

    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ traite: true });
    expect(desabonnerParEmail).toHaveBeenCalledWith("a@ex.fr");
  });

  it("désabonne aussi sur une plainte pour spam", async () => {
    await POST(requete({ event: "spam", email: "a@ex.fr" }));
    expect(desabonnerParEmail).toHaveBeenCalledWith("a@ex.fr");
  });

  it("ignore les autres événements, sans faire rejouer le webhook", async () => {
    const reponse = await POST(requete({ event: "delivered", email: "a@ex.fr" }));

    // 200 : une erreur ferait revenir Brevo en boucle pour un événement
    // qui ne nous concerne pas.
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ traite: false });
    expect(desabonnerParEmail).not.toHaveBeenCalled();
  });

  it("tient un corps illisible", async () => {
    const reponse = await POST(
      new Request("https://techspeakher.fr/api/brevo/desabonnement?token=secret-test", {
        method: "POST",
        body: "pas du json",
      }),
    );

    expect(reponse.status).toBe(400);
    expect(desabonnerParEmail).not.toHaveBeenCalled();
  });
});
