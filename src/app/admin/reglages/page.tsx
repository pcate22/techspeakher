import type { Metadata } from "next";
import { requireOrgaId } from "@/lib/auth-guards";
import Breadcrumb from "@/components/Breadcrumb";
import NavRow from "@/components/NavRow";
import { getReglages, REGLAGE_INFOS, type CleReglage } from "@/lib/reglages";
import { nb } from "@/lib/format";

export const metadata: Metadata = {
  title: "Réglages | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Réglages de la plateforme (lot C4) : SOMMAIRE, une rangée par réglage avec
 * la valeur actuelle en sous-titre ; la modification vit sur la sous-page
 * (une page = une fonction).
 */
export default async function ReglagesPage() {
  await requireOrgaId();
  const reglages = await getReglages();
  const cles = Object.keys(REGLAGE_INFOS) as CleReglage[];

  return (
    <>
      <Breadcrumb
        items={[{ label: "Espace organisatrices", href: "/admin" }, { label: "Réglages" }]}
      />
      <div className="py-10 px-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          <header>
            <h1 className="text-2xl font-bold">Réglages</h1>
            <p className="text-sm text-gray-light mt-1">
              Délais et rappels de la plateforme. Les tableaux de bord s&apos;y
              adaptent immédiatement.
            </p>
          </header>

          <section aria-labelledby="reglages-titre">
            <h2 id="reglages-titre" className="sr-only">
              Réglages disponibles
            </h2>
            <ul role="list" className="flex flex-col gap-2 list-none">
              {cles.map((cle) => (
                <li key={cle}>
                  <NavRow
                    href={`/admin/reglages/${cle}`}
                    title={REGLAGE_INFOS[cle].titre}
                    subtitle={nb(reglages[cle], "jour")}
                  />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
