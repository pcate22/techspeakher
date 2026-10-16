import Form from "next/form";
import Button from "@/components/Button";
import LienTexte from "@/components/LienTexte";
import {
  filtresActifs,
  type Dimension,
  type Facette,
  type FacettesAgenda,
  type FiltresAgenda,
} from "@/lib/agenda-filtres";

/**
 * L'ENTRÉE DE L'AGENDA : une recherche, trois listes, et l'état dans l'URL.
 *
 * POURQUOI UN FORMULAIRE GET, ET PAS DES PUCES À BASCULE. Les quatre autres
 * surfaces filtrantes du dépôt gardent leur état en mémoire (`FilterChip` +
 * `aria-pressed`) ; ici l'état doit vivre dans l'ADRESSE (§4.5 de l'audit : le
 * lien partagé est le produit, le bouton retour du téléphone doit marcher, et
 * c'est le seul moyen de faire exister une page « en scène à Toulouse »). Une
 * puce qui navigue est un lien, pas une bascule : reprendre le composant aurait
 * promis une sémantique de bouton pressé à une commande qui change de page.
 * Le formulaire, lui, marche SANS JavaScript, et `next/form` le rend en
 * navigation client quand il est là.
 *
 * POURQUOI DES LISTES DÉROULANTES, ET PAS DES PUCES. L'audit le recommandait
 * déjà pour les villes (« l'agenda aura vite plus de villes que de place en
 * puces », §4.4) ; la raison vaut plus encore pour les conférences, dont il naît
 * une par événement. Et le mal que ce lot répare est un MUR DE DÉFILEMENT :
 * trente puces au-dessus de la liste auraient repoussé les dates de deux écrans
 * de plus.
 *
 * POURQUOI LES TROIS LISTES SE REPLIENT (correctif de la revue d'écran, 18/08).
 * Mesuré à 393×852 : dépliée, la barre occupait 417 px avec ses marges, la
 * première carte se posait à y = 920, et la dernière ligne visible à l'arrivée
 * était le compteur — AUCUNE date à l'écran. Le rôle de cette page est de
 * montrer des dates (règle d'or), et « un filtre n'est jamais un péage » : la
 * recherche et le bouton restent visibles, l'affinage tient en une ligne qu'on
 * ouvre, et il s'ouvre TOUT SEUL dès qu'un filtre est posé — on ne referme
 * jamais une commande sur les doigts de qui s'en sert. C'est aussi la règle
 * COGA des « listes qui se referment ».
 *
 * CHAQUE OPTION ANNONCE SON RENDEMENT (repris de `134onstage`, §4.4) : on ne
 * clique pas dans le vide, et le décompte est celui que le filtre rendra
 * vraiment — dates en ligne comprises, puisqu'elles sont joignables de partout.
 */

const CHAMP =
  "w-full min-h-[44px] rounded-lg border border-field-border bg-navy px-3 py-2 text-sm text-white placeholder-gray-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan";

/** L'étiquette d'une commande est le texte le plus lisible de l'écran, pas le
 *  moins (checklist COGA) : casse gardée, 14 px, graisse 600, couleur pleine. */
const ETIQUETTE = "mb-1 block text-sm font-semibold text-white";

function ListeFacette({
  nom,
  etiquette,
  neutre,
  facette,
  valeur,
}: {
  /** Nom du paramètre d'URL — c'est lui qui voyage (`?ville=toulouse`). Une
   *  dimension de la lib, jamais une liste réécrite ici. */
  nom: Dimension;
  etiquette: string;
  /** L'option qui ne filtre rien, à la forme positive (« Toutes les villes »). */
  neutre: string;
  facette: Facette;
  valeur: string | null;
}) {
  // Aucun choix à faire dans le DOCUMENT : la commande ne s'affiche pas (« les
  // filtres disparaissent quand il n'y a qu'une famille », checklist COGA).
  // Jugé sur le document et non sur la vue : décidé sur la vue, taper un mot
  // dans la recherche faisait disparaître les trois listes, et le parcours
  // « je cherche puis j'affine » devenait impossible (revue d'écran du 18/08).
  if (!facette.offerte && !valeur) return null;
  return (
    // Largeur LIBRE dès qu'il y a de la place : une liste bornée à une taille
    // fixe coupait « Toutes les conférences (5) » en plein milieu, et on ne
    // tronque pas ce qui doit permettre de CHOISIR. La rangée se replie plutôt
    // que de comprimer ses commandes.
    <div className="sm:w-auto sm:max-w-full">
      <label className={ETIQUETTE} htmlFor={`filtre-${nom}`}>
        {etiquette}
      </label>
      {/* `key` sur la VALEUR : le champ est non contrôlé, donc React ne
          réécrit pas sa valeur d'affichage à une simple mise à jour de
          `defaultValue`. Sans cette clé, revenir en arrière ou effacer les
          filtres laissait la commande sur « Toulouse » au-dessus d'une page
          complète — l'écran montrait un filtre que la page n'appliquait plus
          (mesuré en revue, 18/08). La clé force un nœud neuf, donc une valeur
          juste, à chaque changement d'adresse. */}
      <select
        key={valeur ?? ""}
        id={`filtre-${nom}`}
        name={nom}
        defaultValue={valeur ?? ""}
        className={`${CHAMP} sm:w-auto`}
      >
        <option value="">
          {neutre} ({facette.total})
        </option>
        {facette.options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle} ({o.nombre})
          </option>
        ))}
      </select>
    </div>
  );
}

