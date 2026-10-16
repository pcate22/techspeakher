import { BASE_URL } from "@/constants/site";
import { salutation } from "@/lib/format";

/**
 * Le RAPPEL de mise à jour des fiches publiées (cron du soir, à la fréquence
 * que chacune règle). Sorti de la route du cron pour que ses règles de
 * rédaction se testent avec les autres e-mails (`emails-redaction.test.ts`).
 */
export function buildRappelFicheEmail(): { subject: string; htmlContent: string } {
  return {
    subject: "Tech Speak'Her\u00a0: pense à mettre à jour ton profil 🎤",
    htmlContent: `
      <p>${salutation(null)}</p>
      <p>Petit rappel amical&nbsp;: pense à mettre à jour ton profil speakeuse et à
      ajouter tes <strong>prochaines dates de talk</strong> sur Tech Speak'Her.</p>
      <p><a href="${BASE_URL}/mon-espace">Mettre à jour mon espace</a></p>
      <p style="color:#666;font-size:13px">Tu reçois ce message car ta fiche est publiée dans
      l'annuaire. Tu choisis leur fréquence, ou tu les arrêtes&nbsp;:
      <a href="${BASE_URL}/mon-espace/reglages">choisir la fréquence de ces rappels</a>.</p>
    `,
  };
}
