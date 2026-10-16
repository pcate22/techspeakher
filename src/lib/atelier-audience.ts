import type { PhaseAtelier } from "@/lib/tremplin-ateliers";
import { MEMBERSHIP_PHASE_LABEL } from "@/lib/tremplin-phases";

/**
 * QUI voit un atelier — SOURCE UNIQUE.
 *
 * Avant, deux interrupteurs indépendants : « ouvert à toutes » d'un côté, une
 * liste nominative de l'autre. Le plus permissif gagnait EN SILENCE. On
 * activait les participantes d'une phase sur un atelier resté ouvert à toutes,
 * elles s'ajoutaient bien, et rien ne changeait pour personne — la modale
 * l'écrivait même noir sur blanc (« l'ouverture à toutes ne change pas »), ce
 * qui expliquait le geste sans le rendre utile.
 *
 * Une seule question, une seule réponse, trois choix EXCLUSIFS. La liste
 * nominative n'est plus un mécanisme parallèle : c'est l'un des trois choix.
 * Du coup `tremplin_atelier_membres` redevient ce qu'elle aurait dû rester —
 * le registre des PRÉSENCES — et ne décide plus de qui voit quoi.
 *
 * La phase n'est pas redemandée : l'atelier en porte déjà une (avant / après la
 * soirée), et « les participantes de sa phase » la réutilise. Une question de
 * moins à l'écran, et deux réponses qui ne peuvent plus se contredire.
 */
export type AudienceAtelier = "selection" | "phase" | "toutes";

export interface AudienceDef {
  cle: AudienceAtelier;
  /** Libellé court, quand la phase n'a pas besoin d'être nommée. */
  libelle: string;
}

/** Du plus fermé au plus ouvert : l'ordre du select, et l'ordre de prudence. */
export const AUDIENCES_ATELIER: readonly AudienceDef[] = [
  { cle: "selection", libelle: "Une sélection de participantes" },
  { cle: "phase", libelle: "Les participantes de sa phase" },
  { cle: "toutes", libelle: "Toutes les inscrites de l'édition" },
] as const;

/**
 * Un atelier neuf ne s'ouvre à personne tant qu'on ne l'a pas dit. À GARDER EN
 * PHASE avec le `DEFAULT` de la colonne `audience` (db/schema.sql,
 * db/sync-to-latest.sql).
 */
export const DEFAULT_AUDIENCE: AudienceAtelier = "selection";

/**
 * Audience d'une clé reçue (formulaire, URL), ou `null`. Passer par ici : une
 * lecture directe répondrait aussi aux clés du prototype, et l'appelant doit
 * pouvoir refuser plutôt que retomber en silence sur une audience arbitraire —
 * la plus ouverte, en l'occurrence.
 */
export function audienceParCle(brut: unknown): AudienceAtelier | null {
  if (typeof brut !== "string") return null;
  return AUDIENCES_ATELIER.some((a) => a.cle === brut)
    ? (brut as AudienceAtelier)
    : null;
}

/**
 * L'audience en toutes lettres. « Les participantes de sa phase » ne dit rien
 * seul : on NOMME la phase. Avec les mots de l'inscription (« Préparation à la
 * conférence »), pas avec le repère de la liste d'ateliers (« Après la
 * soirée ») — ici on parle de personnes, pas de calendrier.
 */
export function libelleAudience(
  audience: AudienceAtelier,
  phase: PhaseAtelier,
): string {
  if (audience === "phase") {
    return `Les participantes de « ${MEMBERSHIP_PHASE_LABEL[phase]} »`;
  }
  // Repli sur le libellé le plus FERMÉ plutôt qu'une assertion non-nulle : la
  // colonne porte une contrainte CHECK, mais si une valeur inattendue arrivait
  // un jour, mieux vaut sous-annoncer l'ouverture que planter la page.
  return (
    AUDIENCES_ATELIER.find((a) => a.cle === audience)?.libelle ??
    AUDIENCES_ATELIER[0].libelle
  );
}

