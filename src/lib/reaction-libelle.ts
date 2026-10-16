import { nb } from "@/lib/format";
import type { TypeCible } from "@/lib/reactions";

/**
 * LES MOTS de la réaction (lot N4, retours de Cateline du 2026-08-08 —
 * « objectif : se motiver », mais « si on a trop de trucs, c'est bizarre
 * cognitivement : pourquoi j'ai ce bouton ? »).
 *
 * DEUX mots, une règle qui se devine sans l'apprendre :
 * - on FÉLICITE un accomplissement — « Bravo » sur une scène comme sur
 *   l'article d'une membre (écrire et partager en est un) ;
 * - on ACCUEILLE une arrivée — « Bienvenue » quand une speakeuse rejoint
 *   l'annuaire : elle n'a rien accompli, la féliciter d'un formulaire
 *   sonnerait creux.
 *
 * Écartés : « Merci » (juste sur un conseil, bancal ailleurs), « J'aime » et
 * « Intéressant » (ils jugent le texte, que personne n'a lu depuis le fil).
 *
 * Le mot se DÉRIVE du type de carte : rien de plus en base.
 *
 * Module PUR (aucun accès base) : le composant client l'importe sans tirer
 * la lib serveur des réactions.
 */

export interface MotReaction {
  /** Le libellé du bouton, stable quel que soit l'état (RGAA). */
  bouton: string;
  /** L'emoji décoratif (`aria-hidden`) qui l'accompagne. */
  emoji: string;
  /** Le verbe du compteur, accordé : « elles », « vous », « elle ». */
  ontFait: string;
  avezFait: string;
  aFait: string;
  /** La phrase de la personne seule à avoir réagi (« Toi »). */
  tuAsFait: string;
}

export const MOTS: Record<TypeCible, MotReaction> = {
  scene: {
    bouton: "Bravo",
    emoji: "👏",
    ontFait: " ont applaudi",
    avezFait: " avez applaudi",
    aFait: " a applaudi",
    tuAsFait: ", tu as applaudi",
  },
  venue: {
    bouton: "Bienvenue",
    emoji: "👋",
    ontFait: " lui ont souhaité la bienvenue",
    avezFait: " lui avez souhaité la bienvenue",
    aFait: " lui a souhaité la bienvenue",
    tuAsFait: ", tu lui as souhaité la bienvenue",
  },
  // Un article de membre est un accomplissement : le MÊME mot que la scène.
  asso: {
    bouton: "Bravo",
    emoji: "👏",
    ontFait: " ont applaudi",
    avezFait: " avez applaudi",
    aFait: " a applaudi",
    tuAsFait: ", tu as applaudi",
  },
};

export interface LibelleReactions {
  visible: string;
  srOnly: string;
}

/**
 * Le compteur nominatif d'une rangée : COURT et SANS verbe — le bouton d'à
 * côté dit déjà le geste — et l'état « j'ai déjà réagi » se lit en TEXTE
 * (« Toi, … »), jamais par la couleur seule (RGAA 3.2). Le `srOnly` complète
 * la phrase pour le lecteur d'écran, avec LE verbe de la carte.
 */
export function libelleReactions(i: {
  nb: number;
  /** Première personne NOMMÉE, autre que moi (cf. getReactionsPourFil). */
  premiere: string | null;
  moi: boolean;
  type: TypeCible;
}): LibelleReactions | null {
  if (i.nb <= 0) return null;
  const mot = MOTS[i.type];

  if (i.moi) {
    const reste = i.nb - 1 - (i.premiere ? 1 : 0);
    if (i.premiere && reste > 0)
      return { visible: `Toi, ${i.premiere} et ${nb(reste, "autre")}`, srOnly: mot.avezFait };
    if (i.premiere) return { visible: `Toi et ${i.premiere}`, srOnly: mot.avezFait };
    if (reste > 0)
      return { visible: `Toi et ${nb(reste, "autre")}`, srOnly: mot.avezFait };
    return { visible: "Toi", srOnly: mot.tuAsFait };
  }

  if (i.premiere) {
    if (i.nb === 1) return { visible: i.premiere, srOnly: mot.aFait };
    return {
      visible: `${i.premiere} et ${nb(i.nb - 1, "autre")}`,
      srOnly: mot.ontFait,
    };
  }
  // Que des personnes sans nom de compte : le compte en membres, jamais un
  // nom vide en tête de phrase.
  return {
    visible: nb(i.nb, "membre"),
    srOnly: i.nb > 1 ? mot.ontFait : mot.aFait,
  };
}
