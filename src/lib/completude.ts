import type { SpeakerProfile } from "@/lib/profiles";
import { espaceChecklist } from "@/lib/espace";

/**
 * Complétude de la fiche speakeuse — mécanique UNIQUE, identique à toute étape
 * de la vie de la fiche (nouvelle inscription ou fiche déjà publiée) : une seule
 * liste ordonnée de « chantiers » (un champ ou une action à faire), chacun
 * `fait / à faire` avec un lien direct.
 *
 * Ce qui change d'une personne à l'autre, c'est le NOMBRE de chantiers restants,
 * pas la mécanique :
 * - beaucoup à faire (nouvelle venue) → on REGROUPE par étape du profil ;
 * - peu (fiche publiée qu'on enrichit) → on affiche à plat.
 *
 * Deux natures de chantiers :
 * - REQUIS (`optionnel: false`) : conditionnent la présence dans l'annuaire
 *   (repris tels quels de `espaceChecklist`, source unique du parcours de
 *   publication et du pourcentage) ;
 * - ENRICHISSEMENTS (`optionnel: true`) : facultatifs, ils rendent la fiche plus
 *   trouvable. Masquables (« de façon temporaire »), et de nouveaux apparaissent
 *   au fil des features de la plateforme.
 */

/** Groupe d'un chantier = étape du formulaire de profil (deep-link déjà en place). */
export type GroupeCle =
  | "profil"
  | "domaines"
  | "localisation"
  | "contact"
  | "attestation"
  | "talks"
  | "annuaire";

export const GROUPES: Record<GroupeCle, { label: string; href?: string }> = {
  profil: { label: "Profil", href: "/mon-espace/fiche/identite" },
  domaines: { label: "Domaines", href: "/mon-espace/fiche/secteurs" },
  localisation: {
    label: "Localisation & langues",
    href: "/mon-espace/fiche/interventions",
  },
  contact: { label: "Contact & liens", href: "/mon-espace/fiche/contact" },
  attestation: {
    label: "Attestation",
    href: "/mon-espace/fiche/attestation",
  },
  talks: { label: "Talks", href: "/mon-espace/talks" },
  // « Soumis à l'annuaire » est une ACTION (le CTA « Soumettre »), pas un champ :
  // pas de page à ouvrir.
  annuaire: { label: "Annuaire", href: undefined },
};

export interface Chantier {
  key: string;
  groupe: GroupeCle;
  label: string;
  hint?: string;
  done: boolean;
  href?: string;
  /** true = enrichissement facultatif (masquable) ; false = requis pour l'annuaire. */
  optionnel: boolean;
}

/**
 * Au-delà de ce nombre de chantiers À FAIRE, on regroupe par étapes plutôt que
 * de dérouler une longue liste à plat (charge cognitive, cf.
 * docs/principes-conception-ui.md).
 */
export const SEUIL_REGROUPEMENT = 5;

/** Un champ texte compte comme rempli s'il a autre chose que des espaces. */
const rempli = (v: string | null | undefined): boolean => Boolean(v?.trim());

/**
 * Localisation & langues « faites » = ville renseignée ET au moins une zone
 * d'intervention ET au moins une langue. On invite tant que l'un des trois est
 * VIDE ; une fois renseignés, on n'insiste plus (même avec les valeurs
 * toulousaines par défaut : parler seulement français ou n'intervenir qu'en
 * Occitanie est légitime, ce n'est pas une fiche « à compléter »).
 */
function localisationLanguesFaite(p: SpeakerProfile): boolean {
  return (
    rempli(p.ville) &&
    (p.regions ?? []).length > 0 &&
    (p.langues ?? []).length > 0
  );
}

function reseauxFaits(p: SpeakerProfile): boolean {
  return rempli(p.website) || rempli(p.instagram);
}

/** Étape (clé de `espaceChecklist`) → groupe de chantier. */
const GROUPE_DE_LETAPE: Record<string, GroupeCle> = {
  // Le nom se saisit à l'étape Profil du formulaire : même groupe.
  nom: "profil",
  profil: "profil",
  talks: "talks",
  contact: "contact",
  attestation: "attestation",
  annuaire: "annuaire",
};

