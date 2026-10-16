import type { AtelierDeletionCounts } from "@/lib/tremplin-ateliers";
import { nb } from "@/lib/format";

/**
 * Ce que la suppression d'un atelier EMPORTE, écrit une seule fois. Deux
 * endroits le disent : la page de retrait, qui le chiffre AVANT l'appui, et la
 * liste, dont la confirmation redit APRÈS coup ce qui est parti. Deux copies
 * auraient divergé sur un pluriel ou sur un compte, et le périmètre annoncé
 * n'aurait plus été celui du geste (principes §10).
 *
 * Fonctions PURES (pas d'accès base) : elles reçoivent les comptes déjà lus.
 */

/**
 * Le périmètre CHIFFRÉ, énuméré. On ne cite que ce qui existe vraiment : un
 * « 0 sous-groupe » ferait du bruit là où il faut de la clarté. Ce qui RESTE
 * (les inscriptions à l'édition) est dit par l'appelant : « participantes » se
 * lirait sinon comme « elles quittent l'édition ».
 */
export function emporteAtelier({
  nbParticipantes,
  nbSousGroupes,
  nbSupports,
  nbCoachs,
}: AtelierDeletionCounts): string[] {
  return [
    nbParticipantes > 0 && `${nb(nbParticipantes, "participante")} et leurs présences`,
    nbSousGroupes > 0 && nb(nbSousGroupes, "sous-groupe"),
    nbSupports > 0 && nb(nbSupports, "support"),
    nbCoachs > 0 && `le rattachement de ${nb(nbCoachs, "coach")}`,
  ].filter((p): p is string => Boolean(p));
}

/**
 * La phrase d'aperçu, nominative : ce que le geste emporte, ou le fait qu'il
 * n'emporte rien — le cas fréquent du doublon créé par erreur.
 *
 * C'est le filet qui RESTE depuis qu'un atelier ne fait plus retaper son titre
 * (§10, décision du 01/08) : aucune saisie à produire, mais on sait ce qui part
 * avant d'appuyer.
 */
export function apercuRetraitAtelier(titre: string, counts: AtelierDeletionCounts): string {
  const nomme = `«\u00a0${titre}\u00a0»`;
  return counts.total > 0
    ? `Supprime ${nomme} et, avec lui, ${emporteAtelier(counts).join(", ")}.`
    : `${nomme} ne porte rien pour l'instant\u00a0: il part seul.`;
}

/**
 * La confirmation APRÈS coup, nominative. Sans modale ni saisie, c'est elle qui
 * rend compte du geste : elle redit ce qui est parti avec l'atelier, pour qu'un
 * glissement de travers se voie tout de suite au lieu de se découvrir plus tard.
 */
export function confirmationRetraitAtelier(titre: string, counts: AtelierDeletionCounts): string {
  const nomme = `«\u00a0${titre}\u00a0» est supprimé`;
  return counts.total > 0 ? `${nomme}, avec ${emporteAtelier(counts).join(", ")}.` : `${nomme}.`;
}
