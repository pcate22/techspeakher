"use client";

import { useState, useMemo, useEffect, useId, useRef, useCallback } from "react";
import SpeakeuseCard from "@/components/SpeakeuseCard";
import Button from "@/components/Button";
import FilterChip from "@/components/FilterChip";
import type { PublicSpeaker } from "@/lib/profiles";
import type { PublicTalkPreview } from "@/lib/talks";
import { createSpeakerMatcher, type SpeakerDoc } from "@/lib/speaker-search";

/**
 * Annuaire : recherche plein-texte locale + filtres multi-sélection par
 * secteur / sujet / zone / langue, puis liste de cartes cliquables vers la
 * fiche. Les données viennent de la base (profils publiés, projetés en
 * `PublicSpeaker` côté serveur).
 *
 * Sémantique des filtres : OU à l'intérieur d'une catégorie (Occitanie OU
 * Île-de-France), ET entre catégories (une zone ET une langue). Cocher un
 * second filtre n'en décoche donc plus un autre.
 *
 * Les filtres vivent dans un VOLET latéral (drawer) plutôt qu'en ligne : une
 * surface clairement délimitée, qui ne repousse pas la liste.
 */
/** Catégories de filtres, affichées par groupes (pas une rangée à plat). */
const FILTER_GROUPS: { label: string; get: (p: PublicSpeaker) => string[] }[] = [
  { label: "Secteurs", get: (p) => p.secteurs },
  { label: "Sujets", get: (p) => p.sujets },
  { label: "Zones", get: (p) => p.regions },
  { label: "Langues", get: (p) => p.langues },
];

/** Clé de sélection : la catégorie préfixe le tag (un même libellé — « Autre »
 *  — peut vivre dans deux catégories sans se confondre). */
const key = (label: string, tag: string) => `${label} ${tag}`;

