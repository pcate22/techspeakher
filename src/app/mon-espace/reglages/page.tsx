import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Breadcrumb from "@/components/Breadcrumb";
import SettingToggle from "@/components/SettingToggle";
import SettingChoice from "@/components/SettingChoice";
import NavRow from "@/components/NavRow";
import SegmentLabel from "@/components/SegmentLabel";
import { estAbonnee } from "@/lib/newsletter";
import { getProfileByUserId, getRappelCadence } from "@/lib/profiles";
import { CADENCE_CHOIX, CADENCES } from "@/lib/cadence-rappels";
import { setNewsletterAction, setCadenceRappelAction } from "./actions";

export const metadata: Metadata = {
  title: "Réglages | Tech Speak'Her",
  robots: { index: false },
  alternates: { canonical: "/mon-espace/reglages" },
};

export const dynamic = "force-dynamic";

/**
 * RÉGLAGES — ce qu'on paramètre une fois, à part de l'espace de travail.
 *
 * Ces rangées vivaient en bas de « Mon espace », sous un segment « Mon compte » :
 * le hub mélangeait donc ce qu'on FAIT (sa fiche, son tremplin, son coaching) et
 * ce qu'on RÈGLE une fois pour toutes. On les attend là où vit le compte — le
 * menu de l'avatar (desktop) et le tiroir (mobile) —, pas dans le flux du
 * travail. C'est aussi la convention des apps : l'identité ouvre les réglages.
 *
 * Nommée « Réglages » et pas « Mon compte » : deux entrées « Mon espace » et
 * « Mon compte » côte à côte se ressemblaient trop pour qu'on devine laquelle
 * mène où. « Réglages » dit ce qu'on y fait, et ne concurrence plus l'espace.
 */
export default async function Reglages() {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");

  const userId = Number(session.user.id);
  const [abonnee, fiche, cadence] = await Promise.all([
    estAbonnee(userId),
    // Les rappels portent sur la FICHE : sans fiche, le réglage n'aurait rien à
    // régler et n'apparaît pas. `getProfileByUserId` est mémoïsée par requête.
    getProfileByUserId(userId),
    getRappelCadence(userId),
  ]);

  return (
    <>
      <Breadcrumb
        items={[{ label: "Mon espace", href: "/mon-espace" }, { label: "Réglages" }]}
      />
      {/* <div>, pas <main> : le layout racine fournit déjà le landmark principal. */}
      <div className="py-10 px-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          <header className="mb-2">
            <h1 className="text-2xl font-bold">Réglages</h1>
            <p className="text-sm text-gray-light mt-1">
              {session.user.email ?? session.user.name}
            </p>
          </header>

          {/* Le marketing se refuse, le service jamais : deux canaux, deux
              régimes, et la description le dit en toutes lettres pour qu'on
              coupe l'un sans craindre de perdre l'autre. */}
          <section aria-labelledby="emails-seg" className="flex flex-col gap-3">
            <SegmentLabel id="emails-seg">
              E-mails
            </SegmentLabel>
            <div className="rounded-xl border border-navy-lighter bg-navy-light/60 px-4">
              <SettingToggle
                action={setNewsletterAction}
                hidden={{}}
                checked={abonnee}
                label="Recevoir la lettre d'information"
                description="Les nouveautés de la plateforme et la vie de l'association, quelques fois par an. Les e-mails liés à ton compte (lien de connexion, décision sur ta fiche, message reçu) continuent d'arriver."
                successMessage="Choix enregistré."
              />
              {/* Les RAPPELS se règlent, les notifications jamais : un rappel
                  revient et pousse, une notification annonce un fait et
                  s'arrête. La description reprend mot pour mot la réassurance
                  du réglage voisin — deux réglages, une seule promesse. */}
              {fiche && (
                <div className="border-t border-navy-lighter">
                  <SettingChoice
                    action={setCadenceRappelAction}
                    name="cadence"
                    value={cadence ?? ""}
                    label="Rappels sur ma fiche"
                    description="Un message de temps en temps pour compléter ta fiche et ajouter tes prochaines dates de talk. Les e-mails liés à ton compte (lien de connexion, décision sur ta fiche, message reçu) continuent d'arriver."
                    options={[
                      { value: "", label: "Au rythme de l'équipe" },
                      ...CADENCE_CHOIX.map((c) => ({
                        value: c,
                        label: CADENCES[c].label,
                      })),
                    ]}
                    successMessage="Choix enregistré."
                  />
                </div>
              )}
            </div>
          </section>

          <section aria-labelledby="compte-seg" className="flex flex-col gap-3">
            <SegmentLabel id="compte-seg">
              Mon compte
            </SegmentLabel>
            <NavRow
              href="/mon-espace/connexions"
              title="Mes connexions"
              subtitle="Google, LinkedIn, e-mail : une seule fiche, plusieurs manières de te connecter."
            />
            <NavRow
              href="/mon-espace/supprimer"
              title="Supprimer mon compte"
              subtitle="Tes données partent avec, après confirmation."
              tone="danger"
            />
          </section>
        </div>
      </div>
    </>
  );
}
