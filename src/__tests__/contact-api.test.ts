import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../app/api/contact/route";

// Mock Brevo — doit être une classe (constructeur)
const mockSendTransacEmail = vi.fn().mockResolvedValue({});
vi.mock("@getbrevo/brevo", () => ({
  BrevoClient: class {
    transactionalEmails = { sendTransacEmail: mockSendTransacEmail };
  },
}));

// Compteur pour IPs uniques par test (évite le rate limiting croisé)
let ipCounter = 0;
function uniqueIp() {
  ipCounter++;
  return `test-${ipCounter}.0.0.1`;
}

function makeRequest(body: Record<string, unknown>, ip?: string): Request {
  return new Request("http://localhost:3000/api/contact", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip ?? uniqueIp(),
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  name: "Marie Dupont",
  email: "marie@example.com",
  subject: "general",
  message: "Bonjour, je voudrais en savoir plus sur Tech Speak'Her.",
};

describe("API /api/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BREVO_API_KEY = "test-key-123";
  });

  // --- Validation : nom ---

  it("rejette si le nom est manquant", async () => {
    const res = await POST(makeRequest({ ...validBody, name: "" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("nom");
  });

  it("rejette si le nom dépasse 200 caractères", async () => {
    const res = await POST(makeRequest({ ...validBody, name: "A".repeat(201) }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("200");
  });

  it("rejette si le nom est uniquement des espaces", async () => {
    const res = await POST(makeRequest({ ...validBody, name: "   " }));
    expect(res.status).toBe(400);
  });

  // --- Validation : email ---

  it("rejette si l'email est manquant", async () => {
    const res = await POST(makeRequest({ ...validBody, email: "" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("e-mail");
  });

  it("rejette un email mal formaté", async () => {
    const res = await POST(makeRequest({ ...validBody, email: "pas-un-email" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("e-mail");
  });

  it("rejette un email sans domaine", async () => {
    const res = await POST(makeRequest({ ...validBody, email: "user@" }));
    expect(res.status).toBe(400);
  });

  it("rejette un email avec espaces", async () => {
    const res = await POST(makeRequest({ ...validBody, email: "user @example.com" }));
    expect(res.status).toBe(400);
  });

  it("rejette un email trop long (> 254 caractères)", async () => {
    const longEmail = "a".repeat(250) + "@b.fr";
    const res = await POST(makeRequest({ ...validBody, email: longEmail }));
    expect(res.status).toBe(400);
  });

  // --- Validation : sujet ---

  it("rejette un sujet inconnu", async () => {
    const res = await POST(makeRequest({ ...validBody, subject: "piratage" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Sujet");
  });

  it("rejette si le sujet est absent", async () => {
    const { subject: _, ...noSubject } = validBody;
    const res = await POST(makeRequest(noSubject));
    expect(res.status).toBe(400);
  });

  it("rejette un sujet vide", async () => {
    const res = await POST(makeRequest({ ...validBody, subject: "" }));
    expect(res.status).toBe(400);
  });

  // --- Validation : message ---

  it("rejette si le message est vide", async () => {
    const res = await POST(makeRequest({ ...validBody, message: "   " }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("message");
  });

  it("rejette un message de plus de 2000 caractères", async () => {
    const res = await POST(makeRequest({ ...validBody, message: "x".repeat(2001) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("2\u00A0000");
  });

  // --- Body invalide ---

  it("rejette un body non-JSON", async () => {
    const req = new Request("http://localhost:3000/api/contact", {
      method: "POST",
      headers: { "content-type": "text/plain", "x-forwarded-for": uniqueIp() },
      body: "ceci n'est pas du json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("invalide");
  });

  // --- Sujets valides ---

  it.each(["general", "tremplin", "speakeuse", "partenariat", "rejoindre"])(
    "accepte le sujet « %s »",
    async (subject) => {
      const res = await POST(makeRequest({ ...validBody, subject }));
      expect(res.status).toBe(200);
      expect((await res.json()).success).toBe(true);
    },
  );

  // --- Envoi Brevo ---

  it("appelle Brevo avec les bons paramètres", async () => {
    await POST(makeRequest(validBody));

    expect(mockSendTransacEmail).toHaveBeenCalledOnce();
    const call = mockSendTransacEmail.mock.calls[0][0];
    expect(call.sender.email).toBe("contact@techspeakher.fr");
    expect(call.to[0].email).toBe("techspeakher@gmail.com");
    expect(call.replyTo.email).toBe("marie@example.com");
    expect(call.replyTo.name).toBe("Marie Dupont");
    expect(call.subject).toContain("[Tech Speak'Her]");
    expect(call.subject).toContain("Marie Dupont");
    expect(call.subject).toContain("Question générale");
    expect(call.textContent).toContain("marie@example.com");
    expect(call.textContent).toContain(validBody.message);
  });

  it("trim les champs avant envoi", async () => {
    await POST(
      makeRequest({
        ...validBody,
        name: "  Marie  ",
        email: "marie@example.com",
        message: "  Bonjour  ",
      }),
    );

    expect(mockSendTransacEmail).toHaveBeenCalledOnce();
    const call = mockSendTransacEmail.mock.calls[0][0];
    expect(call.replyTo.name).toBe("Marie");
    expect(call.replyTo.email).toBe("marie@example.com");
    expect(call.textContent).toContain("Nom : Marie");
    expect(call.textContent).toMatch(/Bonjour$/);
  });

  // --- Erreur Brevo ---

  it("renvoie 500 si Brevo échoue", async () => {
    mockSendTransacEmail.mockRejectedValueOnce(new Error("Brevo down"));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("Réessayez");
  });

  // --- Rate limiting ---

  it("bloque après 5 requêtes de la même IP", async () => {
    const ip = "rate-limit-test-block";

    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest(validBody, ip));
      expect(res.status).toBe(200);
    }

    // La 6e est bloquée
    const res = await POST(makeRequest(validBody, ip));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toContain("Trop de messages");
  });

  it("ne bloque pas une IP différente", async () => {
    const ipA = "rate-limit-ip-a";
    const ipB = "rate-limit-ip-b";

    // Saturer l'IP A
    for (let i = 0; i < 6; i++) {
      await POST(makeRequest(validBody, ipA));
    }

    // L'IP B passe toujours
    const res = await POST(makeRequest(validBody, ipB));
    expect(res.status).toBe(200);
  });

  it("utilise 'unknown' si x-forwarded-for est absent", async () => {
    const req = new Request("http://localhost:3000/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  // --- Anti-démarchage ---
  //
  // Un message écarté reçoit la MÊME réponse qu'un message envoyé (200) : rien
  // dans la réponse n'apprend à un démarcheur ce qui l'a fait tomber. La preuve
  // du filtrage, c'est l'absence d'appel à Brevo.

  describe("anti-démarchage", () => {
    it("écarte un envoi où le piège à robots est rempli", async () => {
      const res = await POST(makeRequest({ ...validBody, website: "https://spam.example" }));
      expect(res.status).toBe(200);
      expect((await res.json()).success).toBe(true);
      expect(mockSendTransacEmail).not.toHaveBeenCalled();
    });

    it("laisse passer un piège à robots vide", async () => {
      const res = await POST(makeRequest({ ...validBody, website: "" }));
      expect(res.status).toBe(200);
      expect(mockSendTransacEmail).toHaveBeenCalledOnce();
    });

    it("écarte un message de démarchage commercial", async () => {
      const res = await POST(
        makeRequest({
          ...validBody,
          name: "SellExpertSellExpert",
          message:
            "Notre agence de prospection externalisée vous propose des rendez-vous qualifiés à partir de 990 €/mois, sans engagement.",
        }),
      );
      expect(res.status).toBe(200);
      expect(mockSendTransacEmail).not.toHaveBeenCalled();
    });

    it("écarte un formulaire rempli en moins de deux secondes", async () => {
      const res = await POST(makeRequest({ ...validBody, ouvertA: Date.now() }));
      expect(res.status).toBe(200);
      expect(mockSendTransacEmail).not.toHaveBeenCalled();
    });

    it("laisse passer un formulaire rempli à vitesse humaine", async () => {
      const res = await POST(makeRequest({ ...validBody, ouvertA: Date.now() - 30_000 }));
      expect(res.status).toBe(200);
      expect(mockSendTransacEmail).toHaveBeenCalledOnce();
    });

    it("laisse passer une horloge cliente en avance sur celle du serveur", async () => {
      // L'écart devient négatif : la mesure est ininterprétable, la visiteuse
      // passe (l'écarter reviendrait à punir un réglage d'horloge).
      const res = await POST(makeRequest({ ...validBody, ouvertA: Date.now() + 3_600_000 }));
      expect(res.status).toBe(200);
      expect(mockSendTransacEmail).toHaveBeenCalledOnce();
    });

    it("laisse passer une horodatage d'ouverture absent ou incohérent", async () => {
      const res = await POST(makeRequest({ ...validBody, ouvertA: "hier" }));
      expect(res.status).toBe(200);
      expect(mockSendTransacEmail).toHaveBeenCalledOnce();
    });

    it("laisse passer une demande légitime qui parle d'argent", async () => {
      const res = await POST(
        makeRequest({
          ...validBody,
          subject: "partenariat",
          message:
            "Bonjour, notre entreprise souhaite sponsoriser votre prochaine soirée Tremplin : nous pouvons prêter une salle et financer le buffet.",
        }),
      );
      expect(res.status).toBe(200);
      expect(mockSendTransacEmail).toHaveBeenCalledOnce();
    });
  });

  // --- Cloudflare Turnstile ---
  //
  // Inactif par défaut (aucune clé dans l'environnement de test) : tous les cas
  // ci-dessus valent pour le site tant que la clé n'est pas posée dans Vercel.

  describe("vérification anti-robot", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it("refuse un envoi sans jeton quand la vérification est armée", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-de-test");
      const res = await POST(makeRequest(validBody));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("anti-robot");
      expect(mockSendTransacEmail).not.toHaveBeenCalled();
    });

    it("envoie le message quand Cloudflare valide le jeton", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-de-test");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        }),
      );
      const res = await POST(makeRequest({ ...validBody, turnstile: "bon-jeton" }));
      expect(res.status).toBe(200);
      expect(mockSendTransacEmail).toHaveBeenCalledOnce();
    });

    it("refuse un jeton rejeté par Cloudflare", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-de-test");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: false, "error-codes": ["invalid-input-response"] }),
        }),
      );
      const res = await POST(makeRequest({ ...validBody, turnstile: "jeton-rejoué" }));
      expect(res.status).toBe(400);
      expect(mockSendTransacEmail).not.toHaveBeenCalled();
    });

    it("envoie quand même si Cloudflare est injoignable (échec ouvert)", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-de-test");
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("réseau coupé")));
      const res = await POST(makeRequest({ ...validBody, turnstile: "bon-jeton" }));
      expect(res.status).toBe(200);
      expect(mockSendTransacEmail).toHaveBeenCalledOnce();
    });

    it("écarte le démarchage avant même d'appeler Cloudflare", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-de-test");
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const res = await POST(
        makeRequest({ ...validBody, website: "https://spam.example", turnstile: "jeton" }),
      );
      expect(res.status).toBe(200);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(mockSendTransacEmail).not.toHaveBeenCalled();
    });
  });

  it("prend la première IP si x-forwarded-for contient plusieurs valeurs", async () => {
    const req = new Request("http://localhost:3000/api/contact", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `${uniqueIp()}, 5.6.7.8`,
      },
      body: JSON.stringify(validBody),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
