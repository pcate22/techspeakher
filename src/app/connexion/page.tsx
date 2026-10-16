import type { Metadata } from "next";
import { isMagicLinkEnabled } from "@/lib/magic-link";
import { isGoogleEnabled, isLinkedInEnabled, OAUTH_PROVIDER_LABELS } from "@/auth.config";
import { getLastSignInMethod, type SignInMethod } from "@/lib/last-signin-method";
import Breadcrumb from "@/components/Breadcrumb";
import LienTexte from "@/components/LienTexte";
import { signInWithGoogle, signInWithLinkedIn, signInWithEmail } from "./actions";

export const metadata: Metadata = {
  title: "Connexion | Tech Speak'Her",
  description: "Connecte-toi à ton espace Tech Speak'Her.",
  robots: { index: false },
  alternates: { canonical: "/connexion" },
};

export const dynamic = "force-dynamic";

/** Messages d'erreur Auth.js, traduits pour les membres. */
const ERROR_MESSAGES: Record<string, string> = {
  Configuration:
    "Problème de configuration côté serveur. Réessaie dans un instant ; si ça persiste, préviens l’équipe organisatrice.",
  AccessDenied:
    "Accès refusé. Ton compte n'est pas autorisé (ou l'application est encore en mode test).",
  OAuthAccountNotLinked:
    "Cette adresse est déjà liée à une autre méthode de connexion. Utilise la même qu'au départ.",
  Verification: "Le lien de connexion a expiré. Réessaie.",
  throttle: "Trop de demandes de lien. Patiente une minute avant de réessayer.",
  default: "La connexion a échoué. Réessaie.",
};

/** Libellé de la méthode dans la phrase « La dernière fois, tu t'es connectée avec… ». */
const LAST_METHOD_LABEL: Record<SignInMethod, string> = {
  google: "Google",
  linkedin: "LinkedIn",
  email: "un lien par e-mail",
};

const BTN_PRIMARY =
  "w-full px-4 py-3 rounded-full font-medium bg-cyan text-navy hover:bg-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-navy transition-colors";
const BTN_SECONDARY =
  "w-full px-4 py-3 rounded-full font-medium bg-navy border border-cyan/40 text-cyan hover:border-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-navy transition-colors";

function OAuthButton({ id, primary }: { id: "google" | "linkedin"; primary: boolean }) {
  return (
    <form action={id === "google" ? signInWithGoogle : signInWithLinkedIn}>
      <button type="submit" className={primary ? BTN_PRIMARY : BTN_SECONDARY}>
        Se connecter avec {OAUTH_PROVIDER_LABELS[id]}
      </button>
    </form>
  );
}

/** Bloc « lien magique » (intro + champ e-mail). Le garde-fou anti-abus et la
 * gestion d'erreur vivent dans l'action `signInWithEmail`. */
function EmailBlock() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-light">
        Sans compte Google ou LinkedIn&nbsp;? Saisis ton adresse et on t&apos;envoie un
        lien de connexion.
      </p>
      <form action={signInWithEmail} className="flex flex-col gap-3">
        <label htmlFor="email" className="block text-left text-sm text-gray-light">
          Adresse e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="ton@email.com"
          className="w-full bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
        />
        <button type="submit" className={BTN_SECONDARY}>
          Recevoir un lien de connexion
        </button>
      </form>
      <p className="text-xs text-gray-light">
        On t&apos;envoie un lien&nbsp;: un clic et tu es connectée, sans mot de passe.
      </p>
    </div>
  );
}

function Separator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <span className="h-px flex-1 bg-navy-lighter" />
      <span className="text-xs text-gray-light">{label}</span>
      <span className="h-px flex-1 bg-navy-lighter" />
    </div>
  );
}

