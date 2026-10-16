/**
 * Carte de section d'une fiche admin (participante, atelier, récompense,
 * photo) : titre lié à la section par `aria-labelledby`, description, contenu.
 * Une seule définition, réutilisée par toutes les fiches profondes.
 */
export default function CarteSection({
  id,
  titre,
  description,
  children,
}: {
  id: string;
  titre: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="bg-navy-light border border-navy-lighter rounded-2xl p-6"
    >
      <h2 id={id} className="text-sm font-bold mb-1">
        {titre}
      </h2>
      <p className="text-xs text-gray-light mb-4">{description}</p>
      {children}
    </section>
  );
}
