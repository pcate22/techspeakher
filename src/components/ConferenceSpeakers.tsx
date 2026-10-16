import SpeakeuseCard from "@/components/SpeakeuseCard";
import type { ConferenceSpeaker } from "@/lib/conference-speakers";

/**
 * Grille des speakeuses d'une conférence, dérivée du répertoire (talk rattaché à
 * l'édition) et de l'annuaire (fiche publiée). Réutilise la carte de l'annuaire :
 * chaque carte pointe la fiche `/speakeuses/[id]` — le LinkedIn et le contact
 * vivent là-bas (minimisation : on n'expose pas ces champs dans la liste).
 * Ne rend rien si la liste est vide (la page décide d'un éventuel repli).
 */
export default function ConferenceSpeakers({
  speakers,
  title = "Les speakeuses",
  titleId,
  lead,
  headingLevel: Heading = "h2",
}: {
  speakers: ConferenceSpeaker[];
  title?: string;
  titleId: string;
  /** Chapô optionnel (récit, lien vers l'article…) affiché sous le titre. */
  lead?: React.ReactNode;
  headingLevel?: "h2" | "h3";
}) {
  if (speakers.length === 0) return null;
  return (
    <section className="py-16 px-4" aria-labelledby={titleId}>
      <div className="max-w-5xl mx-auto">
        <Heading
          id={titleId}
          className={`text-2xl sm:text-3xl font-bold text-center ${lead ? "mb-4" : "mb-10"}`}
        >
          {title}
        </Heading>
        {lead && (
          <div className="text-gray-light text-center max-w-2xl mx-auto mb-10 leading-relaxed">
            {lead}
          </div>
        )}
        <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none">
          {speakers.map(({ speaker, talks }) => (
            <li key={speaker.id}>
              <SpeakeuseCard
                profile={speaker}
                href={`/speakeuses/${speaker.id}`}
                talks={talks}
                headingLevel="h3"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
