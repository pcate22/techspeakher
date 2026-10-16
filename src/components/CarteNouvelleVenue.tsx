import Link from "next/link";
import Avatar from "@/components/Avatar";
import { CARTE_LIEN } from "@/components/carte-lien";
import type { NouvelleVenue } from "@/lib/fil-communaute";

/**
 * Carte d'une speakeuse qui vient de rejoindre l'annuaire (fil de la
 * communauté). Volontairement PLUS SOBRE que `SpeakeuseCard` : le fil dit
 * « elle est là, va voir », il ne rejoue pas la fiche (talks, secteurs, sujets).
 * Toute la carte mène à sa fiche.
 *
 * La date d'entrée n'est PAS affichée : « le 20 juillet » n'apprend rien quand
 * le fil est déjà trié du plus récent au plus ancien, et elle vieillit mal
 * (« nouvelle » depuis huit mois). L'ordre porte l'information.
 */
export default function CarteNouvelleVenue({
  venue: v,
  headingLevel: Heading = "h3",
}: {
  venue: NouvelleVenue;
  headingLevel?: "h3" | "h4";
}) {
  return (
    <Link
      href={v.href}
      aria-label={`${v.nom} : voir sa fiche`}
      className={CARTE_LIEN}
    >
      <Avatar name={v.nom} image={v.image} size="md" />
      <span className="min-w-0">
        <Heading className="truncate font-bold text-white group-hover:text-cyan-light">
          {v.nom}
        </Heading>
        {v.titreProfil && (
          <span className="block truncate text-sm text-gray-light">
            {v.titreProfil}
          </span>
        )}
      </span>
    </Link>
  );
}
