import { BASE_URL } from "@/constants/site";
import { salutation } from "@/lib/format";

export type ModerationDecision = "publie" | "refuse";

/**
 * Construit l'e-mail envoyé à la speakeuse après une décision de modération.
 * Fonction pure (testable) : l'envoi réel passe par sendBrevoEmail, gardé par
 * la présence de BREVO_API_KEY.
 */
export function buildModerationEmail({
  decision,
  name,
  motif,
  profileId,
  slug,
}: {
  decision: ModerationDecision;
  name: string | null;
  motif?: string | null;
  profileId: number;
  /** Slug d'URL si la fiche en a un : donne un lien lisible dans l'e-mail
   *  (repli sur l'id sinon, qui redirige vers le slug côté site). */
  slug?: string | null;
}): { subject: string; textContent: string } {
  const bonjour = salutation(name);
  const ficheUrl = `${BASE_URL}/speakeuses/${slug ?? profileId}`;
  const espaceUrl = `${BASE_URL}/mon-espace`;

  if (decision === "publie") {
    return {
      subject: "Ta fiche Tech Speak'Her est en ligne 🎉",
      textContent: [
        bonjour,
        "",
        "Bonne nouvelle : ta fiche speakeuse est validée et publiée dans l'annuaire Tech Speak'Her.",
        "",
        `Tu peux la consulter ici : ${ficheUrl}`,
        `Tu peux la modifier à tout moment depuis ton espace : ${espaceUrl}`,
        "",
        "À bientôt,",
        "L'équipe Tech Speak'Her",
      ].join("\n"),
    };
  }

  return {
    subject: "Ta fiche Tech Speak'Her, quelques ajustements",
    textContent: [
      bonjour,
      "",
      "Merci d'avoir soumis ta fiche speakeuse. Avant de la publier, on aurait besoin de quelques ajustements\u00a0:",
      "",
      motif?.trim() ? motif.trim() : "(aucun détail précisé)",
      "",
      `Tu peux mettre à jour ta fiche puis la soumettre à nouveau depuis ton espace\u00a0: ${espaceUrl}`,
      "",
      "À bientôt,",
      "L'équipe Tech Speak'Her",
    ].join("\n"),
  };
}