/**
 * Ce que le choix implique, dit à l'orga. Forme positive (règle du projet).
 *
 * QUI voit la séance dans son espace, et RIEN D'AUTRE. L'aide annonçait aussi
 * la conséquence publique, du temps où l'audience décidait de la vitrine : on
 * réglait donc ce que le site montre en croyant ne régler que l'accès. Depuis la
 * migration 056, la vitrine se coche à part et s'explique à part
 * (`PROGRAMME_PUBLIC_AIDE`).
 */
export function aideAudience(audience: AudienceAtelier, phase: PhaseAtelier): string {
  return audience === "toutes"
      ? "Chaque inscrite à l'édition le voit dans son espace, avec ses supports."
      : audience === "phase"
        ? `Seules les inscrites rattachées à « ${MEMBERSHIP_PHASE_LABEL[phase]} » le voient, avec ses supports : la liste suit la phase, une nouvelle rattachée le voit aussitôt.`
        : "Seules les inscrites que tu désignes ci-dessous le voient. À réserver aux séances qui concernent quelques personnes.";
}

/**
 * CE QUE LE SITE PUBLIC ANNONCE, dit à l'orga avant qu'elle choisisse.
 *
 * On nomme les champs un par un plutôt que « le programme public » : l'aide
 * disait autrefois « titre et dates » alors que la description partait aussi,
 * donc on pouvait l'écrire en croyant qu'elle restait entre soi. Et on dit ce
 * qui NE part pas — le lieu — parce que c'est la question que se pose celle qui
 * hésite, et la réponse qui la rassure.
 *
 * Forme positive des deux côtés (règle du projet) : l'état fermé se dit par ce
 * qu'il EST, « réservé à l'espace des inscrites », jamais par une négation.
 */
export const PROGRAMME_PUBLIC_LABEL = "Visible sur le site public";

/**
 * UNE phrase, vraie dans les DEUX états. Le libellé dérivait de l'état serveur
 * pendant que l'interrupteur basculait de façon optimiste : le temps de
 * l'aller-retour, il annonçait « figure au parcours » sous un interrupteur déjà
 * éteint (registre §5, « libellé directionnel qui contredit l'UI »). Elle dit
 * donc ce que le réglage GOUVERNE, pas où il est posé.
 */
export const PROGRAMME_PUBLIC_AIDE =
  "Décide de la présence de l'atelier au parcours de l'édition, sur le site\u00a0: son nom, ses dates et sa description. Le lieu reste entre vous, dans tous les cas.";

/**
 * L'état de DÉPART du réglage « visible sur le site public », dérivé de
 * l'audience à la création — un défaut, plus une règle.
 *
 * Une séance qui vise une COHORTE fait partie du parcours qu'on raconte : elle
 * naît visible. Une sélection nominative naît réservée. Ensuite c'est l'orga qui
 * décide, et le réglage vit sa vie (`tremplin_ateliers.au_programme_public`).
 *
 * L'INCIDENT, raconté ici et nulle part ailleurs. La publication a d'abord
 * dépendu du NOMBRE de participantes désignées : désigner une seule inscrite
 * suffisait à publier la séance — avec son lieu — alors que l'écran promet
 * « seules les inscrites que tu désignes le voient ». Et l'interrupteur qui
 * désigne est celui du POINTAGE des présences : pointer publiait. La migration
 * 051 a répondu en fusionnant publication et audience.
 *
 * Ce que cette fusion corrigeait n'était pas « deux réglages », c'était un
 * réglage INVISIBLE : personne ne choisissait de publier, ça se déduisait d'un
 * geste qui parlait d'autre chose. D'où la 056 — deux réglages à nouveau, mais
 * le second est écrit, coché, et affiché en toutes lettres sur la liste comme
 * sur la fiche. Le lieu, lui, ne sort plus du DTO (`PublicAtelier`) : même mal
 * réglée, une séance ne peut plus livrer son adresse.
 */
export function programmePublicParDefaut(audience: AudienceAtelier): boolean {
  return audience !== "selection";
}
