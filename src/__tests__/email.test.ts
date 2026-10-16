import { describe, it, expect, vi, beforeEach } from "vitest";

// On simule le client Brevo pour capturer l'objet envoyé, sans appel réseau.
const sendTransacEmail = vi.fn();
vi.mock("@/lib/brevo-client", () => ({
  brevoClient: () => ({ transactionalEmails: { sendTransacEmail } }),
}));

import { sendBrevoEmail } from "@/lib/email";
import { EMAIL_SENDER } from "@/constants/site";

beforeEach(() => sendTransacEmail.mockReset());

describe("sendBrevoEmail", () => {
  it("expéditeur = domaine validé, destinataire nommé", async () => {
    await sendBrevoEmail({ to: "a@b.fr", toName: "Ada", subject: "Coucou" });
    const payload = sendTransacEmail.mock.calls[0][0];
    expect(payload.sender).toEqual({ email: EMAIL_SENDER, name: "Tech Speak'Her" });
    expect(payload.to).toEqual([{ email: "a@b.fr", name: "Ada" }]);
    expect(payload.subject).toBe("Coucou");
  });

  it("mappe replyTo (chaîne) en objet {email, name} — cœur du relais de contact", async () => {
    await sendBrevoEmail({
      to: "orga@tsh.fr",
      subject: "Message",
      replyTo: "speakeuse@exemple.fr",
      replyToName: "Marie",
    });
    const payload = sendTransacEmail.mock.calls[0][0];
    // Sans ce mapping, l'orga ne peut pas répondre à la speakeuse (adresse
    // masquée) : c'est la garantie fonctionnelle du relais.
    expect(payload.replyTo).toEqual({ email: "speakeuse@exemple.fr", name: "Marie" });
  });

  it("omet replyTo quand il n'est pas fourni (pas de clé vide)", async () => {
    await sendBrevoEmail({ to: "a@b.fr", subject: "S", htmlContent: "<p>x</p>" });
    const payload = sendTransacEmail.mock.calls[0][0];
    expect("replyTo" in payload).toBe(false);
  });

  it("n'inclut htmlContent / textContent que s'ils sont fournis", async () => {
    await sendBrevoEmail({ to: "a@b.fr", subject: "S", textContent: "brut" });
    const payload = sendTransacEmail.mock.calls[0][0];
    expect(payload.textContent).toBe("brut");
    expect("htmlContent" in payload).toBe(false);
  });

  it("propage l'erreur Brevo (pas d'échec silencieux)", async () => {
    sendTransacEmail.mockRejectedValueOnce(new Error("Brevo 401"));
    await expect(
      sendBrevoEmail({ to: "a@b.fr", subject: "S" }),
    ).rejects.toThrow(/Brevo 401/);
  });
});
