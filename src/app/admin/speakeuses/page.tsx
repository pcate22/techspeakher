import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import {
  getPendingProfiles,
  getAllProfiles,
  getProfilesToInvite,
  getProfilesEnSommeilBrefs,
  type SpeakerProfile,
} from "@/lib/profiles";
import Avatar from "@/components/Avatar";
import Breadcrumb from "@/components/Breadcrumb";
import NavRow from "@/components/NavRow";
import { getReglages } from "@/lib/reglages";
import { formatDateFr, nb } from "@/lib/format";
import InviteButton from "./InviteButton";
import RosterFilter from "./RosterFilter";

export const metadata: Metadata = {
  title: "Fiches speakeuses | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Ligne cliquable vers la fiche (vue orga). Méta + libellé d'action variables. */
function ProfileRow({
  profile,
  meta,
  cta,
}: {
  profile: SpeakerProfile;
  meta: React.ReactNode;
  cta: string;
}) {
  const nom = profile.nomAffiche;
  return (
    <Link
      href={`/speakeuses/${profile.id}`}
      className="flex items-center justify-between gap-3 bg-navy-light border border-navy-lighter rounded-xl px-5 py-4 hover:border-cyan/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan transition-colors"
    >
      <span className="flex items-center gap-3 min-w-0">
        <Avatar name={nom} image={profile.image} size="md" />
        <span className="min-w-0">
          <span className="block font-bold text-white truncate">{nom}</span>
          {meta}
        </span>
      </span>
      <span className="text-cyan text-sm shrink-0">
        {cta} <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    invited?: string;
    invite?: string;
    failed?: string;
    err?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!session.user.isOrga) redirect("/mon-espace");

  const { invited, invite, failed, err } = await searchParams;
  const nbFailed = Number(failed);
  const reglages = await getReglages();
  const [pending, all, toInvite, sommeil] = await Promise.all([
    getPendingProfiles(),
    getAllProfiles(),
    getProfilesToInvite(),
    getProfilesEnSommeilBrefs(reglages.relance_brouillon_jours),
  ]);

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Speakeuses" },
        ]}
      />
      <div className="py-10 px-4">
        <section className="max-w-3xl mx-auto" aria-labelledby="admin-title">
          <div className="mb-8">
            <h1 id="admin-title" className="text-2xl font-bold mb-2">
              <span className="text-magenta">Fiches speakeuses</span>
            </h1>
            <p className="text-sm text-gray-light">
              Les fiches à valider sont en tête ; en dessous, le suivi de toutes
              les fiches par statut. Ouvre une fiche pour vérifier le profil et
              les talks, puis publie ou refuse directement depuis la fiche.
            </p>
          </div>

          {nbFailed > 0 && (
            <p
              role="alert"
              className="mb-6 text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg px-4 py-3"
            >
              {nbFailed > 1
                ? `${nbFailed} invitations n'ont pas pu être envoyées`
                : "1 invitation n'a pas pu être envoyée"}
              {Number(invited) > 0
                ? ` (${invited} envoyée${Number(invited) > 1 ? "s" : ""})`
                : ""}
              .{err ? ` Raison : ${err}` : " Si ça persiste, préviens l'équipe technique."}
            </p>
          )}
          {invited != null && nbFailed === 0 && Number(invited) > 0 && (
            <p
              role="status"
              className="mb-6 text-sm text-cyan bg-cyan/10 border border-cyan/30 rounded-lg px-4 py-3"
            >
              {invited} invitation{Number(invited) > 1 ? "s" : ""} envoyée
              {Number(invited) > 1 ? "s" : ""}.
            </p>
          )}
          {err === "nom" && (
            <p
              role="alert"
              className="mb-6 text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg px-4 py-3"
            >
              Cette fiche n&apos;a pas de nom&nbsp;: elle s&apos;afficherait sans nom
              dans l&apos;annuaire. Demande-le à la speakeuse (tu peux refuser la
              fiche avec ce motif), puis publie-la.
            </p>
          )}
          {invite === "disabled" && (
            <p
              role="alert"
              className="mb-6 text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg px-4 py-3"
            >
              L&apos;envoi d&apos;e-mails est indisponible pour le moment : préviens l&apos;équipe technique.
            </p>
          )}

          {/* Invitations de migration : visible seulement s'il reste des fiches
              migrées à inviter (sinon inutile d'encombrer). */}
          {toInvite.length > 0 && (
            <section
              aria-labelledby="invite-title"
              className="mb-10 rounded-xl border border-navy-lighter bg-navy-light/60 p-5"
            >
              <h2 id="invite-title" className="text-xs font-bold uppercase tracking-wider text-gray-light mb-2">
                Invitations migration
              </h2>
              <p className="text-sm text-gray-light mb-3">
                Envoie l&apos;e-mail « tu as la main sur ta fiche » aux speakeuses
                migrées jamais invitées.
              </p>
              <InviteButton count={toInvite.length} />
            </section>
          )}

          {/* Les relances vivent sur LEUR page : cet écran consulte le fichier
              des fiches, il n'héberge pas un second envoi groupé (principes UI,
              règle d'or). Rangée visible seulement quand il y a matière. */}
          {sommeil.length > 0 && (
            <div className="mb-10">
              <NavRow
                href="/admin/speakeuses/relances"
                title={`Relances (${sommeil.length})`}
                subtitle={`${nb(sommeil.length, "fiche")} en brouillon sans changement depuis plus de ${nb(reglages.relance_brouillon_jours, "jour")}`}
                flag
              />
            </div>
          )}

          {/* File d'action : fiches soumises en attente de validation. */}
          <h2 className="text-lg font-bold text-white mb-1">À valider</h2>
          {pending.length === 0 ? (
            <p className="text-gray-light mb-4">Aucune fiche en attente. 🎉</p>
          ) : (
            <ul className="flex flex-col gap-3 list-none mb-4">
              {pending.map((p) => (
                <li key={p.id}>
                  <ProfileRow
                    profile={p}
                    cta="Examiner"
                    meta={
                      <span className="block text-xs text-gray-light">
                        {formatDateFr(p.submittedAt)
                          ? `Soumise le ${formatDateFr(p.submittedAt)}`
                          : "Soumise"}
                      </span>
                    }
                  />
                </li>
              ))}
            </ul>
          )}

          {/* Suivi global : vues par statut (publiées / en attente / brouillon…). */}
          <div className="mt-12">
            <h2 className="text-lg font-bold text-white mb-1">
              Toutes les speakeuses{" "}
              <span className="text-gray-light font-normal">({all.length})</span>
            </h2>
            <p className="text-sm text-gray-light mb-4">
              Filtre par statut : publiées dans l&apos;annuaire, en attente de
              validation, ou en brouillon (pré-remplies, pas encore soumises).
              Clique pour ouvrir une fiche.
            </p>
            {all.length === 0 ? (
              <p className="text-gray-light">Aucune speakeuse pour le moment.</p>
            ) : (
              <RosterFilter
                profiles={all.map((p) => ({
                  id: p.id,
                  nomAffiche: p.nomAffiche,
                  image: p.image,
                  status: p.status,
                  updatedAt: p.updatedAt,
                  validatedAt: p.validatedAt,
                }))}
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
}
