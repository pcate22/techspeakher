/**
 * Le vocabulaire affichable des actualités : les CATÉGORIES (type de contenu,
 * `CATEGORIES` de lib/contenu-form) puis les TAGS (temporalité, `TAGS`). Une
 * valeur inconnue tombe sur le gris neutre ; `data-integrity.test.ts` vérifie
 * que les deux listes sont couvertes ici.
 */
export const COULEURS_TAG: Record<string, string> = {
  "Meetup & Talk": "bg-orange/20 text-orange-light",
  "Behind the Scenes": "bg-magenta/20 text-magenta-light",
  Tremplin: "bg-magenta/20 text-magenta-light",
  Communauté: "bg-cyan/20 text-cyan",
  "Conseils de speakeuse": "bg-cyan/20 text-cyan",
  "À venir": "bg-magenta/20 text-magenta-light",
  "En cours": "bg-orange/20 text-orange-light",
  "Passé": "bg-cyan/20 text-cyan",
};

export default function TagBadge({ tag, colors }: { tag: string; colors?: Record<string, string> }) {
  const colorMap = colors || COULEURS_TAG;
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${colorMap[tag] || "bg-navy-lighter text-gray-light"}`}>
      {tag}
    </span>
  );
}
