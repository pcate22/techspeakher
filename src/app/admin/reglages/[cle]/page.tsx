import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgaId } from "@/lib/auth-guards";
import Breadcrumb from "@/components/Breadcrumb";
import InlineActionForm from "@/components/InlineActionForm";
import {
  getReglages,
  REGLAGE_INFOS,
  REGLAGES_DEFAUT,
  REGLAGE_MIN,
  REGLAGE_MAX,
  type CleReglage,
} from "@/lib/reglages";
import { setReglageAction } from "../actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cle: string }>;
}): Promise<Metadata> {
  const { cle } = await params;
  const infos = Object.hasOwn(REGLAGE_INFOS, cle)
    ? REGLAGE_INFOS[cle as CleReglage]
    : null;
  return {
    title: `${infos?.titre ?? "Réglage"} | Tech Speak'Her`,
    robots: { index: false },
  };
}

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction (lot C4) : UN réglage, un champ, un bouton. */
export default async function ReglagePage({
  params,
}: {
  params: Promise<{ cle: string }>;
}) {
  await requireOrgaId();
  const { cle: cleBrute } = await params;
  // Object.hasOwn : `in` accepterait les clés du prototype (toString…).
  if (!Object.hasOwn(REGLAGE_INFOS, cleBrute)) notFound();
  const cle = cleBrute as CleReglage;

  const reglages = await getReglages();
  const infos = REGLAGE_INFOS[cle];

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Réglages", href: "/admin/reglages" },
          { label: infos.titre },
        ]}
      />
      <div className="py-10 px-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          <header>
            <h1 className="text-2xl font-bold">{infos.titre}</h1>
            <p className="text-sm text-gray-light mt-1">
              {infos.description} Par défaut&nbsp;: {REGLAGES_DEFAUT[cle]} jours
              (entre {REGLAGE_MIN} et {REGLAGE_MAX}).
            </p>
          </header>

          <InlineActionForm
            action={setReglageAction}
            hidden={{ cle }}
            fields={[
              {
                kind: "input",
                name: "valeur",
                label: "Nombre de jours",
                type: "number",
                required: true,
                defaultValue: String(reglages[cle]),
                min: String(REGLAGE_MIN),
                max: String(REGLAGE_MAX),
                step: "1",
              },
            ]}
            variant="primary"
            submitLabel="Enregistrer le réglage"
            pendingLabel="Enregistrement…"
            successMessage="Réglage enregistré."
          />

          <p>
            <Link
              href="/admin/reglages"
              className="inline-block py-2 -my-2 text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
            >
              ← Retour aux réglages
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