/** Le libellé de la valeur choisie dans une facette, pour que la ligne repliée
 *  dise ce qui est actif sans qu'on l'ouvre. */
function nomChoisi(facette: Facette, valeur: string | null): string | null {
  return valeur ? (facette.options.find((o) => o.valeur === valeur)?.libelle ?? null) : null;
}

export default function AgendaFiltres({
  action,
  filtres,
  facettes,
}: {
  /** L'adresse du document filtré : `/agenda`, ou `/agenda/2025`. */
  action: string;
  filtres: FiltresAgenda;
  facettes: FacettesAgenda;
}) {
  const actifs = filtresActifs(filtres);
  const listes = [
    {
      nom: "ville" as const,
      etiquette: "Ville",
      neutre: "Toutes les villes",
      facette: facettes.villes,
      valeur: filtres.ville,
    },
    {
      nom: "region" as const,
      etiquette: "Région",
      neutre: "Toutes les régions",
      facette: facettes.regions,
      valeur: filtres.region,
    },
    {
      nom: "conference" as const,
      etiquette: "Conférence",
      neutre: "Toutes les conférences",
      facette: facettes.conferences,
      valeur: filtres.conference,
    },
  ];
  const affinables = listes.filter((l) => l.facette.offerte || l.valeur);
  const choisis = listes
    .map((l) => nomChoisi(l.facette, l.valeur))
    .filter((nom): nom is string => nom !== null);
  return (
    <Form
      action={action}
      // La liste se recompose sous la barre : ramener la page en haut à chaque
      // filtre ferait perdre des yeux la commande qu'on vient d'actionner.
      scroll={false}
      className="mb-8 flex flex-col gap-3 rounded-2xl border border-navy-lighter bg-navy-light p-4"
    >
      <div>
        <label className={ETIQUETTE} htmlFor="filtre-q">
          Rechercher
        </label>
        {/* Même raison que pour les listes : sans `key`, le mot cherché restait
            dans le champ après « Tout effacer » ou un retour arrière. */}
        <input
          key={filtres.q}
          id="filtre-q"
          type="search"
          name="q"
          defaultValue={filtres.q}
          placeholder="Un titre, une conférence, un nom…"
          className={CHAMP}
        />
      </div>

      {affinables.length > 0 && (
        <details open={actifs} className="group">
          {/* Une ligne qui DIT ce qu'elle cache, et ce qui est déjà choisi.
              Le chevron est dessiné ici parce qu'un `summary` en `inline-flex`
              perd le marqueur du navigateur : sans lui, rien n'annoncerait que
              la ligne s'ouvre. Décoratif (`aria-hidden`) — c'est `details` qui
              porte l'état pour la synthèse vocale, et le mot porte le sens.
              Un SVG, jamais un caractère : « ▸ » se collait au mot suivant dans
              le texte rendu (`e2e/mots-colles.spec.ts` l'a vu), et son dessin
              change d'un téléphone à l'autre. */}
          <summary className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded text-sm font-semibold text-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan">
            <svg
              aria-hidden="true"
              className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
            </svg>
            Affiner par lieu ou conférence
            {choisis.length > 0 && ` : ${choisis.join(", ")}`}
          </summary>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            {affinables.map((l) => (
              <ListeFacette key={l.nom} {...l} />
            ))}
          </div>
        </details>
      )}

      {/* Le geste et sa sortie côte à côte : « Tout effacer » posé sous la
          première liste se lisait comme la légende de cette liste (loi de
          proximité). Une seule porte pour ce geste, ici — un second lien sous
          la liste vide serait le doublon que le registre des erreurs proscrit. */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Un seul aplat primaire par page (règle d'or), et il appartient au
            « Gérer mes talks » du bas : filtrer se demande sans crier. */}
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="shrink-0 rounded-lg border border-field-border hover:border-cyan"
        >
          Filtrer
        </Button>
        {actifs && (
          <LienTexte href={action} className="inline-flex min-h-[44px] items-center text-sm">
            Tout effacer
          </LienTexte>
        )}
      </div>
    </Form>
  );
}
