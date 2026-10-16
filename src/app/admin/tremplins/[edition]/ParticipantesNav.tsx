"use client";

import { useId, useState } from "react";
import NavRow from "@/components/NavRow";
import FilterChip from "@/components/FilterChip";
import FilterGroup from "@/components/FilterGroup";
import LiveStatus from "@/components/LiveStatus";
import ListeSection from "@/components/ListeSection";
import { nb } from "@/lib/format";
import { foldRecherche } from "@/lib/normalise-recherche";
import { inputCls } from "./styles";

export interface ParticipanteNavItem {
  id: number;
  href: string;
  nom: string;
  /** Ce qu'elle pitche, son rang, ou ce qui manque — en MOTS (cf. la règle
   * KISS ci-dessous : rien à décoder). */
  sousTitre: string;
  /** Clés des phases où elle participe (une personne peut en avoir plusieurs). */
  phaseKeys: string[];
}

export interface PhaseFiltre {
  key: string;
  /** Libellé de la chip ET équivalent parlé de la pastille : court, sans sigle
   * (« Phase 1 », pas « Phase 1 · CFP » — trois chips longues faisaient trois
   * rangées sur un téléphone, et le « · » interne se confondait avec le
   * séparateur de la page). */
  titre: string;
  /** Abrégé de la pastille de ligne (« P1 », « Fin », « P3 »). */
  court: string;
}

/**
 * Liste des participantes : une personne = UNE ligne (lot D, refonte §5). Les
 * sections par phase tripliquaient les mêmes personnes (22 cartes pour 10
 * inscrites en prod) ; les phases deviennent des pastilles sur la ligne, et un
 * jeu de FILTRES (chips) laisse se concentrer sur une phase.
 *
 * KISS — UN SEUL indicateur par ligne : le parcours (« P1·Fin·P3 »). Les quatre
 * pictogrammes d'état (✓ ● ★ 🏆) et leur légende ont sauté, chacun pour une
 * raison :
 * - « compte relié » ne dit rien quand il est là ; c'est son ABSENCE qui appelle
 *   une action, et elle s'écrit en mots dans le sous-titre ;
 * - « finaliste » est déjà dans le parcours (la pastille « Fin ») ;
 * - le podium mérite des MOTS (« 1ᵉʳ prix »), pas un trophée à décoder ;
 * - « visible du public » est un consentement qu'on ne scanne pas ligne à
 *   ligne : il est compté en tête de page et se règle sur sa fiche.
 *
 * RGAA : les chips passent par `FilterChip` (contour `field-border` lisible,
 * état actif inversé et non teinté, cible ≥ 44 px) avec `aria-pressed` (l'état
 * est dit, pas seulement coloré) ; le résultat du filtre est annoncé par une
 * région vivante PERMANENTE (montée avec son texte, une live region n'est pas
 * annoncée) ; les abréviations de phase portent leur équivalent complet en
 * `sr-only`.
 */
export default function ParticipantesNav({
  items,
  sections,
}: {
  items: ParticipanteNavItem[];
  sections: PhaseFiltre[];
}) {
  const [filtre, setFiltre] = useState("");
  const [phase, setPhase] = useState<string | null>(null);
  const filterId = useId();
  const titreId = useId();
  const requete = filtre.trim();

  const parNom = requete
    ? items.filter((i) => foldRecherche(i.nom).includes(foldRecherche(requete)))
    : items;
  const visibles = phase ? parNom.filter((i) => i.phaseKeys.includes(phase)) : parNom;

  const chips = [
    { key: null as string | null, titre: "Toutes", n: parNom.length },
    ...sections.map((s) => ({
      key: s.key,
      titre: s.titre,
      n: parNom.filter((i) => i.phaseKeys.includes(s.key)).length,
    })),
  ];

  const phaseActive = sections.find((s) => s.key === phase);
  const courtDe = (keys: string[]) =>
    sections.filter((s) => keys.includes(s.key)).map((s) => s.court);
  const longDe = (keys: string[]) =>
    sections.filter((s) => keys.includes(s.key)).map((s) => s.titre);

  // Le titre dit une VUE, pas un chiffre d'édition : « 2 en Phase 3, sur 8 ».
  const resume = [
    phaseActive ? `${visibles.length} en ${phaseActive.titre}` : nb(visibles.length, "inscrite"),
    requete && `pour «\u00a0${filtre}\u00a0»`,
    visibles.length < items.length && `sur ${items.length}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4">
      {/* Filtres de phase : une personne peut être dans plusieurs, on choisit
          l'angle de lecture au lieu de la voir se répéter. */}
      <FilterGroup label="Filtrer par phase" className="flex flex-wrap gap-2">
        {chips.map((c) => {
          const actif = phase === c.key;
          return (
            <FilterChip
              key={c.key ?? "toutes"}
              active={actif}
              aria-pressed={actif}
              onClick={() => setPhase(c.key)}
            >
              {c.titre}{" "}
              <span className={actif ? "text-navy/80" : "text-gray-light"}>({c.n})</span>
            </FilterChip>
          );
        })}
      </FilterGroup>

      {items.length > 5 && (
        <div>
          <label htmlFor={filterId} className="sr-only">
            Filtrer les participantes par nom
          </label>
          <input
            id={filterId}
            type="search"
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            placeholder="Filtrer par nom…"
            className={inputCls}
          />
        </div>
      )}

      {/* Le titre ci-dessous porte le même résumé, mais un titre ne s'annonce
          pas quand il change : c'est cette région qui le fait. */}
      <LiveStatus>{resume}</LiveStatus>

      <ListeSection id={titreId} titre={resume}>
        {visibles.length === 0 ? (
          <li className="text-sm text-gray-light">
            {requete && phaseActive
              ? `Aucune participante en ${phaseActive.titre} ne correspond à «\u00a0${filtre}\u00a0».`
              : requete
                ? `Aucune participante ne correspond à «\u00a0${filtre}\u00a0».`
                : phaseActive
                  ? "Aucune participante dans cette phase."
                  : "Aucune participante inscrite."}
            {(phaseActive || requete) && (
              <button
                type="button"
                onClick={() => {
                  setPhase(null);
                  setFiltre("");
                }}
                className="ml-2 rounded text-cyan underline underline-offset-2 hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
              >
                Voir toutes les inscrites
              </button>
            )}
          </li>
        ) : (
          visibles.map((i) => (
            <li key={i.id}>
              <NavRow
                href={i.href}
                title={i.nom}
                subtitle={i.sousTitre}
                badgesLabel={longDe(i.phaseKeys).join(", ")}
                trailing={
                  i.phaseKeys.length > 0 ? (
                    // Seul indicateur restant de la ligne : il se lit, donc il
                    // est en blanc — pas dans le gris le plus pâle de la page.
                    <span
                      aria-hidden="true"
                      className="block text-xs font-medium tabular-nums text-white"
                    >
                      {courtDe(i.phaseKeys).join("·")}
                    </span>
                  ) : undefined
                }
              />
            </li>
          ))
        )}
      </ListeSection>
    </div>
  );
}