export default function SpeakeusesFilter({
  profiles,
  searchText = {},
  talksByProfile = {},
  indisponible = false,
}: {
  profiles: PublicSpeaker[];
  /**
   * La liste est vide parce que la BASE se tait, et non parce que personne
   * n'est publiée. Les deux états rendaient la même phrase — « L'annuaire
   * arrive bientôt » — qui promet un annuaire à venir alors qu'il existe déjà.
   * Voir `page.tsx` : le drapeau naît là-bas, dans le `catch`.
   */
  indisponible?: boolean;
  /** Texte détaillé (bio, ville, talks) par id de profil, pour la recherche
   *  plein-texte sans l'afficher sur la carte (minimisation du payload liste). */
  searchText?: Record<number, string>;
  /** Titres de talks (titre + type) par id de profil, AFFICHÉS sur la carte. */
  talksByProfile?: Record<number, PublicTalkPreview[]>;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const titleId = useId();
  // Volet = <dialog> natif (même pattern que la loupe / AdminDialog) : focus
  // piégé, Échap, arrière-plan inerte, focus restitué au bouton à la fermeture.
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openFilters = useCallback(() => {
    const d = dialogRef.current;
    if (!d) return;
    // jsdom (tests) n'implémente pas showModal : repli sur l'attribut open.
    if (typeof d.showModal === "function") d.showModal();
    else d.setAttribute("open", "");
  }, []);
  const closeFilters = useCallback(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (typeof d.close === "function") d.close();
    else d.removeAttribute("open");
  }, []);

  // Un groupe de puces par catégorie, tags triés en français (« À distance »,
  // « Île-de-France » à leur place malgré l'accent).
  const groups = useMemo(
    () =>
      FILTER_GROUPS.map((g) => ({
        label: g.label,
        get: g.get,
        tags: Array.from(new Set(profiles.flatMap(g.get))).sort((a, b) =>
          a.localeCompare(b, "fr"),
        ),
      })).filter((g) => g.tags.length > 0),
    [profiles],
  );

  const toggle = (label: string, tag: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const k = key(label, tag);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  // Documents cherchables (mêmes règles de matching que la recherche globale, via
  // `speaker-search`). `text` = bio + talks fournis par le serveur (`searchText`),
  // SANS la ville : minimisation (cf. `SpeakerDoc.text`) — la ville reste
  // trouvable via la recherche globale de l'entête, pas ici.
  const docs = useMemo<SpeakerDoc[]>(
    () =>
      profiles.map((p) => ({
        id: p.id,
        name: p.name ?? "",
        titreProfil: p.titreProfil ?? "",
        poste: p.poste ?? "",
        entreprise: p.entreprise ?? "",
        secteurs: p.secteurs,
        sujets: p.sujets,
        regions: p.regions,
        langues: p.langues,
        text: searchText[p.id] ?? "",
      })),
    [profiles, searchText],
  );

  // Fuse chargé à la demande (comme la recherche globale) : le matcher n'est prêt
  // qu'après l'import. Tant qu'il ne l'est pas, la recherche ne contraint pas la
  // liste (facettes seules) ; elle se recalcule dès que Fuse est chargé.
  const [matcher, setMatcher] = useState<((q: string) => number[]) | null>(null);
  useEffect(() => {
    let alive = true;
    import("fuse.js").then(({ default: Fuse }) => {
      if (alive) setMatcher(() => createSpeakerMatcher(Fuse, docs));
    });
    return () => {
      alive = false;
    };
  }, [docs]);

  const filtered = useMemo(() => {
    // Tags sélectionnés regroupés par catégorie (pour le ET entre catégories).
    const actives = groups
      .map((g) => ({
        get: g.get,
        tags: g.tags.filter((t) => selected.has(key(g.label, t))),
      }))
      .filter((g) => g.tags.length > 0);
    // OU dans une catégorie, ET entre catégories.
    const passesFacets = (p: PublicSpeaker) =>
      actives.every((g) => g.tags.some((t) => g.get(p).includes(t)));

    const q = query.trim();
    // Recherche active + matcher prêt : on part des ids CLASSÉS par pertinence
    // (nom d'abord…), qu'on croise avec les facettes. Sinon (pas de requête, ou
    // Fuse encore en chargement) : ordre serveur, facettes seules.
    if (q.length >= 2 && matcher) {
      const byId = new Map(profiles.map((p) => [p.id, p]));
      return matcher(q)
        .map((id) => byId.get(id))
        .filter((p): p is PublicSpeaker => p != null && passesFacets(p));
    }
    return profiles.filter(passesFacets);
  }, [profiles, query, selected, groups, matcher]);

  const hasFilters = groups.length > 0;
  const activeCount = selected.size;
  // Recherche « active » = au moins 2 caractères (seuil du moteur) : en deçà, on
  // n'applique aucun filtre texte, donc on ne prétend pas non plus « correspondre ».
  const searching = query.trim().length >= 2;
  // Fenêtre où l'utilisateur a lancé une recherche mais où Fuse n'est pas encore
  // chargé : on annonce « recherche en cours » plutôt qu'un décompte trompeur.
  const searchPending = searching && !matcher;
  const resultSuffix =
    searching && activeCount > 0
      ? " correspondant à ta recherche et à tes filtres"
      : searching
        ? " correspondant à ta recherche"
        : activeCount > 0
          ? " correspondant à tes filtres"
          : "";

  return (
    <>
      {(hasFilters || profiles.length > 0) && (
        <div className="max-w-3xl mx-auto px-4 -mt-6 mb-8">
          {/* Recherche puis « Filtrer », alignés à gauche. */}
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchField value={query} onChange={setQuery} />
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={openFilters}
                aria-haspopup="dialog"
                // Contour `field-border` (comme le champ de recherche et les
                // chips) plutôt que le cyan vif de `secondary` : « Filtrer » est
                // un contrôle secondaire, il ne crie pas plus fort que la recherche.
                className="gap-2 shrink-0 self-start sm:self-auto border border-field-border rounded-lg hover:border-cyan"
              >
                {/* Icône entonnoir (filtre), et non une flèche de téléchargement. */}
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
                </svg>
                Filtrer
                {activeCount > 0 && (
                  <span className="text-xs font-bold" aria-hidden="true">
                    ({activeCount})
                  </span>
                )}
                {activeCount > 0 && (
                  <span className="sr-only">
                    , {activeCount} filtre{activeCount > 1 ? "s" : ""} actif
                    {activeCount > 1 ? "s" : ""}
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Volet de filtres : glisse depuis la droite (desktop ET mobile), par-
          dessus la page. Le clic sur le fond (l'élément dialog lui-même) ferme. */}
      {hasFilters && (
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          // Pleine hauteur : `h-dvh` + `max-h-none` neutralisent la hauteur max
          // par défaut du navigateur sur un <dialog> modal (qui laissait un vide
          // en bas). Fond simplement assombri, SANS flou (le blur rendait la
          // page derrière sale sur desktop).
          // Pleine largeur sur mobile (pas de ruban de page à gauche, qui
          // faisait bâclé) ; panneau latéral ~448 px ancré à droite dès sm.
          className="fixed inset-y-0 right-0 left-auto m-0 ml-auto h-dvh max-h-none w-full sm:max-w-md bg-navy border-l border-field-border p-0 text-white shadow-2xl backdrop:bg-black/60"
          onMouseDown={(e) => {
            if (e.target === dialogRef.current) closeFilters();
          }}
        >
          <div className="flex h-full flex-col">
            <header className="flex items-center justify-between gap-3 px-5 py-4 bg-navy-light border-b border-navy-lighter">
              <h2 id={titleId} className="text-lg font-bold">
                Filtres
                {activeCount > 0 && (
                  <span className="ml-2 text-sm font-semibold text-cyan">
                    ({activeCount})
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={closeFilters}
                aria-label="Fermer les filtres"
                className="rounded p-1 text-gray-light hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
              {groups.map((group) => (
                <div key={group.label} role="group" aria-label={group.label}>
                  <p className="text-xs uppercase tracking-wide text-gray-light mb-2">
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.tags.map((tag) => {
                      const on = selected.has(key(group.label, tag));
                      return (
                        <FilterChip
                          key={tag}
                          active={on}
                          aria-pressed={on}
                          onClick={() => toggle(group.label, tag)}
                        >
                          {tag}
                        </FilterChip>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <footer className="flex items-center justify-between gap-3 px-5 py-4 bg-navy-light border-t border-navy-lighter">
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                disabled={activeCount === 0}
                className="text-sm font-medium text-cyan hover:text-cyan-light disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded px-1"
              >
                Tout effacer
              </button>
              <Button variant="secondary" size="sm" onClick={closeFilters}>
                Voir les {filtered.length} speakeuse{filtered.length > 1 ? "s" : ""}
              </Button>
            </footer>
          </div>
        </dialog>
      )}

      {/* Liste des speakeuses */}
      <section className="pb-16 px-4" aria-label="Liste des speakeuses" aria-busy={searchPending}>
        <div className="max-w-3xl mx-auto">
          {/* Compteur VISIBLE (pas seulement sr-only) : on sait combien on
              parcourt. `aria-live` l'annonce aussi au lecteur d'écran. Pendant le
              chargement du moteur, on annonce « recherche en cours » plutôt qu'un
              décompte qui vaudrait « tout » puis se corrigerait. */}
          {profiles.length > 0 && (
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-gray-light mb-6"
            >
              {searchPending
                ? "Recherche en cours…"
                : `${filtered.length} speakeuse${filtered.length > 1 ? "s" : ""}${resultSuffix}`}
            </p>
          )}
          {/* Colonne unique : lecture verticale, jamais deux cartes côte à
              côte (chaque personne se lit en entier, talks compris). */}
          <ul className="flex flex-col gap-6 list-none" role="list">
            {filtered.map((p) => (
              <li key={p.id}>
                <SpeakeuseCard
                  profile={p}
                  // URL slug quand elle existe (cf. speakeuseHref) ; inline ici
                  // car ce composant client ne peut pas importer lib/profiles
                  // (accès DB serveur).
                  href={`/speakeuses/${p.slug ?? p.id}`}
                  talks={talksByProfile[p.id]}
                />
              </li>
            ))}
          </ul>

          {filtered.length === 0 && (
            <p className="text-center text-gray-light py-8" role="status">
              {profiles.length === 0
                ? // Trois vides, trois phrases : la base se tait / personne
                  // n'est encore publiée / la recherche ne remonte rien. Dire
                  // « arrive bientôt » pendant une panne annonce un annuaire à
                  // venir, alors qu'il existe et qu'il est plein.
                  indisponible
                  ? "L'annuaire revient dans un instant."
                  : "L'annuaire arrive bientôt."
                : "Aucune speakeuse ne correspond à ta recherche ou à tes filtres."}
            </p>
          )}
        </div>
      </section>
    </>
  );
}

/** Champ de recherche local à l'annuaire (comme celui de l'entête, mais qui
 *  filtre la liste des speakeuses affichées). Contour `field-border`
 *  (#8A83C0, >= 3:1, verrouillé par contrast.test) : lisible et homogène. */
function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="relative flex-1">
      <label htmlFor={id} className="sr-only">
        Rechercher une speakeuse
      </label>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-light"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Un nom, un sujet, un titre de talk..."
        className="w-full bg-navy border border-field-border rounded-full pl-11 pr-4 py-2.5 text-sm text-white placeholder-gray-light outline-none focus-visible:ring-2 focus-visible:ring-cyan transition-colors"
      />
    </div>
  );
}
