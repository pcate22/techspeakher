import Link from "next/link";
import type { RecitConference as Recit } from "@/lib/contenus";

/**
 * LE RÉCIT d'une conférence répertoriée, en accroche sur les pages qui la
 * montrent : celle de la conférence, et celle de l'édition du Tremplin qui s'y
 * tient. Le texte, lui, vit dans `/articles/<slug>` — écrit par l'orga dans
 * `/admin/contenus`, rattaché à l'édition de conférence (migration 040).
 *
 * Ce que 2025 a été pour la communauté était écrit en dur dans le JSX de
 * `/devfest-toulouse` : la page de l'édition qu'il raconte ne pouvait pas s'en
 * servir, et personne ne pouvait le corriger sans redéployer.
 *
 * Le bloc est AUTOPORTANT : sa section, son intitulé de région et son fond
 * voyagent ensemble. Une carte `bg-navy` posée sur une section sans fond
 * disparaît (c'est la couleur du body, et `border-navy-lighter` seule fait
 * 1,26:1). Une troisième surface n'a donc qu'une ligne à écrire.
 */
export default function RecitConference({
  recit,
  headingId,
}: {
  recit: Recit;
  /** Id du titre, qui intitule aussi la région (unique dans la page hôte). */
  headingId: string;
}) {
  return (
    <section aria-labelledby={headingId} className="bg-navy-light py-16 px-4">
      {/* Bande ET carte : le bloc doit se détacher même quand la section qui le
          précède porte déjà `bg-navy-light` (c'est le cas sur la page de la
          conférence) — sans la carte, les deux fondus n'en font qu'un. */}
      <div className="max-w-3xl mx-auto bg-navy border border-navy-lighter rounded-xl p-6 sm:p-8 text-center">
        <h2 id={headingId} className="text-2xl sm:text-3xl font-bold mb-6 text-balance">
          {recit.titre}
        </h2>
        {recit.chapo && (
          <p className="text-gray-light leading-relaxed mb-8 text-left sm:text-center text-pretty">
            {recit.chapo}
          </p>
        )}
        <Link
          href={`/articles/${recit.slug}`}
          className="inline-flex items-center min-h-[44px] px-1 text-cyan hover:text-cyan-light underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
        >
          Lire le récit
          <span aria-hidden="true">&nbsp;&rarr;</span>
        </Link>
      </div>
    </section>
  );
}
