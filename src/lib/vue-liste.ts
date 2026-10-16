/**
 * VUES FILTRÉES des listes du tableau de bord orga.
 *
 * Une tâche groupée du cockpit (« Donner une date à 3 ateliers ») pointait la
 * liste ENTIÈRE : on atterrissait en haut de quinze rangées, à charge de
 * retrouver les trois concernées — la tâche disait quoi faire, pas où. Elle
 * pointe désormais une VUE : la même liste réduite à son sujet, avec un retour
 * explicite vers tout.
 *
 * Le filtre vit dans l'URL (`?vue=a-dater`) : un lien, pas un état — il se
 * partage, se recharge et revient avec le bouton Retour.
 */

export interface Vue {
  /** Nom de la vue, tel que l'annonce le bandeau (« À dater »). */
  titre: string;
  /** Ce qui EST vrai quand la vue ne retient rien : arriver par une tâche déjà
   * réglée doit l'apprendre — jamais une liste vide, ni « 0 atelier ». */
  vide: string;
  /** Vide « par vacuité » : la POPULATION de la vue est vide (aucun atelier
   * passé, aucune inscrite). Sans lui, `vide` serait vrai mais mensonger —
   * « les présences sont pointées » quand rien n'a jamais eu lieu. */
  videSansBase: string;
}

export const VUES = {
  "a-dater": {
    titre: "À dater",
    vide: "Tous les ateliers ont une date.",
    videSansBase: "Aucun atelier pour l'instant.",
  },
  presences: {
    titre: "Présences à pointer",
    vide: "Les présences des ateliers passés sont pointées.",
    videSansBase: "Aucun atelier passé pour l'instant\u00a0: rien à pointer.",
  },
  /**
   * Le PROGRAMME n'est pas un filtre : c'est une autre LENTILLE sur la même
   * liste — les séances par phase, dans leur ordre, quelle que soit leur date.
   * C'est ainsi que la cadence se conçoit, avant d'avoir les dates. Elle ne
   * retient donc jamais rien de moins que tout : « vue vide » et « base vide »
   * sont la même chose, et se disent pareil.
   */
  programme: {
    titre: "Programme",
    vide: "Le programme reste à écrire\u00a0: crée une première séance.",
    videSansBase: "Le programme reste à écrire\u00a0: crée une première séance.",
  },
  "sans-compte": {
    titre: "Sans compte relié",
    vide: "Toutes les inscrites ont un compte relié.",
    videSansBase: "Aucune inscrite pour l'instant.",
  },
  /*
   * Les vues de « À faire » (/mon-espace/a-faire, conception D4) : une clé par
   * FAMILLE du moteur de tâches, mot pour mot — c'est ce qui permet à la page
   * d'intersecter la vue avec les familles chargées sans table de
   * correspondance, qui divergerait au premier renommage d'un seul côté.
   *
   * Une seule grammaire, un seul axe : POUR QUI est-ce ? (arbitrage B5).
   * « Tout » reste hors patron parce qu'il est l'absence de filtre : son href
   * est la page sans paramètre, il n'a pas d'entrée ici.
   *
   * Une clé valide vient toujours d'une famille PRÉSENTE dans la liste (c'est
   * l'intersection qui le garantit), donc une vue « À faire » n'affiche jamais
   * son état vide aujourd'hui — les messages existent parce que le contrat
   * l'exige, et pour le jour où l'intersection s'assouplirait.
   */
  personnel: {
    titre: "Pour moi",
    vide: "Rien à faire de ton côté. Tout roule.",
    videSansBase: "Rien à faire de ton côté. Tout roule.",
  },
  association: {
    titre: "Pour l'association",
    vide: "Rien à faire pour l'association. Tout roule.",
    videSansBase: "Rien à faire pour l'association. Tout roule.",
  },
  accompagnement: {
    titre: "Pour mes coachées",
    vide: "Rien à faire pour tes coachées. Tout roule.",
    videSansBase: "Rien à faire pour tes coachées. Tout roule.",
  },
} as const satisfies Record<string, Vue>;

export type CleVue = keyof typeof VUES;

/**
 * Clé de vue lue depuis un `searchParam`, restreinte à celles que la page sait
 * filtrer : une clé inconnue, étrangère à la page ou répétée (`?vue=a&vue=b`)
 * donne `null` — la liste s'affiche entière, sans bandeau qui promettrait un
 * filtre inexistant.
 */
export function cleVue<K extends CleVue>(
  brut: string | string[] | undefined,
  permises: readonly K[],
): K | null {
  // Générique : le retour se resserre sur les clés que LA page permet — la
  // page « À faire » récupère ainsi une `FamilleTache`, pas l'union entière.
  if (typeof brut !== "string") return null;
  return (permises as readonly string[]).includes(brut) ? (brut as K) : null;
}

/**
 * Message d'une vue qui ne retient rien. `basePleine` distingue « la tâche est
 * réglée » (le message rassure) de « la population est vide » (le message
 * l'explique) — la décision vit ici, pas dans un ternaire par page.
 */
export function messageVide(cle: CleVue, basePleine: boolean): string {
  return basePleine ? VUES[cle].vide : VUES[cle].videSansBase;
}

/** Lien d'une tâche groupée vers SA vue (la clé est vérifiée à la compilation). */
export function avecVue(href: string, cle: CleVue): string {
  return `${href}?vue=${cle}`;
}
