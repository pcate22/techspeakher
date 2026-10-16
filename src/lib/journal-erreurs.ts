/**
 * LE JOURNAL DES ERREURS SERVEUR.
 *
 * Aujourd'hui, quand une membre tombe sur une page cassée, l'écran lui montre
 * un identifiant (le `digest`) et… c'est tout. Rien ne relie cet identifiant à
 * quoi que ce soit : impossible de retrouver ce qui s'est passé, même en ayant
 * la personne au téléphone. Les tests attrapent ce que quelqu'un a pensé à
 * écrire ; ce journal attrape le reste — c'est son intérêt, et il est
 * complémentaire, pas redondant.
 *
 * Volontairement SANS DÉPENDANCE : une ligne JSON sur la sortie standard, que
 * Vercel collecte déjà. Le jour où un outil de suivi (Sentry ou autre) sera
 * branché, il prendra la place de `console.error` sans rien changer d'autre —
 * la forme des données est déjà celle qu'il attend.
 *
 * CE QU'ON NE JOURNALISE JAMAIS. Un journal d'erreurs est un endroit où les
 * données personnelles fuient sans qu'on l'ait voulu :
 *   • les EN-TÊTES en bloc — ils portent les cookies, donc le jeton de session :
 *     les journaliser reviendrait à publier de quoi usurper une session ;
 *   • la CHAÎNE DE REQUÊTE — `?email=…`, `?q=…` charrient ce que la personne a
 *     saisi. On garde le chemin, jamais ce qui le suit.
 * Verrouillé par `journal-erreurs.test.ts`.
 */

export type ErreurJournalisable = {
  message?: string;
  digest?: string;
  stack?: string;
};

export type RequeteJournalisable = {
  path?: string;
  method?: string;
};

export type ContexteJournalisable = {
  routePath?: string;
  routeType?: string;
};

/** L'entrée de journal, réduite à ce qui aide à comprendre sans exposer personne. */
export type EntreeJournal = {
  niveau: "error";
  source: "next";
  /** L'identifiant montré à la personne sur l'écran d'erreur : le seul pont entre son signalement et ce journal. */
  digest?: string;
  message: string;
  /** Chemin SANS la chaîne de requête. */
  chemin?: string;
  methode?: string;
  route?: string;
  typeDeRoute?: string;
  stack?: string;
};

/** Retire tout ce qui suit `?` ou `#` : la personne a pu y saisir n'importe quoi. */
export function cheminSansRequete(path: string | undefined): string | undefined {
  if (!path) return undefined;
  return path.split(/[?#]/)[0];
}

/**
 * Lecture DÉFENSIVE d'un champ. Next type l'erreur en `unknown`, et sa doc
 * prévient que « l'instance peut ne pas être l'erreur d'origine » : selon
 * l'endroit où ça casse, on reçoit un `Error`, un objet quelconque, une chaîne,
 * ou `null`. On lit sans jamais supposer.
 */
function texte(source: unknown, cle: string): string | undefined {
  if (typeof source !== "object" || source === null) return undefined;
  const v = (source as Record<string, unknown>)[cle];
  return typeof v === "string" ? v : undefined;
}

/** Construit l'entrée de journal. Pure : c'est elle qu'on teste. */
export function construireEntree(
  error: unknown,
  request?: RequeteJournalisable,
  context?: ContexteJournalisable,
): EntreeJournal {
  return {
    niveau: "error",
    source: "next",
    digest: texte(error, "digest"),
    message: texte(error, "message") ?? (typeof error === "string" ? error : "Erreur sans message"),
    chemin: cheminSansRequete(request?.path),
    methode: request?.method,
    route: context?.routePath,
    typeDeRoute: context?.routeType,
    stack: texte(error, "stack"),
  };
}

/**
 * Journalise. Ne LÈVE JAMAIS : une erreur ici s'ajouterait à celle qu'on est en
 * train de rapporter, et masquerait la première.
 */
export function journaliserErreur(
  error: unknown,
  request?: RequeteJournalisable,
  context?: ContexteJournalisable,
): void {
  try {
    console.error(JSON.stringify(construireEntree(error, request, context)));
  } catch {
    console.error('{"niveau":"error","source":"next","message":"Erreur non sérialisable"}');
  }
}
