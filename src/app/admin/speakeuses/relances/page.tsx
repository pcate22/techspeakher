import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import ListPageTemplate from "@/components/ListPageTemplate";
import NavRow from "@/components/NavRow";
import Avatar from "@/components/Avatar";
import { requireOrgaPage } from "@/lib/auth-guards";
import { getProfilesEnSommeil } from "@/lib/profiles";
import { getReglages } from "@/lib/reglages";
import { chantiersRestants } from "@/lib/relance-email";
import { formatDateFr, nb } from "@/lib/format";
import RelancerLot from "./RelancerLot";

export const metadata: Metadata = {
  title: "Relances | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Ce que l'écran a le droit de dire du dernier envoi. */
function Retour({
  envoyees,
  echecs,
  envoi,
  err,
}: {
  envoyees?: string;
  echecs?: string;
  envoi?: string;
  err?: string;
}) {
  const rates = Number(echecs) || 0;
  const parties = Number(envoyees) || 0;

  if (envoi === "indisponible") {
    return (
      <p
        role="alert"
        className="text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg px-4 py-3"
      >
        L&apos;envoi d&apos;e-mails est indisponible pour le moment&nbsp;: préviens
        l&apos;équipe technique.
      </p>
    );
  }
  if (rates > 0) {
    return (
      <p
        role="alert"
        className="text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg px-4 py-3"
      >
        {nb(rates, "relance")} {rates > 1 ? "sont restées" : "est restée"} en
        route{parties > 0 ? `, ${nb(parties, "autre")} ${parties > 1 ? "sont parties" : "est partie"}` : ""}.
        {err
          ? ` Raison : ${err}`
          : " Les fiches concernées restent dans la liste : réessaie, puis préviens l'équipe technique."}
      </p>
    );
  }
  if (envoyees != null && parties > 0) {
    return (
      <p
        role="status"
        className="text-sm text-cyan bg-cyan/10 border border-cyan/30 rounded-lg px-4 py-3"
      >
        {nb(parties, "relance")} {parties > 1 ? "envoyées" : "envoyée"}.
      </p>
    );
  }
  return null;
}

/**
 * RELANCES — la page qui traite UNE question : les fiches restées en brouillon,
 * dont rien n'a bougé depuis le délai réglé (cf.
 * `docs/conception-relance-brouillons.md`).
 *
 * Elle vit à part de `/admin/speakeuses`, qui est une page de CONSULTATION du
 * fichier des fiches : y ajouter un second envoi groupé l'aurait transformée en
 * empilement d'actions (principes UI, règle d'or). Ici, un rôle, un CTA.
 *
 * Chaque ligne mène à la fiche, où l'orga peut relancer cette personne seule,
 * la lire, ou la publier. La page ne porte donc aucun geste par ligne.
 */
export default async function RelancesPage({
  searchParams,
}: {
  searchParams: Promise<{
    envoyees?: string;
    echecs?: string;
    envoi?: string;
    err?: string;
  }>;
}) {
  await requireOrgaPage();

  const { envoyees, echecs, envoi, err } = await searchParams;
  const reglages = await getReglages();
  const jours = reglages.relance_brouillon_jours;
  const fiches = await getProfilesEnSommeil(jours);

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Speakeuses", href: "/admin/speakeuses" },
          { label: "Relances" },
        ]}
      />
      <ListPageTemplate
        title="Relances"
        meta={`Les fiches restées en brouillon, sans changement depuis plus de ${nb(jours, "jour")}. L'e-mail dit à chacune ce qu'il lui reste à faire pour rejoindre l'annuaire.`}
        create={fiches.length > 0 ? <RelancerLot count={fiches.length} /> : undefined}
      >
        <Retour envoyees={envoyees} echecs={echecs} envoi={envoi} err={err} />

        <section aria-labelledby="sommeil-titre">
          <h2
            id="sommeil-titre"
            className="text-xs font-bold uppercase tracking-wide text-gray-light mb-2"
          >
            En sommeil ({fiches.length})
          </h2>
          {fiches.length === 0 ? (
            <p className="text-sm text-gray-light">
              Rien à relancer&nbsp;: les fiches en brouillon ont toutes bougé dans
              les {nb(jours, "jour")}, ou ont déjà reçu un message récemment.
            </p>
          ) : (
            <ul role="list" className="flex flex-col gap-2 list-none">
              {fiches.map(({ profile, talksCount, lastReminderAt }) => {
                const restants = chantiersRestants(profile, talksCount);
                const nom = profile.nomAffiche;
                const depuis = formatDateFr(profile.updatedAt);
                const relancee = formatDateFr(lastReminderAt);
                return (
                  <li key={profile.id}>
                    <NavRow
                      href={`/speakeuses/${profile.id}`}
                      leading={<Avatar name={nom} image={profile.image} size="md" />}
                      title={nom}
                      titleClamp={2}
                      subtitle={
                        <>
                          {restants.length > 0
                            ? `Il reste ${nb(restants.length, "étape")} : ${restants.join(", ").toLowerCase()}`
                            : "Fiche complète, il reste à la soumettre"}
                          {depuis ? ` · en l'état depuis le ${depuis}` : ""}
                          {relancee ? ` · déjà relancée le ${relancee}` : ""}
                        </>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </ListPageTemplate>
    </>
  );
}
