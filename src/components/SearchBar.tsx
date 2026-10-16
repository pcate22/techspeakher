"use client";

import { useState, useRef, useEffect, useCallback, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type SearchItem } from "@/data/search-index";
import { FUSE_OPTIONS, buildSearchList, rankResults, type RankedResult } from "@/lib/site-search";
import { chercherReplie } from "@/lib/search-relevance";

type FuseInstance = import("fuse.js").default<SearchItem>;

let fusePromise: Promise<FuseInstance> | null = null;

/**
 * Sources en BASE, récupérées à la 1re recherche : l'annuaire des speakeuses et
 * les contenus éditoriaux publiés. Chacune dégrade seule — une source en panne
 * laisse l'autre et l'index statique servir.
 */
async function fetchSource(url: string): Promise<SearchItem[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    return (await res.json()) as SearchItem[];
  } catch {
    return [];
  }
}

function getFuse(): Promise<FuseInstance> {
  if (!fusePromise) {
    // Les deux sources partent en parallèle : deux allers-retours, une seule
    // attente.
    fusePromise = Promise.all([
      import("fuse.js"),
      fetchSource("/api/search/speakeuses"),
      fetchSource("/api/search/contenus"),
    ])
      .then(
        ([{ default: Fuse }, speakers, contenus]) =>
          new Fuse(buildSearchList([...speakers, ...contenus]), FUSE_OPTIONS),
      )
      .catch((e) => {
        fusePromise = null; // échec d'init → nouvel essai à la prochaine frappe
        throw e;
      });
  }
  return fusePromise;
}

/**
 * Couleur de la pastille. Elle dit la NATURE du résultat, pas sa catégorie —
 * une personne, une question, ou un contenu du site : trois teintes, trois
 * natures. Auparavant huit catégories se partageaient les trois couleurs sans
 * logique lisible, et deux résultats de même teinte n'avaient rien en commun.
 *
 * Elle RENFORCE le mot, elle ne le remplace pas : la catégorie est écrite en
 * toutes lettres et précédée de « Catégorie : » en `sr-only` (RGAA 3.1).
 * Chaque valeur de `CATEGORIES` doit figurer ici, sinon la pastille passe en
 * gris sans que rien n'échoue — `search-bar.test.tsx` le verrouille.
 */
export const categoryColors: Record<string, string> = {
  Speakeuse: "text-magenta-light", // une personne
  FAQ: "text-orange", // une question
  // Un contenu du site : page codée, page éditoriale, ou publication.
  Page: "text-cyan",
  Actualité: "text-cyan",
  "Meetup & Talk": "text-cyan",
  "Behind the Scenes": "text-cyan",
  Tremplin: "text-cyan",
  Communauté: "text-cyan",
  "Conseils de speakeuse": "text-cyan",
};

/**
 * Recherche du site (⌘K) dans un `<dialog>` NATIF (même pattern éprouvé
 * qu'AdminDialog) : page rendue inerte, Échap natif, focus restitué au bouton
 * loupe à la fermeture — l'ancien overlay maison laissait Tab s'échapper vers
 * la page masquée et perdait le focus en fermant.
 *
 * Combobox conforme : l'input garde le focus, les options (li role="option")
 * se parcourent aux flèches via aria-activedescendant et se cliquent
 * directement — pas de bouton imbriqué (interdit, doublait les annonces).
 * La listbox est toujours dans le DOM (aria-controls valide) et le nombre de
 * résultats est annoncé dans une région vivante.
 */
