import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProfileByUserId } from "@/lib/profiles";
import { getUserById } from "@/lib/users";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmationBanner from "@/components/ConfirmationBanner";
import LienTexte from "@/components/LienTexte";
import DeleteAccountButton from "../DeleteAccountButton";

export const metadata: Metadata = {
  title: "Supprimer mon compte | Tech Speak'Her",
  robots: { index: false },
  alternates: { canonical: "/mon-espace/supprimer" },
};

export const dynamic = "force-dynamic";

/**
 * Ce que la page dit quand le geste a échoué. Une table plutôt que N blocs
 * recopiés : le motif suivant s'ajoute en une ligne, et les messages restent
 * côte à côte, donc comparables.
 *
 * Forme maison (`tremplin-messages.ts`) : l'ISSUE en tête, le geste suivant
 * derrière, une idée par phrase — ici plus qu'ailleurs, parce qu'on relit cet
 * écran juste après avoir cru son compte supprimé.
 *
 * « echec » couvre les DEUX causes possibles (le sous-traitant e-mail avant, la
 * base après) : nommer le sous-traitant dirait faux le jour où c'est Postgres
 * qui a lâché, et ce qui compte pour la personne est le même dans les deux cas.
 * Le message se garde d'affirmer où en est l'effacement, et c'est délibéré :
 * « rien n'a été effacé » serait FAUX quand c'est la base qui lâche après un
 * effacement réussi chez le sous-traitant. Il dit le seul fait qu'on tienne
 * dans les deux cas : le compte est encore là, et le geste se retente.
 */
const MESSAGES_ERREUR: Record<string, string> = {
  echec: "Suppression annulée : ton compte est toujours là. Réessaie dans quelques minutes.",
  // « sous le champ » désignait un champ refermé avec la fenêtre : au moment où
  // ce message se lit, il n'y a rien sous rien. On nomme l'endroit où revenir.
  confirmation:
    "Suppression annulée : réécris ton nom ou ton adresse e-mail tels qu’ils te sont rappelés dans la fenêtre de confirmation.",
};
/**
 * Supprimer mon compte — page dédiée à la seule action irréversible : la suppression
 * du compte. Le RETRAIT de l'annuaire (réversible) vit ailleurs (lien discret
 * en bas de « Mon espace »), on ne le mélange pas avec l'irréversible.
 */
export default async function ZoneDeDanger({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; n?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");
  const profile = await getProfileByUserId(Number(session.user.id));
  const compte = await getUserById(Number(session.user.id));
  // La revérification serveur du type-to-confirm (palier 3) redirige ICI :
  // sans ce message, l'échec serait muet et la page se rechargerait sans rien
  // dire — on croirait le bouton cassé.
  const { err, n } = await searchParams;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Mon espace", href: "/mon-espace" },
          { label: "Supprimer mon compte" },
        ]}
      />
      <div className="py-10 px-4">
        <section
          aria-labelledby="danger-title"
          className="max-w-2xl mx-auto rounded-2xl border border-orange/40 p-6"
        >
          {/* Le nom du GESTE, pas la métaphore de dév « zone de danger » :
              on nomme les choses comme l'utilisatrice les reconnaît (§5). */}
          <h1
            id="danger-title"
            className="text-sm font-bold uppercase tracking-wider text-orange mb-1"
          >
            Supprimer mon compte
          </h1>
          <p className="text-sm text-gray-light mb-4">
            {profile
              ? "Supprimer ton compte efface définitivement ta fiche, tes talks et ton compte. Cette action est irréversible."
              : "Supprimer ton compte efface définitivement tes données. Cette action est irréversible."}
          </p>
          {/* Possession PROPRE, jamais un `in` ni un accès direct : `?err=__proto__`
              atteindrait la chaîne de prototypes et rendrait un objet comme
              enfant React — 500 sur requête forgée. Même garde et même raison
              qu'à `mon-espace/fiche/page.tsx` (revue de sécurité N2). */}
          {err && Object.hasOwn(MESSAGES_ERREUR, err) && (
            <div className="mb-4">
              {/* Pas un <p role="alert"> écrit dans le HTML initial : une région
                  vive n'annonce que ce qu'on y insère APRÈS son montage, donc
                  un message déjà là au chargement reste MUET. Or on arrive ici
                  par une redirection, en croyant son compte supprimé — c'est
                  l'écran où l'annonce compte le plus. `ConfirmationBanner`
                  monte la région vide, la remplit, et porte le focus dessus. */}
              <ConfirmationBanner key={n} message={MESSAGES_ERREUR[err]} ton="alerte" />
              {err === "echec" && (
                <p className="mt-2 text-sm text-gray-light">
                  Si ça se répète,{" "}
                  <LienTexte href="/contact">écris-nous</LienTexte> et on
                  traitera ta demande à la main.
                </p>
              )}
            </div>
          )}
          {/* Nom et e-mail viennent de la BASE, pas de la session : le serveur
              compare à `getUserById`, et une session périmée après un
              changement de nom ferait accepter au client une valeur que le
              serveur refuse. */}
          {/* `key` sur le nonce du refus : sans elle, la fenêtre de
              confirmation restait OUVERTE au retour (même route, même position
              dans l'arbre → l'état Radix survit), et comme elle vit dans le
              formulaire sans Portal, ses frères passent en `aria-hidden` : le
              message d'échec était masqué par l'incrustation ET invisible au
              lecteur d'écran. Remonter la referme, et vide la saisie — ce que
              le message demande justement de refaire. */}
          <DeleteAccountButton
            key={n}
            name={compte?.name ?? null}
            email={compte?.email ?? null}
          />
        </section>
      </div>
    </>
  );
}
