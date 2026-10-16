import type { SpeakerProfile } from "@/lib/profiles";
import { espaceChecklist } from "@/lib/espace";
import { escapeHtml, nb, salutation } from "@/lib/format";
import { BASE_URL } from "@/constants/site";

/**
 * E-mail de RELANCE d'une fiche restée en brouillon (cf.
 * `docs/conception-relance-brouillons.md`). Fonctions pures, donc testables ;
 * l'envoi réel et le choix des destinataires vivent dans les actions orga.
 *
 * Ce qui fait la différence avec un « pense à ta fiche » générique : l'e-mail
 * énumère LES CHANTIERS QUI RESTENT, tirés d'`espaceChecklist` — la source
 * unique du parcours de publication, déjà affichée sur /mon-espace. Deux listes
 * séparées auraient dérivé dès le premier chantier ajouté à la plateforme.
 */

/**
 * Les chantiers de CONTENU restants (libellés de la checklist), du premier au
 * dernier. « Soumis à l'annuaire » en est exclu : c'est une action (le bouton
 * « Soumettre »), pas un champ à remplir — c'est elle qui choisit la variante
 * d'e-mail, une fois la liste vide.
 */
export function chantiersRestants(
  profile: SpeakerProfile | null,
  talksCount: number,
): string[] {
  return espaceChecklist(profile, talksCount, profile?.name)
    .steps.filter((s) => s.key !== "annuaire" && !s.done)
    .map((s) => s.label);
}

/**
 * L'e-mail lui-même. Deux variantes, parce que les deux situations appellent
 * des gestes différents :
 *   - il reste des chantiers → on les liste, le lien mène à l'espace ;
 *   - tout est rempli → un seul geste reste (soumettre), et c'est le cas le plus
 *     rentable : la fiche est à un clic de l'annuaire.
 */
export function buildRelanceEmail({
  name,
  chantiers,
}: {
  name: string | null;
  chantiers: string[];
}): { subject: string; htmlContent: string } {
  const bonjour = escapeHtml(salutation(name));
  const espaceUrl = `${BASE_URL}/mon-espace`;
  const reglagesUrl = `${BASE_URL}/mon-espace/reglages`;

  // Rappel commun aux deux variantes : la fiche est privée tant qu'elle vit en
  // brouillon. C'est LA question que se pose quelqu'un qui a oublié sa fiche.
  const rassurance = `<p>Ta fiche reste <strong>privée</strong> pour le moment&nbsp;: elle paraîtra
       dans l'annuaire une fois que tu l'auras soumise, et après relecture par l'équipe.</p>`;

  // Pied commun. Il disait « on te réécrira le jour où ta fiche bougera » :
  // une promesse que le code ne tenait pas, puisqu'une fiche restée en sommeil
  // rentre dans le lot suivant. Il dit maintenant ce qui se passe vraiment, et
  // donne le chemin pour le régler — un e-mail qui parle d'un réglage sans
  // mener au réglage ne règle rien.
  const pied = `
    <p style="color:#555;font-size:13px">Tu reçois ce message parce que tu as commencé une fiche
       speakeuse sur Tech Speak'Her, et qu'elle attend depuis un moment. Sans nouvelle de ta part,
       on te réécrira dans quelque temps&nbsp;; tu choisis leur fréquence, ou tu les
       arrêtes&nbsp;:
       <a href="${reglagesUrl}">choisir la fréquence de ces rappels</a>. Les e-mails liés à ton
       compte (lien de connexion, décision sur ta fiche, message reçu) continuent d'arriver.</p>
    <p>L'équipe Tech Speak'Her</p>
  `;

  if (chantiers.length === 0) {
    return {
      subject: "Ta fiche speakeuse est prête à paraître 🎤",
      htmlContent: `
        <p>${bonjour}</p>
        <p>Bonne nouvelle&nbsp;: ta fiche speakeuse Tech Speak'Her est <strong>complète</strong>.
           Il reste un seul geste pour rejoindre l'annuaire&nbsp;: appuyer sur
           <strong>Soumettre</strong> depuis ton espace.</p>
        ${rassurance}
        <p>👉 <a href="${espaceUrl}">Soumettre ma fiche</a></p>
        ${pied}
      `,
    };
  }

  const liste = chantiers.map((c) => `<li>${escapeHtml(c)}</li>`).join("");
  return {
    subject: `Ta fiche speakeuse\u00a0: il reste ${nb(chantiers.length, "étape")} 🎤`,
    htmlContent: `
      <p>${bonjour}</p>
      <p>Tu as commencé ta fiche speakeuse sur Tech Speak'Her, et elle attend encore un peu de toi.
         Voilà ce qu'il reste pour rejoindre l'annuaire&nbsp;:</p>
      <ul>${liste}</ul>
      ${rassurance}
      <p>👉 <a href="${espaceUrl}">Reprendre ma fiche</a></p>
      ${pied}
    `,
  };
}
