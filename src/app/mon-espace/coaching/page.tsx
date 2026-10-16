import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCoachId } from "@/lib/auth-guards";
import Breadcrumb from "@/components/Breadcrumb";
import { getCoachEditions } from "@/lib/tremplin-coachs";

export const metadata: Metadata = {
  title: "Mes coachings | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Liste des missions d'animation / coaching du compte connecté.
 *
 * Une seule mission — le cas courant — n'est pas un CHOIX : cette page n'était
 * alors qu'un péage d'un tap avant le travail réel, avec une unique rangée
 * « Tremplin 2026 · 4 ateliers ». L'onglet Coaching mène donc directement à
 * l'espace de l'édition, et cette liste ne s'affiche que là où il y a vraiment à
 * choisir. Même principe que « Mes documents », qui n'a jamais fait choisir une
 * édition : aucune page de l'espace n'existe pour désigner une édition.
 */
export default async function MesCoachings() {
  const coachId = await requireCoachId();
  const missions = await getCoachEditions(coachId);
  if (missions.length === 1) redirect(`/mon-espace/coaching/${missions[0].editionId}`);

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Mon espace", href: "/mon-espace" },
          { label: "Mes coachings" },
        ]}
      />
      <div className="py-10 px-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          <header>
            <h1 className="text-2xl font-bold">Mes coachings</h1>
            <p className="text-sm text-gray-light mt-1">
              Les éditions du Tremplin où tu animes un atelier ou accompagnes
              une participante.
            </p>
          </header>

          {missions.length === 0 ? (
            <p className="text-sm text-gray-light">
              Aucune mission pour l&apos;instant. Les organisatrices t&apos;assignent
              un atelier ou une participante, et tout apparaît ici.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 list-none">
              {missions.map((m) => (
                <li key={m.editionId}>
                  <Link
                    href={`/mon-espace/coaching/${m.editionId}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-navy-lighter bg-navy-light px-5 py-4 hover:border-cyan/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{m.nom}</span>
                      <span className="block text-xs text-gray-light">
                        {[
                          m.nbAteliers > 0 &&
                            `${m.nbAteliers} atelier${m.nbAteliers > 1 ? "s" : ""}`,
                          m.nbCoachees > 0 &&
                            `${m.nbCoachees} coachée${m.nbCoachees > 1 ? "s" : ""}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="text-cyan shrink-0" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