export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RankedResult[]>([]);
  const [selected, setSelected] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  // Deux instances vivent dans le header (desktop + mobile) : id par instance,
  // sinon `search-listbox` était dupliqué sur chaque page (RGAA 8.2).
  const listboxId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchGen = useRef(0);
  const router = useRouter();

  const search = useCallback(async (q: string) => {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      setSelected(-1);
      return;
    }
    const gen = ++searchGen.current;
    // On récupère large, on reclasse (matchs sur un champ visible d'abord),
    // puis on tronque : un résultat qui ne matche que le plein-texte caché ne
    // passe pas devant un résultat dont on voit la raison. La marge (40) évite
    // qu'un match visible mal classé par Fuse soit écarté avant le reclassement.
    let hits: RankedResult[] = [];
    try {
      const fuse = await getFuse();
      if (gen !== searchGen.current) return;
      hits = rankResults(chercherReplie(fuse, q, 40), q, 8);
    } catch {
      if (gen !== searchGen.current) return; // init échouée : aucun résultat
    }
    setResults(hits);
    setSelected(-1);
  }, []);

  const open = useCallback(() => {
    const d = dialogRef.current;
    if (!d) return;
    // jsdom (tests) n'implémente pas showModal : repli sur l'attribut open.
    if (typeof d.showModal === "function") d.showModal();
    else d.setAttribute("open", "");
    inputRef.current?.focus();
  }, []);

  const close = useCallback(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (typeof d.close === "function") d.close(); // restitue le focus (natif)
    else d.removeAttribute("open");
  }, []);

  const navigate = useCallback(
    (item: SearchItem) => {
      close();
      router.push(item.url);
    },
    [router, close],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === "Enter" && selected >= 0 && results[selected]) {
        e.preventDefault();
        navigate(results[selected].item);
      }
      // Échap : géré nativement par <dialog> (évènement close ci-dessous).
    },
    [results, selected, navigate],
  );

  // Ctrl+K / Cmd+K
  useEffect(() => {
    function handleShortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        open();
      }
    }
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [open]);

  return (
    <>
      <button
        onClick={open}
        className="p-2 text-gray-light hover:text-cyan transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
        aria-label="Rechercher (⌘K)"
        aria-haspopup="dialog"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
      </button>

      {/* Positionnement EXPLICITE (comme AdminDialog) : palette centrée en
          haut ; le clic sur le fond (l'élément dialog lui-même) ferme. */}
      <dialog
        ref={dialogRef}
        aria-label="Rechercher sur le site"
        className="fixed inset-x-0 top-[15vh] bottom-auto m-0 mx-auto w-[calc(100%-2rem)] max-w-lg bg-navy border border-navy-lighter rounded-xl p-0 text-white shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm"
        onClose={() => {
          setQuery("");
          setResults([]);
          setSelected(-1);
        }}
        onMouseDown={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-navy-lighter">
          <svg className="w-5 h-5 text-gray-light shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={selected >= 0 ? `${listboxId}-option-${selected}` : undefined}
            aria-autocomplete="list"
            value={query}
            onChange={(e) => search(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher une speakeuse, un article, une page…"
            className="flex-1 bg-transparent text-white placeholder-gray-light outline-none text-sm"
            aria-label="Rechercher sur le site"
          />
          <button
            onClick={close}
            className="text-xs text-gray-light bg-navy-light px-2 py-1 rounded border border-navy-lighter hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            aria-label="Fermer la recherche"
          >
            Esc
          </button>
        </div>

        {/* Toujours dans le DOM : aria-controls pointe une vraie cible. */}
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Résultats de recherche"
          className={results.length > 0 ? "max-h-80 overflow-y-auto py-2" : "hidden"}
        >
          {results.map(({ item, snippet }, i) => (
            // Option de combobox : cliquable directement (pas de bouton
            // imbriqué), parcourue au clavier via aria-activedescendant.
            <li
              key={`${item.url}-${item.title}`}
              id={`${listboxId}-option-${i}`}
              role="option"
              aria-selected={i === selected}
              onMouseEnter={() => setSelected(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // garde le focus sur l'input
                navigate(item);
              }}
              className={`px-4 py-3 flex items-start gap-3 cursor-pointer transition-colors ${
                i === selected ? "bg-navy-lighter" : "hover:bg-navy-light"
              }`}
            >
              <span className={`text-xs font-semibold mt-0.5 shrink-0 ${categoryColors[item.category] || "text-gray-light"}`}>
                {/* Le nom accessible d'une option est la concaténation de son
                    contenu : sans ce complément, « Behind the Scenes Interview
                    de Rachel Dubois » se lit d'un trait. Même motif que la chip
                    de `CarteActualite` (RGAA 3.1). */}
                <span className="sr-only">Catégorie&nbsp;: </span>
                {item.category}
              </span>
              <div className="min-w-0">
                {/* Deux lignes plutôt qu'une troncature : depuis que la pastille
                    porte la catégorie réelle (« Behind the Scenes » pèse large),
                    il restait une vingtaine de caractères au titre sur mobile —
                    deux articles d'une série y devenaient indiscernables. */}
                <p className="text-sm font-medium text-white line-clamp-2">{item.title}</p>
                {/* La date reste une DONNÉE, hors de l'aperçu : fondue dedans,
                    elle deviendrait cherchable et l'extrait surligné pourrait
                    la masquer. `<time>` exige un contenu lisible par la machine,
                    d'où l'attribut (RGAA 8.2). */}
                {item.dateISO && item.date && (
                  <time dateTime={item.dateISO} className="text-xs text-cyan">
                    {item.date}
                  </time>
                )}
                {/* Extrait sur 1-2 lignes montrant le terme trouvé (surligné) :
                    on VOIT pourquoi le résultat remonte, même quand le match
                    vient de la bio ou d'un talk. Repli : aperçu brut. */}
                <p className="text-xs text-gray-light line-clamp-2">
                  {snippet
                    ? snippet.map((seg, j) =>
                        seg.hit ? (
                          // Terme trouvé : fond + gras (indices NON colorimétriques,
                          // RGAA 3.1) en plus de la couleur, pour rester perceptible
                          // en vision daltonienne / à faible contraste.
                          <mark key={j} className="rounded-[3px] bg-cyan/30 px-0.5 font-semibold text-cyan-light">
                            {seg.text}
                          </mark>
                        ) : (
                          <span key={j}>{seg.text}</span>
                        ),
                      )
                    : item.description}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* Nombre de résultats annoncé (les mises à jour de la listbox ne le
            sont pas d'elles-mêmes). */}
        <p role="status" aria-live="polite" className="sr-only">
          {query.length >= 2
            ? `${results.length} résultat${results.length > 1 ? "s" : ""}`
            : ""}
        </p>

        {query.length >= 2 && results.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-light text-center">
            Aucun résultat pour &laquo;&nbsp;{query}&nbsp;&raquo;
          </p>
        )}

        {/* Porte de sortie permanente, HORS de la listbox (qui n'admet que des
            enfants `role="option"`). Elle sert deux silences : la recherche
            vide, et les annonces dont le lien sort du site — écartées de la
            palette (RGAA 13.2), donc introuvables ici alors qu'elles vivent sur
            /actualites. Atteignable au clavier : `handleKeyDown` laisse Tab. */}
        <div className="border-t border-navy-lighter px-4 py-3">
          <Link
            href="/actualites"
            onClick={close}
            className="inline-flex min-h-[44px] items-center text-sm text-cyan underline underline-offset-2 hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
          >
            Voir toutes les actualités
          </Link>
        </div>
      </dialog>
    </>
  );
}
