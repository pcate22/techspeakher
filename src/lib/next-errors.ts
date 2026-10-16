/**
 * Les erreurs de CONTRÔLE de Next — `redirect()`, `notFound()` — voyagent
 * comme des exceptions portant un `digest` préfixé `NEXT_`. Ce ne sont pas des
 * pannes : un `catch` qui les avale casse la navigation, en silence. Tout
 * `catch` large posé autour d'un appel qui peut rediriger doit donc les
 * relayer.
 *
 * UNE copie du test : il porte sur un détail interne de Next (le format du
 * digest), donc il doit changer d'un seul endroit le jour où ce format change.
 * Le signal est le même côté serveur (un `signIn` qui redirige) et côté client
 * (un Server Action dont la promesse rejette pour que `RedirectBoundary`
 * navigue).
 *
 * Même précédent que `pg-errors.ts` : aucun import du framework, on ne fait
 * qu'inspecter ce que l'erreur porte — donc importable partout, et testable.
 *
 * À REPRENDRE : `src/app/connexion/actions.ts` et
 * `src/app/connexion/deja-un-compte/page.tsx` portent encore chacun leur copie
 * du test (bornée à `NEXT_REDIRECT`). Elles convergeront ici quand le chemin
 * de connexion sera couvert par un test — le swap est mécanique, mais ce
 * chemin n'a rien qui l'attrape aujourd'hui.
 */
export function estControleNext(e: unknown): boolean {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}
