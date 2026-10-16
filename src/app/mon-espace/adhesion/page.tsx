import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import Breadcrumb from "@/components/Breadcrumb";
import Button from "@/components/Button";
import LienTexte from "@/components/LienTexte";
import { adhesionDuCompte } from "@/lib/adhesions";
import { getProfileByUserId } from "@/lib/profiles";
import { dateRetraitAnnuaire } from "@/lib/annuaire-adhesion";
import { helloassoConfig } from "@/lib/helloasso";
import { DELAI_ADHESION, etatAdhesion, type EtatAdhesion } from "@/lib/adhesion";
import { dateLongueParis } from "@/lib/format";

export const metadata: Metadata = {
  title: "Mon adhésion | Tech Speak'Her",
  robots: { index: false },
  alternates: { canonical: "/mon-espace/adhesion" },
};

export const dynamic = "force-dynamic";

/** Le libellé de l'état (pastille texte, jamais la couleur seule). « Arrêtée »
 *  plutôt que « Close » : le mot se lisait comme l'anglais (revue UX). */
const LIBELLE: Record<EtatAdhesion, string> = {
  active: "Active",
  a_renouveler: "À renouveler",
  echue: "Échue",
  close: "Arrêtée",
};

/** Le CTA, seulement quand il sert : rien pour une adhésion active loin de
 *  son terme ; « de nouveau » quand il n'y a plus rien à renouveler. */
const CTA: Record<EtatAdhesion, string | null> = {
  active: null,
  a_renouveler: "Renouveler mon adhésion",
  echue: "Renouveler mon adhésion",
  close: "Adhérer de nouveau",
};

const CARTE = "rounded-xl border border-navy-lighter bg-navy-light/60 p-5";

/**
 * MON ADHÉSION (demande de Cateline, 2026-10-15) — un rôle : consulter son
 * adhésion. Un CTA, seulement quand il sert. Cf.
 * docs/conception-adhesions-helloasso.md § 5.
 *
 * Chaque phrase n'est dite que là où elle est VRAIE (revue UX du 2026-10-15) :
 * les douze mois qui s'ajoutent ne valent que pour une adhésion HelloAsso en
 * cours, le reçu HelloAsso n'existe pas pour une adhésion saisie par l'équipe.
 * Le montant n'est pas affiché : il n'est pas copié de HelloAsso
 * (minimisation validée le 2026-10-15).
 */
export default async function MonAdhesion() {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");
  // Sans synchro, la page dirait « aucune adhésion » à toutes les membres.
  if (!helloassoConfig()) notFound();

  // L'identité vient de la SESSION, jamais de l'URL.
  const uid = Number(session.user.id);
  const [adhesion, fiche, retraitLe] = await Promise.all([
    adhesionDuCompte(uid),
    getProfileByUserId(uid),
    dateRetraitAnnuaire(uid),
  ]);
  const etat = adhesion ? etatAdhesion(adhesion, new Date()) : null;
  const helloasso = adhesion?.source === "helloasso";
  const enCours = etat === "active" || etat === "a_renouveler";

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Mon espace", href: "/mon-espace" },
          { label: "Mon profil", href: "/mon-espace/profil" },
          { label: "Mon adhésion" },
        ]}
      />
      {/* <div>, pas <main> : le layout racine fournit déjà le landmark principal. */}
      <div className="py-10 px-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          <header className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">Mon adhésion</h1>
            {etat && (
              <span className="rounded-full border border-navy-lighter px-2.5 py-0.5 text-xs font-bold text-gray-light">
                <span className="sr-only">État&nbsp;: </span>
                {LIBELLE[etat]}
              </span>
            )}
          </header>

          {adhesion && etat ? (
            <section aria-labelledby="dates-titre" className={CARTE}>
              <h2 id="dates-titre" className="text-sm font-bold text-cream mb-3">
                Les dates
              </h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-gray-light">Début de l&apos;adhésion</dt>
                <dd className="text-white">{dateLongueParis(adhesion.startedAt)}</dd>
                <dt className="text-gray-light">{enCours ? "Échéance" : "Fin"}</dt>
                <dd className="text-white">
                  {etat === "close"
                    ? helloasso
                      ? "Avant l'échéance prévue (remboursée ou annulée sur HelloAsso)"
                      : "Avant l'échéance prévue"
                    : dateLongueParis(adhesion.expiresAt)}
                </dd>
              </dl>
              <p className="text-sm text-gray-light mt-4">
                {enCours && helloasso
                  ? "Une adhésion vaut douze mois de date à date. Renouveler avant l'échéance est sans perte : les douze mois s'ajoutent à l'échéance en cours."
                  : enCours
                    ? "Une adhésion vaut douze mois de date à date."
                    : "Ta nouvelle adhésion courra douze mois à partir du jour où tu adhères."}
              </p>
              <p className="text-sm text-gray-light mt-2">
                {helloasso
                  ? "Ton reçu et ta confirmation sont dans l'e-mail envoyé par HelloAsso au moment de l'adhésion."
                  : "Cette adhésion a été enregistrée par l'équipe."}
              </p>
            </section>
          ) : (
            <section aria-labelledby="aucune-titre" className={CARTE}>
              <h2 id="aucune-titre" className="text-sm font-bold text-cream mb-3">
                Aucune adhésion reliée à ton compte
              </h2>
              <p className="text-sm text-gray-light">
                Après ton adhésion sur HelloAsso, elle apparaît ici {DELAI_ADHESION}.
              </p>
              <p className="text-sm text-gray-light mt-2">
                Dans le formulaire HelloAsso, dans les informations de l&apos;adhérente
                (même si une autre personne paie), indique l&apos;adresse e-mail de ton
                compte&nbsp;: c&apos;est elle qui relie ton adhésion à ton compte.
              </p>
              <p className="text-sm text-gray-light mt-2">
                Tu as adhéré avec une autre adresse&nbsp;?{" "}
                <LienTexte href="/contact">Écris-nous</LienTexte>&nbsp;: on relie ton
                adhésion à ton compte.
              </p>
            </section>
          )}

          {fiche?.status === "en_pause" && (
            <p className="text-sm text-gray-light">
              Ta fiche est en pause, hors de l&apos;annuaire. Après ton adhésion, elle y
              revient {DELAI_ADHESION}.
            </p>
          )}
          {fiche?.status === "publie" && retraitLe && (
            <p className="text-sm text-gray-light">
              Ta fiche quitte l&apos;annuaire le {dateLongueParis(retraitLe)}. Pour
              qu&apos;elle y reste,{" "}
              {adhesion ? "renouvelle ton adhésion" : "adhère"} avant cette date.
            </p>
          )}

          {(etat === null || CTA[etat]) && (
            <div>
              <Button href="/adherer">{etat ? CTA[etat] : "Adhérer"}</Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
