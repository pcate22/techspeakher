import { dateLongueFr } from "@/lib/format";
import { DELAI_ADHESION } from "@/lib/adhesion";

/**
 * « Ta prochaine étape » (conception N1 §2.5, écran A) : UNE carte dérivée
 * des données, jamais une pile d'injonctions. L'échelle, dans l'ordre du
 * parcours vers la scène : créer sa fiche → premier talk → viser une scène →
 * préparer la scène datée. Fonction pure, testée sans BDD.
 */
export interface EtapeInput {
  aFiche: boolean;
  /** Compte éligible à la création de fiche (genre ≠ « homme ») : jamais de
   * CTA impossible, même garde que l'onboarding de Mon espace. */
  peutCreerFiche: boolean;
  talksCount: number;
  /** Talks repérés par le moissonneur CFP, en attente de confirmation :
   * une donnée qui appelle UN geste — la définition d'une étape. */
  suggestionsCount?: number;
  /** Date (AAAA-MM-JJ) de la prochaine scène à venir, sinon null. */
  prochaineScene: string | null;
  /** Fiche `en_pause` faute d'adhésion (migration 074) : rien d'autre ne
   * compte tant qu'elle est hors de l'annuaire. */
  ficheEnPause?: boolean;
}

export interface Etape {
  texte: string;
  cta: string;
  href: string;
}

export function prochaineEtape(m: EtapeInput): Etape | null {
  if (!m.aFiche) {
    if (!m.peutCreerFiche) return null;
    return {
      texte:
        "Crée ta fiche speakeuse : c'est elle que les organisatrices de conférences lisent.",
      cta: "Créer ma fiche",
      href: "/mon-espace/fiche",
    };
  }
  if (m.ficheEnPause) {
    return {
      texte: `Ta fiche est en pause, hors de l'annuaire. Après ton adhésion, elle y revient ${DELAI_ADHESION}.`,
      cta: "Adhérer",
      href: "/adherer",
    };
  }
  if ((m.suggestionsCount ?? 0) > 0) {
    const n = m.suggestionsCount!;
    // Ni sigle ni marque : « CFP » suppose de savoir ce qu'est un *call for
    // papers* — devant le public qui, par définition, n'a pas encore proposé
    // de talk — et nommer « Sessionize » aurait menti dès l'arrivée de Notist
    // (roadmap). Un intitulé nomme le FAIT, pas l'outil.
    return {
      texte:
        n > 1
          ? `On a repéré ${n} talks à ton nom\u00a0: ils attendent ta confirmation.`
          : "On a repéré un talk à ton nom\u00a0: il attend ta confirmation.",
      cta: n > 1 ? "Confirmer mes talks" : "Confirmer mon talk",
      href: "/mon-espace/talks",
    };
  }
  if (m.talksCount === 0) {
    return {
      texte:
        "Ta fiche est là. Ajoute ton premier talk : c'est lui qui donne envie de t'inviter.",
      cta: "Ajouter un talk",
      href: "/mon-espace/talks/nouveau",
    };
  }
  if (m.prochaineScene === null) {
    return {
      texte:
        "Tes talks sont prêts. Vise une scène : ajoute ta prochaine conférence sur un de tes talks.",
      cta: "Déclarer une scène",
      href: "/mon-espace/talks",
    };
  }
  return {
    texte: `Ta prochaine scène est le ${dateLongueFr(m.prochaineScene)}. Prépare-la !`,
    cta: "Voir mon agenda",
    href: "/mon-espace/agenda",
  };
}
