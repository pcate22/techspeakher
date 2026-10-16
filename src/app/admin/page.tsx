import type { Metadata } from "next";
import NavRow from "@/components/NavRow";
import { requireOrgaPage } from "@/lib/auth-guards";
import { listEditions } from "@/lib/tremplin-editions";
import { chargerTachesAssociation } from "@/lib/taches-chargement";
import { reclameUnGeste } from "@/lib/taches";
import { nb } from "@/lib/format";

export const metadata: Metadata = {
  title: "Espace organisatrices | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Racine de l'espace organisatrices (donc pas de fil d'Ariane) : le MENU
 * Gérer — les notifications (« À faire ») vivent sur leur page dédiée
 * /admin/taches, séparées du menu fixe. RGPD : la page ne cite que des noms
 * déjà visibles des seules organisatrices.
 *
 * Le titre disait « Tableau de bord » alors que la rangée du profil disait
 * « Tableau de bord orga », les fils d'Ariane « Espace orga » et l'e-mail
 * quotidien « espace de modération » : quatre noms pour un endroit (audit
 * 2026-08-15, C7). Depuis le 2026-08-16, l'ÉCRAN n'en dit qu'un — et le mot
 * entier, « orga » étant une troncature qui suppose le vocabulaire de la
 * maison. L'e-mail quotidien, lui, suit à l'étape C : il change de source en
 * même temps que de mot, le compte n'est donc pas encore à un.
 */
export default async function AdminPage() {
  await requireOrgaPage();

  const [editions, { taches }] = await Promise.all([
    listEditions(),
    chargerTachesAssociation(),
  ]);
  // Ce qui se COMPTE et ce qui s'ALLUME, c'est ce qu'un geste referme — la même
  // règle et le même prédicat que le point de l'onglet (`reclameUnGeste`).
  // Sans lui, la rangée annonçait « 2 actions en attente » avec son drapeau
  // pour deux lignes que l'orga ne peut pas refermer, pendant que le point
  // restait éteint : deux surfaces qui lisent la même liste et se contredisent.
  // La LISTE, elle, reste complète sur sa page : les constats y informent.
  const aFaire = taches.filter(reclameUnGeste).length;
  const actives = editions.filter((e) => e.statut !== "archive");
  const nomEditionActive =
    actives.find((e) => e.statut === "en_cours")?.nom ?? actives[0]?.nom;

  return (
    // <div>, pas <main> : le layout racine fournit déjà le landmark principal.
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold">Espace organisatrices</h1>
        </header>

        {/* Les notifications (« À faire ») vivent sur leur page : une rangée
            à compteur y mène — le tableau de bord reste le menu Gérer. */}
        <NavRow
          // La NOUVELLE adresse, directement : le 308 de /admin/taches existe
          // pour les liens déjà envoyés (e-mails), pas pour rebondir à chaque tap.
          href="/mon-espace/a-faire?vue=association"
          title={aFaire > 0 ? `À faire (${aFaire})` : "À faire"}
          subtitle={
            aFaire > 0
              ? `${nb(aFaire, "action")} en attente`
              : "Rien en attente. Tout roule."
          }
          flag={aFaire > 0}
        />

        <section aria-labelledby="gerer-title">
          <h2
            id="gerer-title"
            className="text-sm font-bold text-cream mb-2"
          >
            Gérer
          </h2>
          <ul className="flex flex-col gap-2 list-none">
            <li>
              <NavRow href="/admin/speakeuses" title="Speakeuses" subtitle="Fiches et annuaire" />
            </li>
            <li>
              <NavRow
                href="/admin/adhesions"
                title="Adhésions"
                subtitle="Membres reliées à un compte, et échéances"
              />
            </li>
            <li>
              {/* La modération en attente est une tâche d'« À faire » : la
                  rangée du menu reste neutre. */}
              <NavRow
                href="/admin/messages"
                title="Messages"
                subtitle="Contacts reçus via les fiches"
              />
            </li>
            <li>
              <NavRow
                href="/admin/tremplins"
                title="Tremplins"
                subtitle={nomEditionActive ? `${nomEditionActive} et les éditions` : "Éditions"}
              />
            </li>
            <li>
              <NavRow
                href="/admin/conferences"
                title="Conférences"
                subtitle="Référence partagée (éditions, meetups, repérage)"
              />
            </li>
            <li>
              <NavRow
                href="/actualites"
                title="Contenus"
                subtitle="Actualités et articles (ajout/édition sur la page publique)"
              />
            </li>
            <li>
              <NavRow
                href="/admin/diffusion"
                title="Lettre d'information"
                subtitle="Contacts synchronisés vers Brevo, campagne écrite là-bas"
              />
            </li>
            <li>
              <NavRow
                href="/admin/reglages"
                title="Réglages"
                subtitle="Délais et rappels de la plateforme"
              />
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
