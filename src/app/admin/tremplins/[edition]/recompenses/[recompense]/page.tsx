import type { Metadata } from "next";
import { requireOrgaId } from "@/lib/auth-guards";
import NavRow from "@/components/NavRow";
import { loadRecompenseOrNotFound } from "@/lib/tremplin-admin";
import { RECOMPENSE_STATUT_LABEL } from "@/lib/tremplin-recompenses";
import SujetEntete from "../../SujetEntete";

export const metadata: Metadata = {
  title: "Récompense | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Rang de podium → libellé court (« podium 1ʳᵉ »), ou null. */
function rangLabel(rang: number | null): string | null {
  if (rang === null) return null;
  return `podium ${rang === 1 ? "1ʳᵉ" : `${rang}ᵉ`}`;
}

/**
 * HUB d'une récompense (« une page = une fonction ») : une rangée par fonction
 * avec l'état en sous-titre, chaque formulaire sur sa sous-page. Le sujet
 * (l'intitulé) est le titre, « Récompense » le surtitre — on sait qu'on est sur
 * une récompense, et laquelle.
 */
export default async function HubRecompense({
  params,
}: {
  params: Promise<{ edition: string; recompense: string }>;
}) {
  await requireOrgaId();
  const { edition, recompense } = await params;
  const { editionId, recompense: rec } = await loadRecompenseOrNotFound(
    edition,
    recompense,
  );
  const base = `/admin/tremplins/${editionId}/recompenses/${rec.id}`;
  const rang = rangLabel(rec.rang);

  const rangees = [
    {
      href: `${base}/intitule`,
      title: "Intitulé et rang",
      subtitle: [rec.detail, rang].filter(Boolean).join(" · ") || "Renseigner l'intitulé, le détail, le rang",
    },
    {
      href: `${base}/beneficiaire`,
      title: "Bénéficiaire",
      subtitle: rec.beneficiaireNom ?? "Pas encore attribuée",
      flag: !rec.beneficiaireNom,
    },
    {
      href: `${base}/suivi`,
      title: "Suivi de l'événement",
      subtitle: RECOMPENSE_STATUT_LABEL[rec.statut],
    },
    {
      href: `${base}/retrait`,
      title: "Suppression",
      subtitle: "À réserver aux erreurs de saisie",
      danger: true,
    },
  ];

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <SujetEntete surtitre="Récompense" titre={rec.intitule}>
          {[rang, RECOMPENSE_STATUT_LABEL[rec.statut], rec.beneficiaireNom ? `🏆 ${rec.beneficiaireNom}` : "Pas encore attribuée"]
            .filter(Boolean)
            .join(" · ")}
        </SujetEntete>

        <section aria-labelledby="fonctions-titre">
          <h2 id="fonctions-titre" className="sr-only">
            Réglages de la récompense
          </h2>
          <ul role="list" className="flex flex-col gap-2 list-none">
            {rangees.map((row) => (
              <li key={row.href}>
                <NavRow
                  href={row.href}
                  title={row.title}
                  subtitle={row.subtitle}
                  flag={row.flag}
                  tone={row.danger ? "danger" : undefined}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
