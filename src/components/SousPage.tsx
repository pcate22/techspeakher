import Link from "next/link";

/**
 * Gabarit des sous-pages mono-fonction de l'admin (patron « une page = une
 * fonction », cf. docs/conception-tableau-de-bord-orga.md) : conteneur étroit,
 * en-tête avec une FLÈCHE DE RETOUR simple à gauche du titre (même couleur et
 * même taille que le titre, comme la barre d'une appli : lisible sans être un
 * bloc lourd — le bouton rond bordé « pesait » trop), puis le contenu.
 *
 * Pas d'intro par défaut : le fil d'Ariane nomme déjà l'atelier et le titre dit
 * la fonction — une glose sous chaque titre est du bruit. Un `indice` COURT
 * reste possible quand il porte une info de décision (ex. portée d'un partage),
 * jamais pour paraphraser le titre.
 *
 * Factorise l'échafaudage répété ~24 fois (dette technique #4). Le contenu
 * (formulaire, listes, dialogs) est passé en enfant.
 */
export default function SousPage({
  titre,
  indice,
  retour,
  children,
}: {
  titre: React.ReactNode;
  indice?: React.ReactNode;
  retour: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <header>
          <div className="flex items-center gap-2">
            <Link
              href={retour.href}
              aria-label={retour.label}
              className="-ml-1 shrink-0 rounded px-1 text-2xl font-bold leading-none text-inherit transition-colors hover:text-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            >
              {/* Le CARACTÈRE flèche, dans la même police et graisse que le titre
                  (cohérence typographique — ni trait trop fin, ni bouton lourd). */}
              <span aria-hidden="true">←</span>
            </Link>
            <h1 className="text-2xl font-bold">{titre}</h1>
          </div>
          {indice != null && <p className="text-sm text-gray-light mt-1">{indice}</p>}
        </header>
        {children}
      </div>
    </div>
  );
}
