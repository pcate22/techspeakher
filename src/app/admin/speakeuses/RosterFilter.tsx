"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import FilterChip from "@/components/FilterChip";
import FilterGroup from "@/components/FilterGroup";
import LiveStatus from "@/components/LiveStatus";
import { formatDateFr, nb } from "@/lib/format";
import { statusLabel, PROFILE_STATUSES } from "@/lib/profile-status";
import type { ProfileStatus } from "@/lib/profiles";

/** Sous-ensemble sérialisable d'une fiche pour le suivi orga (pas de bio, tags…
 *  inutiles ici : on n'envoie au client que ce qu'affiche la liste). */
export type RosterProfile = {
  id: number;
  /** Calculé au bord (mapRow) : jamais vide. */
  nomAffiche: string;
  image: string | null;
  status: ProfileStatus;
  updatedAt: string | null;
  validatedAt: string | null;
};

/** Pastille de statut (couleur + libellé). */
const STATUS_CLS: Record<ProfileStatus, string> = {
  brouillon: "bg-gray-light/15 text-gray-light border-gray-light/30",
  en_attente: "bg-orange/15 text-orange border-orange/40",
  publie: "bg-cyan/15 text-cyan border-cyan/40",
  refuse: "bg-magenta/15 text-magenta-light border-magenta/40",
  masque: "bg-gray-light/10 text-gray-light border-gray-light/30",
  en_pause: "bg-gray-light/10 text-gray-light border-gray-light/30",
};

function StatusBadge({ status }: { status: ProfileStatus }) {
  return (
    <span
      className={`inline-block text-[11px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 ${STATUS_CLS[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}

/** Ordre d'affichage des vues : les plus actionnables d'abord (les fiches en
 *  attente de validation en tête). */
const VIEW_ORDER = [
  "en_attente",
  "publie",
  "brouillon",
  "refuse",
  "masque",
  "en_pause",
] as const satisfies readonly ProfileStatus[];

export default function RosterFilter({
  profiles,
}: {
  profiles: RosterProfile[];
}) {
  const [view, setView] = useState<ProfileStatus | "tout">("tout");

  // Compteurs par statut (pour les libellés des onglets).
  const counts = useMemo(() => {
    const c = {} as Record<ProfileStatus, number>;
    for (const s of PROFILE_STATUSES) c[s] = 0;
    for (const p of profiles) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [profiles]);

  // Onglets : « Toutes » puis chaque statut réellement présent.
  const tabs: { key: ProfileStatus | "tout"; label: string; count: number }[] = [
    { key: "tout", label: "Toutes", count: profiles.length },
    ...VIEW_ORDER.filter((s) => counts[s] > 0).map((s) => ({
      key: s,
      label: statusLabel(s),
      count: counts[s],
    })),
  ];

  const filtered =
    view === "tout" ? profiles : profiles.filter((p) => p.status === view);

  return (
    <div>
      <FilterGroup label="Filtrer les fiches par statut" className="flex flex-wrap gap-2 mb-4">
        {tabs.map((t) => (
          <FilterChip
            key={t.key}
            active={view === t.key}
            aria-pressed={view === t.key}
            onClick={() => setView(t.key)}
          >
            {t.label}{" "}
            <span className={view === t.key ? "text-navy/80" : "text-gray-light"}>
              ({t.count})
            </span>
          </FilterChip>
        ))}
      </FilterGroup>

      {/* Le filtre actif est NOMMÉ : deux vues au même effectif donneraient
          sinon le même texte, donc un DOM inchangé, donc aucune annonce. */}
      <LiveStatus>
        {nb(filtered.length, "fiche")}
        {view !== "tout" ? ` au statut ${statusLabel(view)}` : ""}
      </LiveStatus>

      {filtered.length === 0 ? (
        <p className="text-gray-light">Aucune fiche dans cette vue.</p>
      ) : (
        <ul className="flex flex-col gap-3 list-none">
          {filtered.map((p) => {
            const nom = p.nomAffiche;
            const updated = formatDateFr(p.updatedAt);
            const validated = formatDateFr(p.validatedAt);
            return (
              <li key={p.id}>
                <Link
                  href={`/speakeuses/${p.id}`}
                  className="flex items-center justify-between gap-3 bg-navy-light border border-navy-lighter rounded-xl px-5 py-4 hover:border-cyan/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan transition-colors"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Avatar name={nom} image={p.image} size="md" />
                    <span className="min-w-0">
                      <span className="block font-bold text-white truncate">{nom}</span>
                      <span className="block mt-1">
                        <StatusBadge status={p.status} />
                      </span>
                      <span className="block text-xs text-gray-light mt-1">
                        {p.status === "publie" && validated ? `Validée le ${validated} · ` : ""}
                        {updated ? `Modifiée le ${updated}` : "Jamais modifiée"}
                      </span>
                    </span>
                  </span>
                  <span className="text-cyan text-sm shrink-0">
                    Ouvrir <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
