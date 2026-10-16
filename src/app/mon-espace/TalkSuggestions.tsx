import type { PendingSuggestion } from "@/lib/cfp-suggestions";
import { formatTalkDate } from "@/lib/talk-date";
import SubmitButton from "@/components/SubmitButton";
import { acceptSuggestionAction } from "./actions";
import RefuseSuggestionButton from "./RefuseSuggestionButton";

/**
 * Talks repérés par le moissonneur CFP dans les programmes publics des
 * conférences, en attente de confirmation un-clic. Rien n'est publié sans
 * l'accord de la speakeuse ; « Écarter » (confirmé) est mémorisé pour toujours.
 */
export default function TalkSuggestions({
  suggestions,
}: {
  suggestions: PendingSuggestion[];
}) {
  if (suggestions.length === 0) return null;

  return (
    <section
      aria-labelledby="suggestions-title"
      className="bg-navy-light border border-cyan/30 rounded-2xl p-6"
    >
      <h2
        id="suggestions-title"
        className="text-xs font-bold uppercase tracking-wider text-cyan mb-1"
      >
        Talks repérés pour toi
      </h2>
      <p className="text-sm text-gray-light mb-4">
        Trouvés dans les programmes publics des conférences. Confirme pour les
        ajouter à ta fiche, ou écarte-les si ce n&apos;est pas toi.
      </p>
      {/* role="list" : Safari/VoiceOver perd la sémantique avec list-none */}
      <ul role="list" className="flex flex-col gap-3 list-none">
        {suggestions.map((s) => (
          <li
            key={s.id}
            className="border border-navy-lighter rounded-xl p-4 flex flex-col gap-2"
          >
            <p className="font-bold text-white">{s.titre}</p>
            <p className="text-sm text-gray-light">
              {[s.conference, formatTalkDate(s.date)].filter(Boolean).join(" · ")}
            </p>
            {s.description && (
              <p className="text-sm text-gray-light line-clamp-3">
                {s.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <form action={acceptSuggestionAction}>
                <input type="hidden" name="suggestionId" value={s.id} />
                {/* Secondaire : un « Confirmer » magenta PAR suggestion redonnait
                    plusieurs CTA principaux à la page (règle d'or). */}
                <SubmitButton variant="secondary" size="sm" pendingLabel="Ajout…">
                  Confirmer
                  <span className="sr-only"> le talk « {s.titre} »</span>
                </SubmitButton>
              </form>
              <RefuseSuggestionButton suggestionId={s.id} titre={s.titre} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
