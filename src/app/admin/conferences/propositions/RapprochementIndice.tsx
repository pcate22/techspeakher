import type { Rapprochement } from "@/lib/proposition-rapprochement";

/**
 * Ce que le répertoire dit d'une proposition, en UNE ligne — l'indice qui
 * manquait à l'arbitrage (`docs/conception-arbitrage-conferences.md`, défaut C).
 *
 * Deux niveaux, deux voix, parce que ce ne sont pas deux degrés d'une même
 * chose : le slug identique est un FAIT (la validation rattachera, elle ne
 * créera pas de marque) ; la ressemblance est une SUGGESTION que l'orga juge.
 * Le mot le dit à chaque fois — jamais la couleur seule (principes UI §9).
 *
 * Partagé par la file et par la page d'une proposition : le même indice, sous
 * le même mot, aux deux endroits où la décision se prend.
 *
 * `text-sm font-semibold`, et pas la taille des métadonnées qui l'entourent :
 * c'est CETTE ligne qui empêche un doublon de marque dans la référence
 * partagée. La hiérarchie se fait par la taille et la graisse (principes UI §9).
 *
 * Un `<span className="block">` et non un `<p>` : sur la file, l'indice vit
 * DANS le lien de la rangée (contenu phrasé seulement), et un `<p>` y serait du
 * HTML invalide. Une ligne courte, donc rien de perdu au passage.
 */
export default function RapprochementIndice({
  rapprochement: r,
  className = "",
}: {
  rapprochement: Rapprochement;
  className?: string;
}) {
  if (r.identique) {
    return (
      <span className={`block text-sm font-semibold text-cyan ${className}`}>
        Déjà au répertoire&nbsp;: «&nbsp;{r.identique.nom}&nbsp;».{" "}
        {r.identique.anneeDejaLa
          ? "Valider rattachera les talks à son édition existante."
          : "Valider ajoutera cette édition, sans créer de conférence."}
      </span>
    );
  }
  if (r.proches.length === 0) return null;
  // Les noms en UNE chaîne : cette liste est de la prose, pas une structure. En
  // fragments JSX, chaque nom demandait sa clé et son séparateur conditionnel.
  // Les insécables sont DANS la chaîne : le premier repli les avait rendues
  // sécables, et « KubeCon + CloudNativeCon Europe » laissait son guillemet
  // seul en fin de ligne sur un téléphone.
  const noms = r.proches.map((p) => `« ${p.nom} »`).join(", ");
  return (
    <span className={`block text-sm font-semibold text-cream ${className}`}>
      Ressemble à {noms}. Valider en l&apos;état créera une conférence de plus au
      répertoire.
    </span>
  );
}
