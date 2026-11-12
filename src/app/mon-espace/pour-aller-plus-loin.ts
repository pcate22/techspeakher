import type { SpeakerProfile } from "@/lib/profiles";

export interface Complement {
  cle: string;
  label: string;
  href: string;
}

const rempli = (v: string | null | undefined): boolean => Boolean(v?.trim());

/**
 * Ce qui reste à ajouter à une fiche, dans l'ordre de « Pour aller plus loin ».
 * Seuls les manques s'affichent : une ligne déjà faite serait une tâche
 * fantôme. Une fiche sans thème (son seul sujet était « Autre », retiré) passe
 * les thèmes en tête : c'est ce qui la rend trouvable.
 */
export function pourAllerPlusLoin(profile: SpeakerProfile, talksCount: number): Complement[] {
  const lignes: (Complement | false)[] = [
    profile.sujets.length === 0 && {
      cle: "themes",
      label: "Choisis tes thèmes",
      href: "/mon-espace/fiche/sujets",
    },
    talksCount === 0 && { cle: "talk", label: "Ajoute un talk", href: "/mon-espace/talks/nouveau" },
    !rempli(profile.image) && {
      cle: "photo",
      label: "Ajoute une photo",
      href: "/mon-espace/fiche/identite",
    },
    !rempli(profile.ville) && {
      cle: "ville",
      label: "Indique ta ville",
      href: "/mon-espace/fiche/identite",
    },
    !rempli(profile.bio) && {
      cle: "presentation",
      label: "Écris ta présentation",
      href: "/mon-espace/fiche/identite",
    },
    profile.secteurs.length === 0 && {
      cle: "secteurs",
      label: "Choisis tes secteurs",
      href: "/mon-espace/fiche/secteurs",
    },
    !rempli(profile.linkedin) &&
      !rempli(profile.website) &&
      !rempli(profile.instagram) && {
        cle: "liens",
        label: "Ajoute tes liens",
        href: "/mon-espace/fiche/contact",
      },
  ];
  return lignes.filter((l): l is Complement => l !== false);
}
