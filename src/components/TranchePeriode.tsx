import EnTetePeriode from "@/components/EnTetePeriode";
import SceneCard from "@/components/SceneCard";
import type { TrancheAgenda } from "@/lib/agenda-public";

/**
 * Une tranche de période (« novembre 2026 ») et ses interventions.
 *
 * Elle vivait en fonction locale de `/agenda`. L'archive par année
 * (`/agenda/[annee]`) affiche exactement la même chose : un composant partagé
 * plutôt qu'une deuxième copie, sans quoi le premier ajustement de l'une
 * laisserait l'autre derrière.
 */
export default function TranchePeriode({
  tranche,
  zone,
}: {
  tranche: TrancheAgenda;
  /* Préfixe d'id : le même mois peut vivre dans deux zones d'une même page
     (une date passée, une à venir) — sans lui, deux ids identiques. */
  zone: "avenir" | "passe" | "annee";
}) {
  return (
    <section aria-labelledby={`periode-${zone}-${tranche.cle}`}>
      {/* Sans lui, les cartes ne portent que le jour (« jeudi 19 ») : passé
          l'en-tête, on lit une date sans son mois. */}
      <EnTetePeriode id={`periode-${zone}-${tranche.cle}`} as="h3">
        {tranche.libelle}
      </EnTetePeriode>
      {/* Deux colonnes au plus : un mois porte souvent une ou deux dates, et
          une carte seule dans une rangée de trois se lit comme un oubli. */}
      <ul role="list" className="mt-3 grid list-none grid-cols-1 gap-4 sm:grid-cols-2">
        {tranche.scenes.map((s) => (
          <li key={s.occurrenceId}>
            <SceneCard scene={s} headingLevel="h4" dansPeriode />
          </li>
        ))}
      </ul>
    </section>
  );
}
