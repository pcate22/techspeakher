"use client";

import { useState } from "react";
import Link from "next/link";
import CarteActualite from "@/components/CarteActualite";
import FilterChip from "@/components/FilterChip";
import FilterGroup from "@/components/FilterGroup";
import LiveStatus from "@/components/LiveStatus";
import { CATEGORIES } from "@/lib/contenu-form";
import { nb } from "@/lib/format";
// Le DTO vit désormais dans `lib/carte-actu` : l'accueil s'en sert aussi, et un
// composant client n'est pas le bon domicile pour un type calculé côté serveur.
import type { CarteActu } from "@/lib/carte-actu";

const STATUT_LABEL = {
  tout: "Tout",
  publie: "Publié",
  en_relecture: "En relecture",
  brouillon: "Brouillon",
} as const;

/** Libellés d'onglet qui DIFFÈRENT de la catégorie (le reste s'affiche tel quel). */
const CAT_LABEL: Record<string, string> = {
  "Meetup & Talk": "Meetups & Talks",
};

/**
 * Liste unique des actualités. Rendu piloté par les capacités : le public ne
 * voit que le contenu publié ; une orga voit en plus le bouton d'ajout, le
 * filtre Publié/Brouillon, les brouillons (marqués) et un « Modifier » par carte.
 * L'édition vit sur la page dédiée (jamais empilée ici — règle d'or).
 */
export default function ActualitesListe({
  items,
  estOrga,
}: {
  items: CarteActu[];
  estOrga: boolean;
}) {
  const [cat, setCat] = useState<string>("Tout");
  const [statut, setStatut] = useState<keyof typeof STATUT_LABEL>("tout");

  const filtres = ["Tout", ...CATEGORIES];
  const filtered = items.filter((i) => {
    if (cat !== "Tout" && i.categorie !== cat) return false;
    if (estOrga && statut !== "tout" && i.statut !== statut) return false;
    return true;
  });

  // Le compte SEUL ne suffit pas : passer d'un filtre à un autre qui rend le même
  // nombre laisse le texte identique, donc le DOM inchangé, donc rien d'annoncé.
  // Nommer le filtre actif fait la différence (même gabarit que `RosterFilter`).
  const resume =
    nb(filtered.length, "actualité") +
    (cat !== "Tout" ? ` en ${CAT_LABEL[cat] ?? cat}` : "") +
    (estOrga && statut !== "tout" ? ` au statut ${STATUT_LABEL[statut]}` : "");

  return (
    <section className="py-12 px-4" aria-label="Liste des actualités">
      <div className="max-w-4xl mx-auto">
        {estOrga && (
          <div className="mb-8 flex flex-col gap-4 rounded-xl border border-navy-lighter bg-navy-light/50 px-4 py-3">
            {/* Vue d'abord (mode de vue), puis le CTA d'ajout. Ce sont des
                filtres, pas des onglets : `role="tab"` promettait une navigation
                aux flèches et un `tabpanel` absents (RGAA 7.1 / 7.3). */}
            <FilterGroup
              label="Filtrer par statut"
              className="flex gap-1 border-b border-navy-lighter"
            >
              {(Object.keys(STATUT_LABEL) as (keyof typeof STATUT_LABEL)[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={statut === s}
                  onClick={() => setStatut(s)}
                  className={`min-h-[44px] px-4 text-sm font-medium -mb-px border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded-t transition-colors ${
                    statut === s
                      ? "border-cyan text-cyan"
                      : "border-transparent text-gray-light hover:text-white"
                  }`}
                >
                  {STATUT_LABEL[s]}
                </button>
              ))}
            </FilterGroup>
            <Link
              href="/admin/contenus/publication/nouveau"
              className="inline-flex items-center self-start min-h-[44px] rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-navy hover:bg-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            >
              + Nouvel article
            </Link>
          </div>
        )}

        <FilterGroup label="Filtrer par catégorie" className="flex flex-wrap gap-2 mb-6 justify-center">
          {filtres.map((f) => (
            <FilterChip
              key={f}
              active={cat === f}
              aria-pressed={cat === f}
              onClick={() => setCat(f)}
            >
              {CAT_LABEL[f] ?? f}
            </FilterChip>
          ))}
        </FilterGroup>

        {/* Remplace l'`aria-live` qui était posé sur la liste, et qui faisait
            réénoncer toutes les cartes à chaque filtre. */}
        <LiveStatus>{resume}</LiveStatus>

        <ul className="space-y-6 list-none" role="list">
          {filtered.map((item) => (
            <li key={item.slug}>
              {/* Carte partagée avec l'extrait de l'accueil : une seule règle de
                  destination, de chip et d'intitulé accessible. */}
              <CarteActualite carte={item} headingLevel="h2" estOrga={estOrga} />
            </li>
          ))}
        </ul>

        {/* Deux vides distincts : le site n'a rien à montrer, ou ce filtre-là ne
            ramène rien alors que le contenu existe à un clic. */}
        {filtered.length === 0 && (
          <p className="text-center text-gray-light py-8">
            {items.length > 0
              ? "Aucune actualité dans cette vue."
              : estOrga
                ? "Aucun contenu ici. Ajoute un article avec le bouton ci-dessus."
                : "Les actualités arrivent bientôt."}
          </p>
        )}
      </div>
    </section>
  );
}
