import { useId } from "react";
import ExternalLink from "@/components/ExternalLink";
import type { PublicAccompagnante } from "@/lib/tremplin-public";

/**
 * CELLES QUI ONT ACCOMPAGNÉ une phase du parcours — coachs et animatrices.
 *
 * Un seul composant pour les deux chapitres d'une édition (le Tremplin, puis la
 * montée sur scène) : c'est le même objet vu à deux moments, pas deux listes
 * (principes §3, « mutualiser la présentation, pas par copie »). Chaque page
 * lui passe SA phase, et ne charge que ce qu'elle affiche.
 *
 * La liste ne s'affiche QUE si quelqu'un a donné son accord : une section
 * « Elles ont accompagné » vide dirait que personne ne l'a fait, alors qu'elle
 * dit seulement que personne n'a encore été créditée. Le silence vaut mieux que
 * le contresens.
 *
 * Le lien passe par `ExternalLink`, qui refuse tout ce qui n'est pas http(s) et
 * dégrade en `<span>` : la fiche coach est saisie à la main, et une page
 * publique en cache n'est pas l'endroit pour faire confiance à une URL. Il part
 * aussi en `ugc nofollow` : une accompagnante bénévole est souvent indépendante,
 * et son lien mène alors à son activité. Voir docs/google-ad-grants.md.
 */
export default function Accompagnantes({
  personnes,
  titre = "Elles ont accompagné",
  className,
}: {
  personnes: readonly PublicAccompagnante[];
  titre?: string;
  className?: string;
}) {
  // `useId` plutôt qu'un id fixe : le composant prend un titre en prop, donc
  // rien n'empêche deux instances sur une même page — et deux `id` identiques
  // casseraient les deux `aria-labelledby` d'un coup.
  const id = useId();
  if (personnes.length === 0) return null;

  return (
    <section className={className} aria-labelledby={id}>
      <h3 id={id} className="text-lg font-bold mb-4">
        {titre}
      </h3>
      <ul role="list" className="flex flex-wrap gap-3 list-none">
        {personnes.map((p, i) => (
          <li
            key={`${p.nom}-${i}`}
            className="bg-navy-light border border-navy-lighter rounded-xl px-4 py-3"
          >
            <p className="font-semibold text-white">
              {p.lien ? (
                <ExternalLink
                  href={p.lien}
                  ugc
                  aria-label={p.nom}
                  className="text-cyan hover:text-cyan-light underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
                >
                  {p.nom}
                </ExternalLink>
              ) : (
                p.nom
              )}
            </p>
            {p.role && <p className="text-sm text-gray-light mt-0.5">{p.role}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
