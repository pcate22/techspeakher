import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import ListPageTemplate from "@/components/ListPageTemplate";
import { requireOrgaPage } from "@/lib/auth-guards";
import { fichesAInviterAAdherer, LOT_INVITATIONS } from "@/lib/annuaire-adhesion";
import { helloassoConfig } from "@/lib/helloasso";
import { nb } from "@/lib/format";
import InviterLot from "./InviterLot";

export const metadata: Metadata = {
  title: "Inviter à adhérer | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

const ALERTE = "text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg px-4 py-3";

/** Ce que l'écran a le droit de dire du dernier envoi. */
function Retour({
  envoi,
  envoyees,
  echecs,
  restantes,
  err,
}: {
  envoi?: string;
  envoyees?: string;
  echecs?: string;
  restantes?: string;
  err?: string;
}) {
  if (envoi === "indisponible")
    return (
      <p role="alert" className={ALERTE}>
        L&apos;envoi d&apos;e-mails est indisponible pour le moment&nbsp;: préviens
        l&apos;équipe technique.
      </p>
    );
  if (envoi === "synchro-absente" || envoi === "synchro-echec")
    return (
      <p role="alert" className={ALERTE}>
        Aucun e-mail envoyé&nbsp;: la relecture des adhésions sur HelloAsso
        {envoi === "synchro-absente" ? " attend ses identifiants" : " a échoué"}. Sans
        elle, des membres à jour recevraient l&apos;invitation. Réessaie dans quelques
        minutes&nbsp;; si l&apos;échec revient, préviens l&apos;équipe technique.
      </p>
    );
  if (envoyees == null) return null;
  const parties = Number(envoyees) || 0;
  const rates = Number(echecs) || 0;
  const reste = Number(restantes) || 0;
  return (
    <p
      role={rates > 0 ? "alert" : "status"}
      className={rates > 0 ? ALERTE : "text-sm text-cyan bg-cyan/10 border border-cyan/30 rounded-lg px-4 py-3"}
    >
      {parties === 0
        ? "Aucune invitation envoyée."
        : `${nb(parties, "invitation")} ${parties > 1 ? "envoyées" : "envoyée"}.`}
      {rates > 0
        ? ` ${nb(rates, "envoi")} en échec\u00a0: ces fiches restent dans la liste.${err ? ` Raison\u00a0: ${err}` : ""}`
        : ""}
      {reste > 0 ? ` Encore ${reste} à inviter\u00a0: clique de nouveau sur «\u00a0Inviter\u00a0».` : ""}
    </p>
  );
}

/**
 * INVITER À ADHÉRER — une question : les fiches en ligne dont la titulaire n'a
 * pas d'adhésion à jour, et pas encore reçu l'invitation (cf.
 * docs/conception-adhesions-helloasso.md § 6). Un rôle, un CTA.
 *
 * La liste affichée vient de la base (dernière synchro) ; au clic, l'action
 * relit HelloAsso avant de choisir à qui écrire.
 */
export default async function InviterAdhererPage({
  searchParams,
}: {
  searchParams: Promise<{
    envoi?: string;
    envoyees?: string;
    echecs?: string;
    restantes?: string;
    err?: string;
  }>;
}) {
  await requireOrgaPage();
  const retour = await searchParams;
  const synchro = helloassoConfig() !== null;
  const fiches = await fichesAInviterAAdherer();

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Adhésions", href: "/admin/adhesions" },
          { label: "Inviter à adhérer" },
        ]}
      />
      <ListPageTemplate
        title="Inviter à adhérer"
        meta="Les fiches en ligne dont la titulaire est encore sans adhésion. L'e-mail annonce l'ouverture des adhésions et dit quelle adresse donner sur HelloAsso. Chacune le reçoit une seule fois."
        create={
          synchro && fiches.length > 0 ? (
            <InviterLot count={fiches.length} lot={LOT_INVITATIONS} />
          ) : undefined
        }
      >
        <Retour {...retour} />
        {!synchro && (
          <p className={ALERTE}>
            La relecture des adhésions sur HelloAsso attend ses identifiants&nbsp;:
            préviens l&apos;équipe technique. L&apos;envoi s&apos;ouvrira ensuite.
          </p>
        )}
        <section aria-labelledby="ainviter-titre">
          <h2 id="ainviter-titre" className="text-sm font-bold text-cream mb-2">
            À inviter ({fiches.length})
          </h2>
          {fiches.length === 0 ? (
            <p className="text-sm text-gray-light">
              Toutes les fiches en ligne sont à jour d&apos;adhésion, ou ont déjà reçu
              l&apos;invitation.
            </p>
          ) : (
            <ul role="list" className="flex flex-col gap-2 list-none">
              {fiches.map((f) => (
                <li
                  key={f.profileId}
                  className="rounded-xl border border-navy-lighter bg-navy-light px-4 py-3 text-white"
                >
                  {f.name?.trim() || f.email}
                </li>
              ))}
            </ul>
          )}
        </section>
      </ListPageTemplate>
    </>
  );
}
