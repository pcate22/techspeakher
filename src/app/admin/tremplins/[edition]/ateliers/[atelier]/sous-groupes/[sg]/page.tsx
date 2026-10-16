import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgaId } from "@/lib/auth-guards";
import SousPage from "@/components/SousPage";
import InlineActionForm from "@/components/InlineActionForm";
import SettingToggle from "@/components/SettingToggle";
import { getSousGroupesByAtelier } from "@/lib/tremplin-ateliers";
import { libelleSousGroupe } from "@/lib/sous-groupe-libelle";
import {
  getRegistrationsByEdition,
  nommerInscriptions,
  registrationLabel,
  trierParLabel,
} from "@/lib/tremplin-registrations";
import { getCoachsByAtelier, coachLabel } from "@/lib/tremplin-coachs";
import { loadAtelierOrNotFound } from "@/lib/tremplin-admin";
import {
  updateSousGroupeAction,
  setCoachDansSousGroupeAction,
  setMembreDansSousGroupeAction,
  deleteSousGroupeAction,
} from "../../../../../actions";

export const metadata: Metadata = {
  title: "Sous-groupe | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Page dédiée d'UN sous-groupe (la spoke, principes §1) : qui le compose, qui le
 * coache, comment se retrouver, et sa suppression. Aucun nom à saisir : le titre
 * est DÉRIVÉ de qui est dedans (migration 052), et un repère STABLE (« Sous-groupe
 * 3 de cet atelier ») reste sous ce titre qui bouge à chaque personne ajoutée.
 *
 * Composer d'abord, régler ensuite : les deux listes de cases (coachs,
 * participantes) s'enregistrent À LA BASCULE, comme partout ailleurs dans
 * l'admin ; seuls le lien et la date passent par un bouton. Les mêler donnait
 * deux modèles d'enregistrement sous une apparence identique — on cochait une
 * coach, on cochait des participantes, chaque bascule confirmait, et la coach
 * n'était jamais enregistrée. */
