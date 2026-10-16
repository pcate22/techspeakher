import { foldRecherche } from "@/lib/normalise-recherche";

/**
 * Repli des saisies « retape pour confirmer » (type-to-confirm, palier 3 de
 * `docs/principes-conception-ui.md` §10). Source UNIQUE, partagée par le
 * composant client qui déverrouille le bouton et par la Server Action qui
 * revérifie : deux replis distincts finiraient par diverger, et une saisie
 * acceptée à l'écran serait refusée par le serveur (ou l'inverse).
 *
 * On accepte ce qu'une personne peut RAISONNABLEMENT taper en regardant la
 * valeur affichée :
 * - casse et accents (`foldRecherche`) ;
 * - ponctuation typographique : l'apostrophe courbe est partout dans les noms
 *   et les titres français, et arrive telle quelle du moissonneur CFP
 *   (`cfp-import.ts`) ou d'un clavier iPhone, alors qu'un clavier d'ordinateur
 *   produit « ' ». Sans ce repli, « N'Diaye » ou « L'art du pitch » seraient
 *   intapables et la suppression deviendrait impossible ;
 * - les blancs : la valeur est affichée en HTML, qui fractionne les espaces
 *   multiples, donc « Coder  vite » se lit « Coder vite » ; et les insécables
 *   que les guillemets français portent en propre disparaissent avec eux.
 *
 * Le but reste de forcer à REGARDER ce qu'on supprime, jamais de piéger la
 * saisie.
 */
export function plierConfirmation(v: string): string {
  return foldRecherche(v)
    .replace(/[’‘‛`´]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/[–—‑]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    // Les guillemets français encadrent leur contenu d'insécables (« vrai »),
    // pas les guillemets droits ("vrai") : sans ce rabotage, la valeur stockée
    // se replierait en `" vrai "` et la saisie clavier en `"vrai"`, donc jamais
    // égales — le verrou ne s'ouvrirait plus.
    .replace(/"\s+/g, '"')
    .replace(/\s+"/g, '"')
    .trim();
}

/**
 * Le geste RÉCLAME-T-IL de retaper le nom ? Palier 3 dès que la suppression
 * emporte quelque chose ; un objet VIDE redescend d'un palier — « le palier se
 * lit sur l'effet », `docs/principes-conception-ui.md` §10.
 *
 * La règle est nommée UNE fois parce qu'elle vit forcément à deux endroits :
 * l'écran décide d'afficher le champ, le serveur décide de le revérifier. Un
 * `total > 0` recopié des deux côtés, sur trois objets, avait déjà commencé à
 * diverger.
 */
export function exigeReecriture(nbEmporte: number): boolean {
  return nbEmporte > 0;
}

/**
 * La saisie de confirmation correspond-elle à ce qui est affiché ? Replie les
 * deux côtés à l'identique (`plierConfirmation`), sinon une saisie acceptée à
 * l'écran serait refusée par le serveur.
 *
 * ÉCHOUE FERMÉ quand la valeur attendue est vide : sans nom à retaper, il n'y a
 * rien à vérifier, donc rien à valider — l'appelant doit alors se passer du
 * palier 3 explicitement (via `exigeReecriture`), et non se voir accorder un
 * laissez-passer par une chaîne vide.
 */
export function confirmationValide(attendu: string, saisie: string): boolean {
  const attenduPlie = plierConfirmation(attendu);
  return attenduPlie.length > 0 && plierConfirmation(saisie) === attenduPlie;
}
