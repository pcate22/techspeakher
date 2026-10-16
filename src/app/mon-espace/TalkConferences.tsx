import Link from "next/link";
import type { Talk } from "@/lib/talks";
import { formatOccurrenceMeta } from "@/lib/talk-date";
import Button from "@/components/Button";
import ConferenceLogo from "@/components/ConferenceLogo";

/**
 * Une conférence hors répertoire attend l'arbitrage orga (migration 068) : la
 * ligne le dit, pour que la speakeuse sache où en est sa demande plutôt que de
 * chercher pourquoi sa saisie manque sur sa fiche publique. Table de
 * correspondance plutôt que deux ternaires jumelles : le libellé et la couleur
 * d'un état se lisent (et se changent) au même endroit.
 */
const BADGE_ETAT = {
  en_attente: { classe: "bg-cyan/15 text-cyan", texte: "En attente de validation" },
  ecartee: { classe: "bg-orange/15 text-orange", texte: "Conférence écartée" },
} as const;

/**
 * Conférences rattachées à un talk, sur la page du talk.
 *
 * Trois règles portées ici (audit UX/UI 2026-07-25) :
 * - **Un seul CTA principal par page** (règle d'or) : « Enregistrer les
 *   modifications » garde le magenta ; ajouter une conférence est une
 *   navigation, donc un bouton secondaire, placé APRÈS la liste (l'affordance
 *   suit son contenu — sur cette page, la liste est courte et l'en-tête porte
 *   déjà le CTA principal du formulaire).
 * - **Une conférence = une ligne cliquable vers sa page** (§1 hub-and-spoke,
 *   même pattern que `TalkCard` en mode gestion) : une seule cible tactile de
 *   44 px au lieu d'un libellé « Modifier » collé à droite, qui écrasait le
 *   texte sur mobile et sortait le geste du contexte de son item.
 * - **En-tête empilé** : titre et texte d'aide en pleine largeur, plus de
 *   colonne de 200 px face à un bouton.
 */
export default function TalkConferences({ talk }: { talk: Talk }) {
  return (
    <section
      aria-labelledby="conferences-title"
      className="bg-navy-light border border-navy-lighter rounded-2xl p-5 sm:p-8 flex flex-col gap-4"
    >
      <div>
        <h2 id="conferences-title" className="text-lg font-bold text-white">
          Conférences
        </h2>
        <p className="text-sm text-gray-light mt-1">
          Les événements où tu as donné ce talk. Chacun a ses propres liens
          (slides, vidéo…).
        </p>
      </div>

      {talk.occurrences.length === 0 ? (
        <p className="text-sm text-gray-light">
          Aucune conférence rattachée. C&apos;est un sujet proposé&nbsp;: ajoute une
          conférence dès que tu l&apos;as donné.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 list-none">
          {talk.occurrences.map((o) => {
            const meta = formatOccurrenceMeta(o);
            return (
              <li key={o.id}>
                <Link
                  href={`/mon-espace/talks/${talk.id}/conference/${o.id}`}
                  className="flex min-h-[44px] items-center justify-between gap-3 rounded-lg border border-field-border bg-navy px-4 py-3 hover:border-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan transition-colors"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {/* Même repère visuel que la fiche publique : on gère ici ce
                        qu'on y verra. */}
                    {o.conference?.trim() && (
                      <ConferenceLogo
                        nom={o.conference}
                        slug={o.conferenceSlug}
                        taille="sm"
                      />
                    )}
                    <span className="text-sm text-white">
                      {meta || "Conférence à compléter"}
                      {o.etat !== "publiee" && (
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE_ETAT[o.etat].classe}`}
                        >
                          {BADGE_ETAT[o.etat].texte}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-cyan">
                    Modifier
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        href={`/mon-espace/talks/${talk.id}/conference/nouveau`}
        variant="secondary"
        size="sm"
        className="self-start min-h-[44px]"
      >
        + Ajouter une conférence
      </Button>
    </section>
  );
}