export default async function SousGroupePage({
  params,
}: {
  params: Promise<{ edition: string; atelier: string; sg: string }>;
}) {
  await requireOrgaId();
  const { edition, atelier, sg } = await params;
  const { editionId, atelier: a } = await loadAtelierOrNotFound(edition, atelier);
  const sgId = Number(sg);
  if (!Number.isInteger(sgId) || sgId <= 0) notFound();

  const [sousGroupes, registrations, coachsAtelier] = await Promise.all([
    getSousGroupesByAtelier(a.id),
    getRegistrationsByEdition(editionId),
    // PAS de repli sur liste vide ici (§7) : une lecture avalée afficherait
    // « aucune coach sur l'atelier », donc aucune case à cocher, sur la page même
    // où l'on confie un sous-groupe à une coach.
    getCoachsByAtelier(a.id),
  ]);
  const i = sousGroupes.findIndex((g) => g.id === sgId);
  if (i < 0) notFound();
  const groupe = sousGroupes[i];
  const rang = i + 1;
  const membreSet = new Set(groupe.membres);
  const triees = trierParLabel(registrations);
  // Le sous-groupe se DÉSIGNE par qui est dedans (migration 052). Même dérivation
  // que la liste (`nommerInscriptions`) : deux recettes donnaient deux titres pour
  // un même groupe dès qu'un membre n'était pas résolu. Liste ENTIÈRE ici — la
  // place ne manque pas, et la confirmation de suppression doit être exacte.
  const titre = libelleSousGroupe(
    nommerInscriptions(groupe.membres, registrations).map((m) => m.nom),
    rang,
  );

  const coachSet = new Set(groupe.coachs.map((c) => c.userId));

  return (
    <SousPage
      titre={titre}
      // Le titre dit QUI, l'indice dit OÙ — et lui ne bouge pas quand on compose.
      indice={`Sous-groupe ${rang} de cet atelier`}
      retour={{
        href: `/admin/tremplins/${editionId}/ateliers/${a.id}/sous-groupes`,
        label: "Retour à la répartition",
      }}
    >
      <section aria-labelledby="membres-titre">
        <h2 id="membres-titre" className="text-lg font-bold mb-1">
          Qui est dans ce sous-groupe
        </h2>
        <p className="text-sm text-gray-light mb-3">
          Chacune appartient à un seul sous-groupe par atelier. Cocher une
          participante déjà rangée ailleurs la déplace ici.
        </p>
        {triees.length === 0 ? (
          <p className="text-sm text-gray-light">Aucune inscrite sur cette édition.</p>
        ) : (
          <div className="divide-y divide-navy-lighter">
            {triees.map((r) => (
              <div key={r.id}>
                <SettingToggle
                  action={setMembreDansSousGroupeAction}
                  hidden={{ editionId, atelierId: a.id, registrationId: r.id, sousGroupeId: groupe.id }}
                  checked={membreSet.has(r.id)}
                  control="checkbox"
                  label={registrationLabel(r)}
                  // Confirmation NOMINATIVE : trente lignes qui disent toutes
                  // « Rangement mis à jour » ne disent pas laquelle a pris.
                  successMessage={`${registrationLabel(r)} : rangement mis à jour.`}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="coachs-titre" className="mt-8">
        <h2 id="coachs-titre" className="text-lg font-bold mb-1">
          Qui le coache
        </h2>
        {coachsAtelier.length === 0 ? (
          // Sans coach sur l'atelier, il n'y a rien à cocher : on dit OÙ en
          // ajouter, plutôt que d'afficher une liste vide.
          <p className="text-sm text-gray-light">
            Ce sous-groupe est autonome. Pour lui confier une coach,{" "}
            <Link
              href={`/admin/tremplins/${editionId}/ateliers/${a.id}/coachs`}
              className="text-cyan underline underline-offset-2 hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
            >
              ajoute-la d&apos;abord aux coachs de l&apos;atelier
            </Link>
            .
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-light mb-3">
              Une coach, plusieurs, ou aucune&nbsp;: une revue croisée entre
              speakeuses se fait très bien en autonomie.
            </p>
            <div className="divide-y divide-navy-lighter">
              {coachsAtelier.map((c) => (
                <div key={c.userId}>
                  <SettingToggle
                    action={setCoachDansSousGroupeAction}
                    hidden={{ editionId, sousGroupeId: groupe.id, userId: c.userId }}
                    checked={coachSet.has(c.userId)}
                    control="checkbox"
                    label={coachLabel(c)}
                    successMessage={`${coachLabel(c)} : coaching mis à jour.`}
                  />
                </div>
              ))}
            </div>
          </>
        )}
        {groupe.coachHeriteNom !== null && (
          // Une coach de l'ANCIEN modèle, posée sur le sous-groupe sans être
          // inscrite aux coachs de l'atelier. La migration ne l'inscrit pas
          // d'office : une ligne dans les coachs de l'atelier ouvre l'accès aux
          // noms de toutes ses participantes et à ses supports, et élargir un
          // accès est une décision d'orga. On le DIT donc, avec le geste à faire.
          // Pas de `role="status"` : ce n'est pas l'annonce d'un changement mais
          // un état présent au chargement. L'information est dans les MOTS, la
          // couleur ne fait que la doubler (RGAA 3.1).
          <p className="mt-3 text-sm text-orange">
            {groupe.coachHeriteNom}
            {" coachait ce sous-groupe. Pour qu'elle continue, "}
            <Link
              href={`/admin/tremplins/${editionId}/ateliers/${a.id}/coachs`}
              className="text-cyan underline underline-offset-2 hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
            >
              ajoute-la aux coachs de l&apos;atelier
            </Link>
            , puis coche-la ici.
          </p>
        )}
      </section>

      <section aria-labelledby="retrouver-titre" className="mt-8">
        <h2 id="retrouver-titre" className="text-lg font-bold mb-3">
          Comment se retrouver
        </h2>
        <InlineActionForm
          action={updateSousGroupeAction}
          hidden={{ editionId, sousGroupeId: groupe.id }}
          fields={[
            { kind: "input", name: "lienVisio", label: "Lien pour se retrouver (optionnel)", clearable: true, defaultValue: groupe.lienVisio ?? "", placeholder: "https://…" },
            { kind: "input", name: "faitLe", label: "Fait le (optionnel)", type: "date", clearable: true, defaultValue: groupe.faitLe ?? "" },
          ]}
          variant="primary"
          submitLabel="Enregistrer"
          pendingLabel="Enregistrement…"
          successMessage="C'est enregistré."
        />
      </section>

      <section aria-labelledby="suppr-titre" className="mt-8 pt-4 border-t border-navy-lighter">
        <h2 id="suppr-titre" className="sr-only">Supprimer le sous-groupe</h2>
        <InlineActionForm
          action={deleteSousGroupeAction}
          hidden={{ editionId, sousGroupeId: groupe.id, atelierId: a.id }}
          submitLabel="Supprimer le sous-groupe"
          pendingLabel="Suppression…"
          variant="ghost"
          confirm={{
            title: `Supprimer « ${titre} » ?`,
            message: "Les participantes restent inscrites à l'atelier, simplement sans sous-groupe : tu pourras les ranger ailleurs.",
            label: "Supprimer définitivement",
          }}
          successMessage="Sous-groupe supprimé."
        />
      </section>
    </SousPage>
  );
}
