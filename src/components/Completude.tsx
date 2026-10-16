"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  grouperAFaire,
  SEUIL_REGROUPEMENT,
  type Chantier,
  type GroupeCle,
} from "@/lib/completude";

/** Clé navigateur : chantiers d'enrichissement masqués (« plus tard »). */
export const CHANTIERS_MASQUES_KEY = "tsh:chantiers-masques";

/** Icône thématique par groupe (jamais de numéro : ce n'est pas un stepper). */
const ICONE: Record<GroupeCle, string> = {
  profil: "👤",
  domaines: "🧭",
  localisation: "📍",
  contact: "🔗",
  attestation: "🛡️",
  talks: "🎤",
  annuaire: "📣",
};

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getRaw(): string {
  try {
    return localStorage.getItem(CHANTIERS_MASQUES_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parseMasques(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function masquer(key: string, actuels: string[]) {
  const next = Array.from(new Set([...actuels, key]));
  try {
    localStorage.setItem(CHANTIERS_MASQUES_KEY, JSON.stringify(next));
  } catch {
    // pas de persistance possible (mode privé strict…) : sans effet.
  }
  listeners.forEach((l) => l());
}

const rowBase =
  "flex flex-1 items-center gap-3 rounded-xl border bg-navy px-3.5 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan";
const tileBase =
  "w-9 h-9 shrink-0 rounded-xl grid place-items-center text-base";

function Tuile({ icone, accent }: { icone: string; accent: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`${tileBase} ${accent ? "bg-magenta" : "bg-navy-lighter"}`}
    >
      {icone}
    </span>
  );
}

/**
 * Complétude de la fiche — mécanique UNIQUE d'incitation, identique pour une
 * nouvelle inscrite et une fiche publiée : on n'affiche que ce qu'il RESTE à
 * faire (jamais un mur de coches vertes). Le nombre à faire pilote la forme :
 * - beaucoup (> {@link SEUIL_REGROUPEMENT}) → regroupé par étape du profil, une
 *   icône thématique + un compteur « N champs » (surtout PAS un numéro : ce
 *   n'est pas un stepper) ;
 * - peu → à plat, une ligne par chantier ; la première étape requise porte
 *   « Commencer », les enrichissements facultatifs un « Plus tard » masquable.
 */
export default function Completude({ chantiers }: { chantiers: Chantier[] }) {
  const raw = useSyncExternalStore(subscribe, getRaw, () => "[]");
  const masques = parseMasques(raw);

  // « Soumis à l'annuaire » est l'action finale (portée par le CTA du parent).
  const pertinents = chantiers.filter((c) => c.groupe !== "annuaire");
  const visibles = pertinents.filter(
    (c) => !(c.optionnel && masques.includes(c.key)),
  );
  const aFaire = visibles.filter((c) => !c.done);
  if (aFaire.length === 0) return null;

  if (aFaire.length > SEUIL_REGROUPEMENT) {
    const groupes = grouperAFaire(aFaire);
    return (
      <ul className="flex flex-col gap-2 list-none" role="list">
        {groupes.map((g) => {
          const n = g.chantiers.length;
          return (
            <li key={g.groupe} className="flex">
              <Link
                href={g.href ?? "/mon-espace/fiche"}
                className={`${rowBase} border-navy-lighter hover:border-cyan/40`}
              >
                <Tuile icone={ICONE[g.groupe]} accent={false} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium truncate">{g.label}</span>
                  <span className="block text-xs text-gray-light line-clamp-2">
                    {g.chantiers.map((c) => c.label).join(" · ")}
                  </span>
                </span>
                {n > 1 && (
                  <span className="shrink-0 text-xs font-semibold text-gray-light border border-navy-lighter rounded-full px-2 py-0.5">
                    {n} champs
                  </span>
                )}
                <span aria-hidden="true" className="shrink-0 text-field text-base ml-1">
                  ›
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  // À plat : la première étape REQUISE est mise en avant (« Commencer »).
  const idxPremierRequis = aFaire.findIndex((c) => !c.optionnel);
  return (
    <ul className="flex flex-col gap-2 list-none" role="list">
      {aFaire.map((c, i) => {
        const estNext = i === idxPremierRequis;
        return (
          <li key={c.key} className="flex items-stretch gap-2">
            <Link
              href={c.href ?? "/mon-espace/fiche"}
              className={`${rowBase} ${estNext ? "border-magenta/50 hover:border-magenta" : "border-navy-lighter hover:border-cyan/40"}`}
            >
              <Tuile icone={ICONE[c.groupe]} accent={estNext} />
              <span className="min-w-0 flex-1">
                <span className={`block font-medium truncate ${estNext ? "text-magenta-light" : ""}`}>
                  {c.label}
                </span>
                {c.hint && (
                  <span className="block text-xs text-gray-light line-clamp-2">{c.hint}</span>
                )}
              </span>
              {estNext && (
                <span className="shrink-0 text-xs font-bold text-magenta-light border border-magenta/50 rounded-full px-2 py-0.5">
                  Commencer
                </span>
              )}
              <span aria-hidden="true" className="shrink-0 text-field text-base ml-1">
                ›
              </span>
            </Link>
            {c.optionnel && (
              <button
                type="button"
                onClick={() => masquer(c.key, masques)}
                className="shrink-0 px-3 rounded-xl border border-navy-lighter text-xs text-field hover:text-white hover:border-field focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
              >
                Plus tard
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
