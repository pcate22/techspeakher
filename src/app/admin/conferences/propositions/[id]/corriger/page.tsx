import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrgaPage } from "@/lib/auth-guards";
import { getPropositionEnAttente } from "@/lib/conference-propositions";
import { getRegistreIndex } from "@/lib/talks";
import { rapprocher, voisines } from "@/lib/proposition-rapprochement";
import { idDepuis } from "@/lib/id-url";
import { formatTalkDate } from "@/lib/talk-date";
import Breadcrumb from "@/components/Breadcrumb";
import InlineActionForm from "@/components/InlineActionForm";
import LienRetour from "@/components/LienRetour";
import Button from "@/components/Button";
import { updatePropositionAction, reprendreNomAction } from "../../../actions";

export const metadata: Metadata = {
  title: "Corriger une conférence proposée | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Corriger une proposition AVANT de la valider — la troisième porte qui
 * manquait (`docs/conception-arbitrage-conferences.md`, défaut D) : valider
 * écrivait tel quel, écarter laissait la saisie hors ligne, et le message de
 * conflit d'endpoint disait pourtant « corrige-le » en pointant un écran qui
 * n'existait pas.
 *
 * Un rôle, un CTA, reste EN PLACE. Le nom corrigé est celui qui entrera au
 * répertoire : c'est aussi par lui qu'on RATTACHE une proposition à une
 * conférence déjà référencée — reprendre son nom exact suffit, la promotion
 * retombe alors sur elle au lieu d'en créer une seconde. Aucune action de plus
 * pour ce geste, donc aucune porte d'écriture de plus.
 */
export default async function CorrigerPropositionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOrgaPage();
  const propositionId = idDepuis((await params).id);
  if (propositionId === null) notFound();

  const p = await getPropositionEnAttente(propositionId);
  if (!p) notFound();

  const repertoire = await getRegistreIndex().catch(() => []);
  const rapprochement = rapprocher(p, repertoire);
  // Les noms canoniques, dits ICI — sur l'écran où l'on tape — plutôt qu'à
  // retenir de la page d'avant.
  const canoniques = voisines(rapprochement);

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Conférences", href: "/admin/conferences" },
          { label: "Conférences proposées", href: "/admin/conferences/propositions" },
          { label: p.nom, href: `/admin/conferences/propositions/${p.id}` },
          { label: "Corriger" },
        ]}
      />
      <div className="py-10 px-4">
        <section className="max-w-2xl mx-auto" aria-labelledby="corriger-title">
          <h1 id="corriger-title" className="text-2xl font-bold mb-2">
            <span className="text-magenta">Corriger</span> {p.nom}
          </h1>
          <p className="text-sm text-gray-light mb-6">
            Le nom enregistré ici devient celui du répertoire, et l&apos;année
            celle de son édition.
          </p>

          {canoniques.length > 0 && (
            <div className="mb-6 rounded-xl border border-cyan/30 bg-navy-light/60 p-4">
              {/* Deux phrases, parce que ce sont deux ÉTATS et pas deux degrés
                  du même : le slug identique est un fait (le répertoire porte
                  bien ce nom), la ressemblance est une suggestion. La page
                  d'avant le dit déjà ainsi ; l'affirmer ici pour une simple
                  ressemblance était faux — « DevoxxFR » n'est pas au répertoire,
                  « Devoxx France » l'est. */}
              <p id="canoniques-titre" className="text-sm text-gray-light">
                {rapprochement.identique
                  ? "Le répertoire porte déjà ce nom."
                  : canoniques.length > 1
                    ? "Le répertoire porte des noms proches."
                    : "Le répertoire porte un nom proche."}{" "}
                S&apos;il s&apos;agit de la même conférence, reprends son nom&nbsp;:
                la validation rattachera la saisie à la conférence existante au
                lieu d&apos;en créer une seconde.
              </p>
              <ul
                role="list"
                aria-labelledby="canoniques-titre"
                className="mt-2 flex flex-col gap-1 list-none"
              >
                {canoniques.map((v) => (
                  <li key={v.id}>
                    {/* Un GESTE, pas un nom à retaper : c'est de la recopie
                        EXACTE que dépend le rattachement, donc une faute de
                        frappe créait le doublon que cet écran existe pour
                        empêcher. Un clic enregistre le nom ; l'année, la ville
                        et les liens sont relus en base, pas envoyés d'ici. */}
                    <form action={reprendreNomAction}>
                      <input type="hidden" name="propositionId" value={p.id} />
                      <input type="hidden" name="nom" value={v.nom} />
                      <Button type="submit" variant="ghost" size="sm" className="px-0">
                        Reprendre «&nbsp;{v.nom}&nbsp;»
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {p.saisies.length > 0 && (
            <div className="mb-6">
              {/* CE QUE LA CORRECTION VA ESTAMPILLER. L'année corrigée devient
                  celle de l'édition pour TOUTES les saisies derrière — et la
                  validation recompose leur libellé avec elle, sans jamais
                  regarder leur date. Corriger l'année sans les voir publiait
                  donc un talk donné en 2023 sous « … 2025 », pour une autrice
                  qui n'avait jamais tapé ce couple (sonde de la passe justesse,
                  2026-08-21). Elles sont donc ICI, avec leurs dates. */}
              <p id="saisies-titre" className="text-sm text-gray-light">
                {p.saisies.length > 1
                  ? `Ces ${p.saisies.length} saisies prendront le nom et l'année enregistrés ici :`
                  : "Cette saisie prendra le nom et l'année enregistrés ici\u00a0:"}
              </p>
              <ul
                role="list"
                aria-labelledby="saisies-titre"
                className="mt-2 flex flex-col gap-1 list-none"
              >
                {p.saisies.map((s) => (
                  <li key={s.occurrenceId} className="text-sm text-white">
                    {s.titre}
                    <span className="text-gray-light">
                      {" · "}
                      {s.autriceNom ?? "autrice inconnue"}
                      {s.date ? ` · ${formatTalkDate(s.date)}` : " · sans date"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <InlineActionForm
            action={updatePropositionAction}
            hidden={{ propositionId: p.id }}
            fields={[
              {
                kind: "input",
                name: "nomConference",
                label: "Nom de la conférence",
                required: true,
                defaultValue: p.nom,
              },
              {
                kind: "input",
                name: "annee",
                label: "Année (optionnel)",
                type: "number",
                min: "1990",
                max: "2100",
                defaultValue: p.annee != null ? String(p.annee) : "",
                hint:
                  p.saisies.length > 1
                    ? "L'année de l'édition. Elle sera celle des saisies ci-dessus, toutes ensemble."
                    : "L'année de l'édition où le talk a été donné.",
              },
              {
                kind: "input",
                name: "ville",
                label: "Ville (optionnel)",
                defaultValue: p.ville ?? "",
              },
              {
                kind: "input",
                name: "url",
                label: "Site de la conférence (optionnel)",
                type: "url",
                placeholder: "https://…",
                defaultValue: p.url ?? "",
              },
              {
                kind: "input",
                name: "endpoint",
                // Le MÊME libellé que les deux écrans d'édition du dossier : un
                // seul mot par concept, pour une seule colonne. Et « endpoint »
                // reste hors de l'écran — c'est un mot d'implémentation.
                label: "Moisson Sessionize (optionnel)",
                defaultValue: p.endpoint ?? "",
                hint: "Colle l'adresse de la page programme de la conférence (https://…) : l'id y est détecté. L'id seul marche aussi. Testé à l'enregistrement.",
              },
            ]}
            variant="primary"
            submitLabel="Enregistrer la correction"
            pendingLabel="Enregistrement…"
            successMessage={`«\u00a0${p.nom}\u00a0» est corrigée. Retourne à la proposition pour la valider.`}
            stickySubmit
          />

          <LienRetour
            href={`/admin/conferences/propositions/${p.id}`}
            label="Retour à la proposition"
          />
        </section>
      </div>
    </>
  );
}
