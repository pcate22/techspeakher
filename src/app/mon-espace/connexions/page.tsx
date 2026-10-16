import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Breadcrumb from "@/components/Breadcrumb";
import Button from "@/components/Button";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { getLinkedProviders, canUnlinkProvider } from "@/lib/accounts";
import { getUserById } from "@/lib/users";
import { isMagicLinkEnabled } from "@/lib/magic-link";
import { isGoogleEnabled, isLinkedInEnabled, OAUTH_PROVIDER_LABELS } from "@/auth.config";
import { linkProviderAction, unlinkProviderAction } from "./actions";

export const metadata: Metadata = {
  title: "Mes connexions | Tech Speak'Her",
  robots: { index: false },
  alternates: { canonical: "/mon-espace/connexions" },
};

export const dynamic = "force-dynamic";

/**
 * MES CONNEXIONS — un seul rôle : par quels moyens j'entre dans mon compte.
 *
 * La page en portait deux. Un bouton « Utiliser cette photo » par provider y
 * changeait l'avatar, alors que la photo se choisit maintenant là où elle
 * s'affiche (le champ Photo de la fiche, `ChampPhoto`) : deux endroits pour le
 * même geste, dont un qui parle de sécurité. Il est parti avec le mécanisme
 * qu'il portait — un aller-retour OAuth complet, jamais annoncé, pour un
 * simple avatar.
 *
 * Ce qui reste tient en une ligne par méthode : son nom, son état en toutes
 * lettres, et AU PLUS une action. Sur téléphone, la ligne passe en colonne :
 * avec deux boutons collés à droite, « Rattaché à ton compte » se repliait un
 * mot par ligne.
 */

/** L'état d'une méthode, en toutes lettres (jamais par la couleur seule) et à
 * la forme positive — « Non rattaché » disait ce qui n'est pas. */