export interface Completude {
  /** Tous les chantiers, dans l'ordre (requis puis enrichissements). */
  chantiers: Chantier[];
  /** Ceux qui restent à faire. */
  aFaire: Chantier[];
  /** Les requis restants (bloquent la publication tant qu'il en reste). */
  requisRestants: Chantier[];
  /** Avancement des REQUIS uniquement (barre de progression, 0-100). */
  percentRequis: number;
  /** true → présenter par étapes ; false → à plat. */
  grouper: boolean;
}

/**
 * Calcule la complétude de la fiche. Fonction PURE (aucun accès I/O) : testable
 * et réutilisable côté serveur comme dans un composant.
 */
export function completude(
  profile: SpeakerProfile | null,
  talksCount: number,
  /** Nom du COMPTE : voir `espaceChecklist` (une fiche absente n'en porte pas). */
  nomCompte?: string | null,
): Completude {
  const { steps, percent } = espaceChecklist(profile, talksCount, nomCompte);

  const requis: Chantier[] = steps.map((s) => ({
    key: s.key,
    groupe: GROUPE_DE_LETAPE[s.key] ?? "profil",
    label: s.label,
    hint: s.hint,
    done: s.done,
    href: s.href,
    optionnel: false,
  }));

  // Les enrichissements n'ont de sens qu'avec une fiche existante.
  const enrichissements: Chantier[] = profile
    ? [
        {
          key: "localisation-langues",
          groupe: "localisation",
          label: "Localisation & langues",
          hint: "Ta ville, tes zones d'intervention et tes langues : les organisatrices te repèrent près de chez toi et dans ta langue.",
          done: localisationLanguesFaite(profile),
          href: GROUPES.localisation.href,
          optionnel: true,
        },
        {
          key: "reseaux",
          groupe: "contact",
          label: "Site & réseaux",
          hint: "Ton site web et ton Instagram donnent à voir ton travail au-delà de l'annuaire.",
          done: reseauxFaits(profile),
          href: GROUPES.contact.href,
          optionnel: true,
        },
      ]
    : [];

  // « Soumis à l'annuaire » (action terminale) reste en DERNIER : les
  // enrichissements s'intercalent après les requis d'édition, avant de soumettre.
  const requisEdition = requis.filter((c) => c.groupe !== "annuaire");
  const annuaire = requis.filter((c) => c.groupe === "annuaire");
  const chantiers = [...requisEdition, ...enrichissements, ...annuaire];
  const aFaire = chantiers.filter((c) => !c.done);
  return {
    chantiers,
    aFaire,
    requisRestants: requis.filter((c) => !c.done),
    percentRequis: percent,
    grouper: aFaire.length > SEUIL_REGROUPEMENT,
  };
}

/**
 * Regroupe les chantiers À FAIRE par étape, en conservant l'ordre d'apparition
 * des groupes. Sert à l'affichage « par étapes » quand `grouper` est vrai.
 */
export function grouperAFaire(
  aFaire: Chantier[],
): { groupe: GroupeCle; label: string; href?: string; chantiers: Chantier[] }[] {
  const ordre: GroupeCle[] = [];
  const parGroupe = new Map<GroupeCle, Chantier[]>();
  for (const c of aFaire) {
    if (!parGroupe.has(c.groupe)) {
      parGroupe.set(c.groupe, []);
      ordre.push(c.groupe);
    }
    parGroupe.get(c.groupe)!.push(c);
  }
  return ordre.map((g) => {
    const chs = parGroupe.get(g)!;
    // Le lien du groupe vient du 1er chantier (source unique : les requis tiennent
    // leur href d'espaceChecklist). GROUPES ne sert que de repli (groupes
    // d'enrichissement sans étape espace).
    return { groupe: g, label: GROUPES[g].label, href: chs[0]?.href ?? GROUPES[g].href, chantiers: chs };
  });
}
