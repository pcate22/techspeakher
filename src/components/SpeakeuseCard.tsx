import Link from "next/link";
import type { PublicSpeaker } from "@/lib/profiles";
import type { PublicTalkPreview } from "@/lib/talks";
import Avatar from "@/components/Avatar";
import ChipGroup from "@/components/ChipGroup";

/** Nombre de titres de talks affichés sur la carte avant le repli « +N ». */
const MAX_TALKS = 3;

/**
 * Carte speakeuse réutilisable (annuaire).
 * Hiérarchie : nom (+ photo/initiales) → titre/poste → TALKS (le produit qu'on
 * met en avant : ce qu'elle raconte sur scène) → secteurs / sujets. Cliquable
 * vers la fiche si `href` est fourni.
 *
 * Le nom est un <h2> : il alimente le plan de titres de la page (navigation
 * par titres au lecteur d'écran). `headingLevel` permet d'ajuster le niveau si
 * la carte est réutilisée sous une autre hiérarchie.
 *
 * Type `PublicSpeaker` (et pas `SpeakerProfile`) : on ne manipule ici que des
 * champs publics, jamais de métadonnées internes (statut, validation, e-mail…).
 */
export default function SpeakeuseCard({
  profile,
  href,
  talks = [],
  headingLevel: Heading = "h2",
}: {
  profile: PublicSpeaker;
  href?: string;
  /** Titres de talks publics (titre + type). Mis en avant sur la carte. */
  talks?: PublicTalkPreview[];
  headingLevel?: "h2" | "h3";
}) {
  const nom = profile.nomAffiche;
  // Si le compte a un VRAI nom (pas "" ni "   " : nomAffiche a déjà pris le
  // titre en repli sinon), on montre le titre de profil en sous-titre ; sinon
  // on retombe sur poste · entreprise.
  const sousTitre =
    profile.titreProfil && profile.name?.trim()
      ? profile.titreProfil
      : [profile.poste, profile.entreprise].filter(Boolean).join(" · ");

  const inner = (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-4">
        <Avatar name={nom} image={profile.image} size="lg" />
        <div className="min-w-0">
          <Heading className="text-white font-bold text-lg truncate">{nom}</Heading>
          {sousTitre && <p className="text-sm text-gray-light">{sousTitre}</p>}
        </div>
      </div>
      {talks.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-light mb-2">
            Talks
          </p>
          {/* Les talks NE sont PAS des chips : langage visuel distinct de la
              taxonomie (Secteurs magenta / Sujets cyan). Barre d'accent + titre
              en avant, type en petite légende — sinon la pastille de type se
              confond avec les chips Secteurs (même magenta arrondi). */}
          <ul className="flex flex-col gap-3 list-none">
            {talks.slice(0, MAX_TALKS).map((t, i) => (
              <li key={i} className="border-l-2 border-magenta pl-3">
                <p className="text-[11px] uppercase tracking-wide text-magenta-light">
                  {t.type}
                </p>
                <p className="text-[15px] font-medium text-white leading-snug">
                  {t.titre}
                </p>
              </li>
            ))}
          </ul>
          {talks.length > MAX_TALKS && (
            <p className="text-xs text-gray-light mt-2 pl-3">
              +{talks.length - MAX_TALKS} autre
              {talks.length - MAX_TALKS > 1 ? "s" : ""} talk
              {talks.length - MAX_TALKS > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
      {(profile.secteurs.length > 0 || profile.sujets.length > 0) && (
        <div className="flex flex-col gap-3">
          <ChipGroup label="Secteurs" items={profile.secteurs} tone="magenta" max={4} />
          <ChipGroup label="Sujets" items={profile.sujets} tone="cyan" max={4} />
        </div>
      )}
      {/* Affordance de cliquabilité : signale qu'on ouvre la fiche. Décorative
          (aria-hidden) car la carte entière est déjà un lien nommé par le nom.
          Séparateur en tête : l'isole des chips Sujets (cyan) juste au-dessus,
          pour qu'il se lise comme une action de pied de carte, pas un chip. */}
      {href && (
        <div className="mt-auto pt-3 border-t border-navy-lighter">
          <span
            aria-hidden="true"
            className="inline-flex items-center gap-1 text-sm font-semibold text-cyan group-hover:text-cyan-light"
          >
            Voir la fiche
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </span>
        </div>
      )}
    </div>
  );

  const cardClass = "block bg-navy-light border border-navy-lighter rounded-xl p-6";

  if (href) {
    return (
      <Link
        href={href}
        className={`group ${cardClass} h-full hover:border-cyan/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan transition-colors`}
      >
        {inner}
      </Link>
    );
  }
  return <div className={cardClass}>{inner}</div>;
}