function Etat({ texte, actif }: { texte: string; actif: boolean }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${
        actif
          ? "border-cyan/40 bg-cyan/10 text-cyan"
          : "border-navy-lighter text-gray-light"
      }`}
    >
      {texte}
    </span>
  );
}

/**
 * L'action d'UNE méthode : au plus une, et trois issues à plat plutôt qu'un
 * ternaire à deux niveaux dans le JSX. L'intitulé NOMME sa méthode — « Délier »
 * deux fois de suite se ressemblait trop, au lecteur d'écran comme à l'œil.
 */
function ActionMethode({
  id,
  label,
  isLinked,
  canRemove,
}: {
  id: string;
  label: string;
  isLinked: boolean;
  canRemove: boolean;
}) {
  if (!isLinked) {
    return (
      <form action={linkProviderAction} className="sm:shrink-0">
        <input type="hidden" name="provider" value={id} />
        <Button type="submit" size="sm">
          Lier {label}
        </Button>
      </form>
    );
  }
  if (canRemove) {
    return (
      <form action={unlinkProviderAction} className="sm:shrink-0">
        <input type="hidden" name="provider" value={id} />
        <ConfirmSubmitButton
          title={`Délier ${label} ?`}
          message={`Ton compte et ta fiche restent intacts. Tu te connecteras avec tes autres méthodes, et tu pourras rattacher ${label} de nouveau quand tu veux.`}
          confirmLabel={`Délier ${label}`}
          aria-label={`Délier ${label}`}
        >
          Délier
        </ConfirmSubmitButton>
      </form>
    );
  }
  // Le garde-fou anti-lockout, dit AVANT le clic plutôt qu'en message d'erreur
  // après coup.
  return (
    <span className="text-xs text-gray-light sm:shrink-0 sm:text-right sm:max-w-[14rem]">
      Ta seule façon de te connecter : ajoute-en une autre pour pouvoir délier
      celle-ci.
    </span>
  );
}

export default async function MesConnexions({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");
  const uid = Number(session.user.id);

  const { ok, error } = await searchParams;
  const [linked, user] = await Promise.all([getLinkedProviders(uid), getUserById(uid)]);
  const magicLinkEnabled = isMagicLinkEnabled();
  const opts = { hasEmail: Boolean(user?.email), magicLinkEnabled };

  // Providers OAuth réellement configurés côté serveur : on ne propose de lier
  // qu'une méthode qui marche (un bouton vers un provider absent mène à une
  // erreur « Configuration »).
  const oauth = [
    { id: "google", enabled: isGoogleEnabled() },
    { id: "linkedin", enabled: isLinkedInEnabled() },
  ].filter((p) => p.enabled);

  const okMsg =
    ok === "liee"
      ? "Méthode de connexion liée ✓"
      : ok === "deliee"
        ? "Méthode de connexion déliée ✓"
        : null;
  const errorMsg =
    error === "derniere"
      ? "Garde au moins une façon de te connecter : ajoute une autre méthode, puis reviens délier celle-ci."
      : error === "methode"
        ? "Méthode de connexion inconnue."
        : null;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Mon espace", href: "/mon-espace" },
          { label: "Mes connexions" },
        ]}
      />
      <div className="py-10 px-4">
        <section
          aria-labelledby="connexions-title"
          className="max-w-2xl mx-auto bg-navy-light border border-navy-lighter rounded-xl p-6 sm:p-8"
        >
          <h1 id="connexions-title" className="text-2xl font-bold mb-2">
            Mes <span className="text-cyan">connexions</span>
          </h1>
          <p className="text-sm text-gray-light mb-6">
            Rattache plusieurs méthodes à ton compte pour te connecter avec l&apos;une
            ou l&apos;autre, indifféremment, même si elles n&apos;utilisent pas la même
            adresse e-mail. Ça t&apos;évite de créer un deuxième compte sans le vouloir.
          </p>

          {okMsg && (
            <p
              role="status"
              className="text-sm text-cyan bg-cyan/10 border border-cyan/30 rounded-lg px-4 py-3 mb-6"
            >
              {okMsg}
            </p>
          )}
          {errorMsg && (
            <p
              role="alert"
              className="text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg px-4 py-3 mb-6"
            >
              {errorMsg}
            </p>
          )}

          <ul className="flex flex-col gap-3 list-none" role="list">
            {oauth.map(({ id }) => {
              const label = OAUTH_PROVIDER_LABELS[id];
              const isLinked = linked.includes(id);
              const canRemove = isLinked && canUnlinkProvider(id, linked, opts);
              return (
                <li
                  key={id}
                  className="flex flex-col gap-3 bg-navy border border-navy-lighter rounded-lg px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-white">{label}</span>
                    <span className="mt-1 block">
                      <Etat
                        texte={isLinked ? "Rattaché à ton compte" : "À rattacher"}
                        actif={isLinked}
                      />
                    </span>
                  </span>
                  <ActionMethode id={id} label={label} isLinked={isLinked} canRemove={canRemove} />
                </li>
              );
            })}

            {/* Lien magique : pas une ligne `accounts`, c'est l'e-mail du compte.
                Toujours disponible (donc jamais « liable/déliable ») dès qu'il est
                activé et que le compte a une adresse. */}
            {magicLinkEnabled && opts.hasEmail && (
              <li className="flex flex-col gap-3 bg-navy border border-navy-lighter rounded-lg px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="min-w-0">
                  <span className="block font-medium text-white">
                    Lien magique par e-mail
                  </span>
                  <span className="mt-1 block">
                    <Etat texte="Rattaché à ton compte" actif />
                  </span>
                  {/* L'adresse en entier : tronquée, elle ne servait plus à
                      reconnaître le compte (« pcate22@gma… »). */}
                  <span className="mt-1 block text-xs text-gray-light break-all">
                    Toujours disponible sur {user?.email}
                  </span>
                </span>
              </li>
            )}
          </ul>

          <p className="text-xs text-gray-light mt-6">
            Lier une méthode te redirige une fois vers le service choisi pour
            confirmer que c&apos;est bien toi, puis te ramène ici.
          </p>
        </section>
      </div>
    </>
  );
}
