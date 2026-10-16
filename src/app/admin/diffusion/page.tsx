import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import ListPageTemplate from "@/components/ListPageTemplate";
import { requireOrgaPage } from "@/lib/auth-guards";
import { nb } from "@/lib/format";
import { buildNouveautesEmail, VERSIONS_NOUVEAUTES } from "@/lib/nouveautes-email";
import {
  attributsPour,
  comptesASynchroniser,
  compterDesabonnees,
  listeComptes,
} from "@/lib/brevo-contacts";
import CopierHtml from "./CopierHtml";
import { synchroniserContactsAction } from "./actions";

export const metadata: Metadata = {
  title: "Lettre d'information | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Ce que l'écran a le droit de dire de la dernière synchro. */
function Retour({
  sync,
  contacts,
  err,
}: {
  sync?: string;
  contacts?: string;
  err?: string;
}) {
  if (!sync) return null;
  const messages: Record<string, { ton: "ok" | "alerte"; texte: string }> = {
    ok: {
      ton: "ok",
      texte: `${nb(Number(contacts) || 0, "contact")} à jour dans Brevo. La campagne s'écrit et part depuis Brevo.`,
    },
    "sans-liste": {
      ton: "alerte",
      texte:
        "La liste Brevo reste à désigner : crée-la dans Brevo, puis colle son identifiant dans la variable d'environnement BREVO_LIST_COMPTES.",
    },
    indisponible: {
      ton: "alerte",
      texte:
        "L'accès à Brevo est indisponible pour le moment : préviens l'équipe technique.",
    },
    echec: {
      ton: "alerte",
      texte: err
        ? `La synchronisation s'est arrêtée. Raison : ${err}`
        : "La synchronisation s'est arrêtée. Réessaie, puis préviens l'équipe technique.",
    },
  };
  const message = messages[sync];
  if (!message) return null;
  return (
    <p
      role={message.ton === "ok" ? "status" : "alert"}
      className={
        message.ton === "ok"
          ? "text-sm text-cyan bg-cyan/10 border border-cyan/30 rounded-lg px-4 py-3"
          : "text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg px-4 py-3"
      }
    >
      {message.texte}
    </p>
  );
}

/**
 * LETTRE D'INFORMATION — l'écran qui PRÉPARE la diffusion, sans l'envoyer.
 *
 * L'envoi marketing vit dans Brevo, pour une raison de fond : il doit porter un
 * désabonnement en un clic, et se refuser sans couper les e-mails de service de
 * la plateforme. Ici on tient donc les deux choses que Brevo ignore : qui a un
 * COMPTE ici (avec ses étiquettes de ciblage) et QUOI écrire (le HTML des deux
 * versions, à coller dans la campagne).
 *
 * « Compte » et non « membre » : l'association compte des adhérentes et des
 * adhérents qui n'auront jamais de compte — la plateforme est réservée aux
 * femmes et aux personnes non binaires. Confondre les deux populations ferait
 * croire que cette liste EST l'association, et donnerait des campagnes qui
 * oublient la moitié de ses membres.
 *
 * Un rôle, un CTA : synchroniser. Le reste est de la matière à copier.
 */
export default async function AdminDiffusion({
  searchParams,
}: {
  searchParams: Promise<{ sync?: string; contacts?: string; err?: string }>;
}) {
  await requireOrgaPage();

  const { sync, contacts, err } = await searchParams;
  const [comptes, desabonnees] = await Promise.all([
    comptesASynchroniser(),
    compterDesabonnees(),
  ]);
  const attributs = comptes.map(attributsPour);
  const combien = (predicat: (a: (typeof attributs)[number]) => boolean) =>
    attributs.filter(predicat).length;
  const listeConfiguree = listeComptes() !== null;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Lettre d'information" },
        ]}
      />
      <ListPageTemplate
        title="Lettre d'information"
        meta="Les COMPTES de la plateforme partent vers Brevo avec leurs étiquettes ; la campagne s'écrit et s'envoie de là-bas, avec son désabonnement en un clic. Les adhérentes et adhérents sans compte, comme les contacts de l'écosystème, vivent dans leurs propres listes Brevo : cette synchro les laisse intacts."
      >
        <Retour sync={sync} contacts={contacts} err={err} />

        <section
          aria-labelledby="etat-titre"
          className="rounded-xl border border-navy-lighter bg-navy-light/60 p-5"
        >
          <h2
            id="etat-titre"
            className="text-xs font-bold uppercase tracking-wider text-gray-light mb-3"
          >
            Ce qui partira dans la liste « Comptes plateforme »
          </h2>
          <ul className="flex flex-col gap-1 list-none text-sm text-white">
            <li>
              <strong>{nb(comptes.length, "contact")}</strong> à synchroniser.
            </li>
            <li>
              {nb(combien((a) => a.FICHE === "en_ligne"), "fiche")} en ligne,{" "}
              {nb(combien((a) => a.INVITER_FICHE), "personne")} à inviter à publier la
              sienne.
            </li>
            <li>
              {nb(combien((a) => a.TREMPLIN !== ""), "participante")} au Tremplin, dont{" "}
              {nb(combien((a) => a.MONTEE_SUR_SCENE), "personne")} en montée sur scène.
            </li>
            <li>
              {nb(combien((a) => a.COACH), "coach")} et{" "}
              {nb(combien((a) => a.ORGA), "orga")}.
            </li>
            <li className="text-gray-light">
              {desabonnees === 0
                ? "Tout le monde reçoit la lettre d'information à ce jour."
                : `${nb(desabonnees, "personne")} ${
                    desabonnees > 1 ? "ont" : "a"
                  } refusé la lettre d'information : elles restent hors de la synchro.`}
            </li>
          </ul>

          <div className="mt-5">
            <form action={synchroniserContactsAction}>
              <ConfirmSubmitButton
                variant="primary"
                title="Synchroniser vers Brevo ?"
                message={`Les adresses et les étiquettes de ${nb(
                  comptes.length,
                  "contact",
                )} ayant un compte partent chez Brevo, notre sous-traitant d'envoi. Personne ne reçoit d'e-mail : la campagne s'écrit ensuite dans Brevo.`}
                confirmLabel="Synchroniser maintenant"
                pendingLabel="Synchronisation…"
              >
                Synchroniser vers Brevo ({comptes.length})
              </ConfirmSubmitButton>
            </form>
            {!listeConfiguree && (
              <p role="alert" className="mt-3 text-xs text-orange">
                La variable <code>BREVO_LIST_COMPTES</code> reste à renseigner
                (identifiant de la liste Brevo). Sans elle, la synchronisation
                s&apos;arrête avant d&apos;écrire quoi que ce soit.
              </p>
            )}
          </div>
        </section>

        <section aria-labelledby="segments-titre">
          <h2
            id="segments-titre"
            className="text-xs font-bold uppercase tracking-wider text-gray-light mb-2"
          >
            Segmenter dans Brevo
          </h2>
          <ul className="flex flex-col gap-1 list-none text-sm text-gray-light">
            <li>
              <code className="text-white">FICHE</code> vaut <code>en_ligne</code>,{" "}
              <code>a_publier</code>, <code>en_relecture</code>, <code>en_retrait</code>{" "}
              ou <code>aucune</code>.
            </li>
            <li>
              <code className="text-white">INVITER_FICHE</code> marque celles qu&apos;on
              peut inviter à publier leur fiche.
            </li>
            <li>
              <code className="text-white">TREMPLIN</code> porte les années
              («&nbsp;2026&nbsp;»), <code className="text-white">MONTEE_SUR_SCENE</code>{" "}
              la phase de préparation.
            </li>
            <li>
              <code className="text-white">COACH</code> et{" "}
              <code className="text-white">ORGA</code> pour les rôles.
            </li>
          </ul>
        </section>

        <section aria-labelledby="html-titre" className="flex flex-col gap-6">
          <h2
            id="html-titre"
            className="text-xs font-bold uppercase tracking-wider text-gray-light"
          >
            Le contenu à coller dans Brevo
          </h2>
          {VERSIONS_NOUVEAUTES.map((version) => {
            const { subject, htmlContent } = buildNouveautesEmail({
              name: "Camille",
              version,
            });
            const titre =
              version === "sans-fiche" ? "la fiche reste à publier" : "la fiche vit déjà";
            const cible = version === "sans-fiche" ? "oui" : "non";
            return (
              <div key={version} className="flex flex-col gap-2">
                <h3 className="text-sm font-bold text-white">
                  Version «&nbsp;{titre}&nbsp;»
                </h3>
                <p className="text-xs text-gray-light">
                  Objet&nbsp;: <span className="text-white">{subject}</span> — à cibler
                  sur <code>INVITER_FICHE = {cible}</code>.
                </p>
                <CopierHtml html={htmlContent} titre={titre} />
              </div>
            );
          })}
        </section>
      </ListPageTemplate>
    </>
  );
}