export default async function Connexion({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; compte?: string }>;
}) {
  const { error, compte } = await searchParams;
  // Code connu → message dédié ; code inconnu → message générique + le code brut
  // (utile pour diagnostiquer sans fouiller les logs minifiés).
  const message = error
    ? (ERROR_MESSAGES[error] ?? `${ERROR_MESSAGES.default} (code : ${error})`)
    : null;
  const compteSupprime = compte === "supprime";
  // On n'affiche que les méthodes réellement configurées (un bouton vers un
  // provider non configuré mènerait à une erreur).
  const google = isGoogleEnabled();
  const linkedin = isLinkedInEnabled();
  const magicLink = isMagicLinkEnabled();
  const aucuneMethode = !google && !linkedin && !magicLink;

  // Méthodes disponibles, dans l'ordre d'affichage par défaut.
  const available: SignInMethod[] = [
    ...(google ? (["google"] as const) : []),
    ...(linkedin ? (["linkedin"] as const) : []),
    ...(magicLink ? (["email"] as const) : []),
  ];
  // Dernière méthode utilisée sur cet appareil, si elle est encore disponible :
  // on la met en avant (« la dernière fois, tu t'es connectée avec… ») pour
  // guider vers la même porte et éviter un doublon de compte involontaire.
  const last = await getLastSignInMethod();
  const featured = last && available.includes(last) ? last : null;
  const others = available.filter((m) => m !== featured);

  const renderMethod = (m: SignInMethod, primary: boolean) =>
    m === "email" ? (
      <EmailBlock key={m} />
    ) : (
      <OAuthButton key={m} id={m} primary={primary} />
    );

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Connexion" }]} />
      <div className="py-20 px-4">
        <section
          aria-labelledby="connexion-title"
          className="max-w-md mx-auto bg-navy-light border border-navy-lighter rounded-xl p-8 text-center"
        >
          <h1 id="connexion-title" className="text-2xl font-bold mb-2">
            <span className="text-cyan">Connexion</span> ou inscription
          </h1>
          <p className="text-sm text-gray-light mb-2">
            Connecte-toi pour accéder à ton espace (profil speakeuse, Tremplin…).
          </p>
          <p className="text-sm text-gray-light mb-2">
            Première fois&nbsp;? C&apos;est la même porte&nbsp;: ta première connexion
            crée ton compte automatiquement, sans mot de passe.
          </p>
          {/* La condition d'adhésion se lit ICI, avant de créer un compte, et
              nulle part ailleurs dans le parcours. C'est le dernier écran avant
              l'engagement : l'apprendre après coup serait la découvrir trop
              tard, pour une visiteuse comme pour un examinateur Ad Grants qui
              suit le chemin d'une annonce. La règle elle-même vit sur
              /a-propos, une seule fois. Voir docs/google-ad-grants.md §4 bis.

              La deuxième phrase existe parce que la règle est annoncée AVANT
              d'entrer en vigueur (choix assumé : mieux vaut l'annoncer tôt que
              la découvrir tard). Sans elle, l'écran énonçait une condition sans
              aucun moyen de la remplir — une impasse pour qui vient de lire la
              première phrase, et une contradiction avec les actualités et le
              courriel d'invitation, qui annoncent tous deux une ouverture à
              venir. C'est la SEULE page qui porte le calendrier : /a-propos
              énonce la règle, cet écran dit quand elle s'applique. */}
          <p className="text-sm text-gray-light mb-8">
            Figurer dans l&apos;annuaire et accéder aux services suppose
            l&apos;adhésion à l&apos;association et à son règlement intérieur.
            Les adhésions sont ouvertes&nbsp;:{" "}
            <LienTexte href="/adherer">adhérer à Tech&nbsp;Speak&apos;Her</LienTexte>.
          </p>

          {compteSupprime && (
            <p
              role="status"
              className="text-sm text-cyan bg-cyan/10 border border-cyan/30 rounded-lg p-3 mb-6"
            >
              Ton compte a bien été supprimé. À bientôt&nbsp;!
            </p>
          )}

          {message && (
            <p
              role="alert"
              className="text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg p-3 mb-6"
            >
              {message}
            </p>
          )}

          {aucuneMethode && (
            <p className="text-sm text-gray-light">
              La connexion sera bientôt disponible. En attendant, écris-nous via le
              formulaire de contact.
            </p>
          )}

          {featured ? (
            <div className="flex flex-col">
              <p className="text-sm text-cyan mb-3">
                La dernière fois sur cet appareil, tu t&apos;es connectée avec{" "}
                <span className="font-semibold">{LAST_METHOD_LABEL[featured]}</span>.
              </p>
              {renderMethod(featured, true)}
              {others.length > 0 && (
                <>
                  <Separator label="Autres options" />
                  <div className="flex flex-col gap-3">
                    {others.map((m) => renderMethod(m, false))}
                  </div>
                </>
              )}
            </div>
          ) : (
            available.length > 0 && (
              <div className="flex flex-col gap-3">
                {(google || linkedin) && (
                  <div className="flex flex-col gap-3">
                    {google && <OAuthButton id="google" primary />}
                    {linkedin && <OAuthButton id="linkedin" primary={!google} />}
                  </div>
                )}
                {magicLink && (
                  <div className={google || linkedin ? "mt-3" : ""}>
                    {(google || linkedin) && <Separator label="ou par e-mail" />}
                    <EmailBlock />
                  </div>
                )}
              </div>
            )
          )}

          <p className="text-xs text-gray-light mt-8 leading-relaxed">
            On ne récupère que ton nom et ton adresse e-mail pour créer ton compte. Tes
            données ne sont jamais publiées sans ton accord.
          </p>
        </section>
      </div>
    </>
  );
}
