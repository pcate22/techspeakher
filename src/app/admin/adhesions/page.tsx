import type { Metadata } from "next";
import { requireOrgaPage } from "@/lib/auth-guards";
import Breadcrumb from "@/components/Breadcrumb";
import NavRow from "@/components/NavRow";
import { adhesionsPourOrga } from "@/lib/adhesions";
import {
  groupesAdhesionsOrga,
  texteBilanAdhesions,
  type LigneAdhesionOrga,
} from "@/lib/adhesion-libelle";
import { lireBilanAdhesions } from "@/lib/bilan-adhesions";
import RelireHelloAsso from "./RelireHelloAsso";
import { helloassoConfig } from "@/lib/helloasso";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { RELANCE_AVANT_ECHEANCE_JOURS } from "@/lib/adhesion";

export const metadata: Metadata = {
  title: "Adhésions | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Les adhésions reliées à un compte, et leurs échéances (consultation : « une
 * page = un rôle »). Les adhésions sans compte vivent dans HelloAsso, qui en
 * est le registre : la plateforme ne les stocke pas.
 *
 * Le bilan de la dernière relecture de HelloAsso se lit ici (2026-10-15 :
 * Vercel ne garde qu'une heure de logs), avec le seul geste de la page,
 * secondaire et sans e-mail : relire HelloAsso maintenant.
 * Cf. docs/conception-adhesions-helloasso.md § 5.
 */
export default async function AdhesionsPage() {
  await requireOrgaPage();
  const synchroConfiguree = helloassoConfig() !== null;
  const regleActive = isFeatureEnabled("adhesions");
  const [adhesions, bilan] = await Promise.all([
    adhesionsPourOrga(),
    synchroConfiguree ? lireBilanAdhesions() : null,
  ]);
  const { bientot, aJour, echues } = groupesAdhesionsOrga(adhesions);
  const relecture = texteBilanAdhesions(bilan);

  const groupes = [
    {
      id: "bientot",
      titre: `À renouveler dans les ${RELANCE_AVANT_ECHEANCE_JOURS} jours`,
      lignes: bientot,
    },
    { id: "ajour", titre: "À jour", lignes: aJour },
    { id: "echues", titre: "Échues", lignes: echues },
  ];

  return (
    <>
      <Breadcrumb
        items={[{ label: "Espace organisatrices", href: "/admin" }, { label: "Adhésions" }]}
      />
      <div className="py-10 px-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          <header>
            <h1 className="text-2xl font-bold">Adhésions</h1>
            <p className="text-sm text-gray-light mt-1">
              Les adhésions HelloAsso reliées à un compte de la plateforme, par
              échéance. Les autres restent dans HelloAsso.
            </p>
            <p className="text-sm text-gray-light mt-2">
              {synchroConfiguree
                ? "Relues sur HelloAsso à chaque adhésion, puis chaque soir."
                : "La lecture de HelloAsso attend ses identifiants, à poser par l'équipe technique."}{" "}
              {regleActive
                ? "Annuaire réservé aux membres\u00a0: activé."
                : "Annuaire réservé aux membres\u00a0: en attente d'activation."}
            </p>
          </header>

          {synchroConfiguree && (
            <section
              aria-labelledby="relecture-titre"
              className={`rounded-xl border px-4 py-3 ${
                relecture.alerte
                  ? "border-orange/30 bg-orange/10"
                  : "border-navy-lighter bg-navy-light/60"
              }`}
            >
              <h2 id="relecture-titre" className="text-sm font-bold text-cream">
                Dernière relecture de HelloAsso
              </h2>
              <p className="text-sm text-gray-light mt-1">{relecture.quand}</p>
              {/* Un état rendu par le serveur, présent à l'arrivée : la
                  couleur et le texte (« a échoué ») le disent, pas role="alert"
                  qui l'annoncerait comme un événement. */}
              {relecture.lignes.map((l) => (
                <p
                  key={l}
                  className={`text-sm mt-1 ${relecture.alerte ? "text-orange" : "text-gray-light"}`}
                >
                  {l}
                </p>
              ))}
              <div className="mt-3">
                <RelireHelloAsso />
              </div>
            </section>
          )}

          <NavRow
            href="/admin/adhesions/inviter"
            title="Inviter à adhérer"
            subtitle="Les fiches en ligne encore sans adhésion reçoivent une invitation, une seule fois"
          />

          {groupes.map((g) => (
            <section key={g.id} aria-labelledby={`${g.id}-titre`}>
              <h2
                id={`${g.id}-titre`}
                className="text-sm font-bold text-cream mb-2"
              >
                {g.titre} ({g.lignes.length})
              </h2>
              {g.lignes.length === 0 ? (
                <p className="text-sm text-gray-light">Aucune.</p>
              ) : (
                <ul role="list" className="flex flex-col gap-2 list-none">
                  {g.lignes.map((l: LigneAdhesionOrga) => (
                    <li
                      key={l.userId}
                      className="rounded-xl border border-navy-lighter bg-navy-light px-4 py-3"
                    >
                      <p className="text-white font-medium">{l.nom}</p>
                      <p className="text-sm text-gray-light">{l.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
