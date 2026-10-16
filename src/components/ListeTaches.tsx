import NavRow from "@/components/NavRow";
import ColonneDate from "@/components/ColonneDate";
import { libelleEcheanceLong, motEcheance, type Tache } from "@/lib/taches";
import { VUES } from "@/lib/vue-liste";
import { formatDateFr } from "@/lib/format";

/**
 * Liste « À faire » (tableau de bord orga et hub d'édition) : une rangée par
 * tâche dérivée, façon agenda — l'échéance en TEXTE à droite (« mer. 12 août »,
 * exit les pastilles carrées) avec son urgence en toutes lettres dessous ; une
 * tâche « à dater » dit « à dater » au même endroit. Le **contexte** (nom du
 * tremplin) situe le rappel quand le tableau de bord agrège plusieurs éditions.
 * Titre jamais tronqué. État vide honnête sinon.
 *
 * `max` (lot B) : plafond d'affichage — au-delà, le reste se replie derrière un
 * `<details>` natif « Voir les N autres tâches », dans un dernier `<li>` de la
 * MÊME liste (une seule liste logique pour les lecteurs d'écran).
 */
export default function ListeTaches({
  taches,
  aujourdhui,
  vide,
  montreContexte = true,
  montreFamilles = false,
  label,
  max,
}: {
  taches: Tache[];
  aujourdhui: string;
  vide: string;
  /** Affiche le nom de l'édition sous chaque rappel. `false` sur le hub d'une
   * édition (on y est déjà : le nom serait redondant). */
  montreContexte?: boolean;
  /** Étiquette « pour qui » sur chaque ligne (« Pour moi », « Pour
   * l'association ») — les MÊMES mots que les puces de la page « À faire », à
   * la même condition qu'elles : ≥ 2 familles ET aucune vue active. Dans une
   * vue filtrée, chaque ligne dirait le nom de la vue — un mot qui ne
   * distingue rien (B5, C6). La décision vit dans la page, qui seule connaît
   * la vue ; ici on ne fait qu'afficher. */
  montreFamilles?: boolean;
  /** Nom accessible de la liste (« Tâches : pour moi ») : la page « À
   * faire » la nomme par sa vue active (D5). Absent sur les listes uniques
   * d'un tableau de bord, où l'en-tête voisin la nomme déjà. */
  label?: string;
  max?: number;
}) {
  if (taches.length === 0) {
    return <p className="text-sm text-gray-light">{vide}</p>;
  }
  // Un repli d'UNE seule ligne serait plus lourd que la ligne elle-même.
  const coupe = max !== undefined && taches.length > max + 1 ? max : taches.length;

  // Clé = index : liste entièrement re-dérivée côté serveur à chaque rendu
  // (deux tâches peuvent partager href et libellé).
  const lignes = taches.map((t, i) => {
    const mot = t.echeance ? motEcheance(t.echeance, aujourdhui) : null;
    const contexte = montreContexte ? t.contexte : undefined;
    // Les étiquettes s'énoncent en PHRASES complètes dans badgesLabel : un
    // `sr-only` se recolle au libellé sans séparateur (précédent « Modifier
    // le talk » du registre des erreurs).
    const famille = montreFamilles ? VUES[t.famille].titre : null;
    const phrases = [
      famille && `${famille}.`,
      t.echeance
        ? `Échéance\u00a0: ${formatDateFr(t.echeance, { day: "numeric", month: "long", year: "numeric" })}, ${libelleEcheanceLong(t.echeance, aujourdhui)}.`
        : null,
      t.constat
        ? "Pour information\u00a0: cette ligne situe, elle n'attend aucun geste."
        : null,
    ].filter((p): p is string => typeof p === "string");
    // Deux étiquettes possibles, en TEXTE, jamais une nuance de couleur
    // (RGAA 1.4.1) : la famille (« Pour moi » — les mots des puces), et
    // « Pour information » — une ligne qui n'est pas une action, dans une
    // liste de verbes à l'infinitif, se lirait sinon comme une action dont le
    // verbe manque.
    const pastilles = [famille, t.constat ? "Pour information" : null].filter(
      (p): p is string => p !== null,
    );
    return (
      <li key={i}>
        <NavRow
          href={t.href}
          titleClamp="none"
          title={t.libelle}
          subtitle={contexte}
          pastilles={pastilles.length > 0 ? pastilles : undefined}
          trailing={
            // La colonne est décorative pour l'audio : l'équivalent long (date
            // en toutes lettres + urgence) vit dans badgesLabel.
            t.echeance || t.dateAFixer ? (
              <ColonneDate
                date={t.echeance}
                aujourdhui={aujourdhui}
                secondaire={mot?.texte}
                alerteSecondaire={mot?.enRetard}
              />
            ) : undefined
          }
          badgesLabel={phrases.length > 0 ? phrases.join(" ") : undefined}
        />
      </li>
    );
  });

  return (
    <ul className="flex flex-col gap-2 list-none" role="list" aria-label={label}>
      {lignes.slice(0, coupe)}
      {coupe < lignes.length && (
        <li>
          <details>
            <summary className="cursor-pointer rounded px-1 py-2 text-sm text-gray-light hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan">
              Voir les {lignes.length - coupe} autres tâches
            </summary>
            <ul className="flex flex-col gap-2 list-none mt-2" role="list">
              {lignes.slice(coupe)}
            </ul>
          </details>
        </li>
      )}
    </ul>
  );
}
