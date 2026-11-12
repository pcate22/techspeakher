import type { SpeakerProfile } from "@/lib/profiles";

export interface Complement {
  cle: string;
  label: string;
  href: string;
}

const rempli = (v: string | null | undefined): boolean => Boolean(v?.trim());

const MANQUES_IDENTITE: { cle: string; mot: string; label: string; manque: (p: SpeakerProfile) => boolean }[] = [
  { cle: "photo", mot: "photo", label: "Ajoute une photo", manque: (p) => !rempli(p.image) },
  { cle: "ville", mot: "ville", label: "Indique ta ville", manque: (p) => !rempli(p.ville) },
  {
    cle: "presentation",
    mot: "présentation",
    label: "Écris ta présentation",
    manque: (p) => !rempli(p.bio),
  },
];

/**
 * Photo, ville et présentation s'éditent sur le même écran : dès deux manques,
 * une seule ligne les nomme, plutôt que plusieurs liens vers la même page.
 */
function identite(profile: SpeakerProfile): Complement[] {
  const href = "/mon-espace/fiche/identite";
  const manques = MANQUES_IDENTITE.filter((m) => m.manque(profile));
  if (manques.length === 0) return [];
  if (manques.length === 1) return [{ cle: manques[0].cle, label: manques[0].label, href }];
  return [
    {
      cle: "identite",
      label: `Complète ton identité (${manques.map((m) => m.mot).join(", ")})`,
      href,
    },
  ];
}

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
    ...identite(profile),
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
