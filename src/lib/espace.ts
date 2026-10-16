import type { SpeakerProfile } from "@/lib/profiles";

export type ChecklistStep = {
  key: "nom" | "profil" | "talks" | "contact" | "attestation" | "annuaire";
  label: string;
  hint?: string;
  done: boolean;
  /**
   * Deep-link vers le formulaire qui remplit cette étape. C'est LA source unique
   * du lien : la ligne cliquable de la checklist ET le CTA du hero pointent tous
   * deux ici, donc « l'étape mise en avant » et « le bouton d'action » ne peuvent
   * plus diverger (bug : le CTA contact ouvrait l'étape 0 au lieu de contact).
   * « Soumis à l'annuaire » n'en a pas : c'est une action (soumettre), pas un champ.
   */
  href?: string;
};

export type EspaceProgress = {
  steps: ChecklistStep[];
  percent: number;
};

/**
 * Avancement de l'espace speakeuse : étapes pour figurer dans l'annuaire.
 * Sert au tableau de bord guidé (checklist + barre de progression).
 */
export function espaceChecklist(
  profile: SpeakerProfile | null,
  talksCount: number,
  /**
   * Nom du COMPTE (`users.name`). Indispensable en paramètre : sans fiche,
   * `profile` est `null` et son `name` avec — on aurait invité à saisir un nom
   * déjà fourni par Google ou LinkedIn. Omis → on retombe sur celui de la fiche.
   */
  nomCompte?: string | null,
): EspaceProgress {
  const nom = nomCompte ?? profile?.name ?? null;
  const steps: ChecklistStep[] = [
    {
      // Le nom du COMPTE (users.name, joint par getProfileByUserId) : sans lui,
      // `SpeakeuseCard` retombe sur «\u00a0Speakeuse\u00a0» et la fiche s'afficherait
      // anonyme dans un annuaire de personnes. La cohorte lien-magique arrive
      // sans nom (la connexion ne demande que l'e-mail).
      key: "nom",
      label: "Prénom et nom",
      hint: "Le nom affiché sur ta fiche, et celui qu'on utilise pour t'écrire",
      href: "/mon-espace/fiche/identite",
      done: Boolean(nom?.trim()),
    },
    {
      key: "profil",
      label: "Profil rempli",
      hint: "Titre, bio, secteurs & sujets, localisation, langues",
      href: "/mon-espace/fiche/identite",
      done: Boolean(
        profile &&
          (profile.titreProfil ||
            profile.bio ||
            profile.secteurs.length ||
            profile.sujets.length),
      ),
    },
    {
      key: "talks",
      label: "Un talk ou une proposition de sujet",
      hint: "Même un sujet que tu aimerais présenter compte, on t'aide à te lancer",
      href: "/mon-espace/talks/nouveau",
      done: talksCount > 0,
    },
    {
      key: "contact",
      label: "Moyen de contact",
      hint: "LinkedIn ou contact par e-mail, requis pour l'annuaire",
      href: "/mon-espace/fiche/contact",
      done: Boolean(profile?.linkedin || profile?.contactEmailOk),
    },
    {
      key: "attestation",
      label: "Attestation",
      hint: "Être une femme ou une personne non binaire, requis pour l'annuaire",
      href: "/mon-espace/fiche/attestation",
      done: Boolean(profile?.isWoman),
    },
    {
      key: "annuaire",
      label: "Soumis à l'annuaire",
      // `en_pause` aussi : la fiche a été soumise et validée, elle attend
      // seulement l'adhésion. La dire « à soumettre » inviterait à un geste
      // inutile (revue du 2026-10-15).
      done:
        profile?.status === "en_attente" ||
        profile?.status === "publie" ||
        profile?.status === "en_pause",
    },
  ];
  // Le pourcentage mesure le CONTENU du formulaire ; « Soumis à l'annuaire »
  // est une action (elle reste dans la checklist, pas dans le %) — sinon une
  // fiche complète affichait 80 %, illisible.
  const contenu = steps.filter((s) => s.key !== "annuaire");
  const done = contenu.filter((s) => s.done).length;
  return { steps, percent: Math.round((done / contenu.length) * 100) };
}
