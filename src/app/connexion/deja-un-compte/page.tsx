import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { isMagicLinkEnabled } from "@/lib/magic-link";
import { isGoogleEnabled, isLinkedInEnabled, OAUTH_PROVIDER_LABELS } from "@/auth.config";
import { isMagicLinkThrottled, clientIp } from "@/lib/rate-limit";
import Breadcrumb from "@/components/Breadcrumb";
import { continueAsNewAction as continueAsNew } from "./actions";

export const metadata: Metadata = {
  title: "Tu as peut-être déjà un compte | Tech Speak'Her",
  robots: { index: false },
  alternates: { canonical: "/connexion/deja-un-compte" },
};

export default async function DejaUnCompte({
  searchParams,
}: {
  searchParams: Promise<{ methode?: string }>;
}) {
  const { methode } = await searchParams;
  // La méthode que la personne vient d'essayer (celle qui aurait créé un
  // doublon). On ne la propose pas dans « ta méthode habituelle » : ce n'est
  // par définition pas celle de son compte existant.
  const tried = methode && methode in OAUTH_PROVIDER_LABELS ? methode : null;

  // Autres méthodes OAuth configurées (pour « regrouper » sur le compte existant).
  const autresOAuth = (["google", "linkedin"] as const).filter(
    (p) => p !== tried && (p === "google" ? isGoogleEnabled() : isLinkedInEnabled()),
  );
  const magicLink = isMagicLinkEnabled();

  return (
    <>
      <Breadcrumb
        items={[{ label: "Connexion", href: "/connexion" }, { label: "Déjà un compte ?" }]}
      />
      <div className="py-20 px-4">
        <section
          aria-labelledby="deja-title"
          className="max-w-md mx-auto bg-navy-light border border-navy-lighter rounded-xl p-8 text-center"
        >
          <h1 id="deja-title" className="text-2xl font-bold mb-2">
            Tu as peut-être <span className="text-cyan">déjà un compte</span>
          </h1>
          <p className="text-sm text-gray-light mb-2">
            Un compte à ton nom existe déjà chez nous. Si c&apos;est toi, connecte-toi
            avec ta méthode habituelle&nbsp;: tu retrouveras tout au même endroit
            (profil, talks, Tremplin).
          </p>
          <p className="text-sm text-gray-light mb-8">
            Se connecter avec une autre méthode que d&apos;habitude créerait un second
            compte, vide.
          </p>

          {/* Regrouper : se connecter avec sa méthode habituelle → compte existant. */}
          {(autresOAuth.length > 0 || magicLink) && (
            <div className="flex flex-col gap-3">
              {autresOAuth.map((p) => (
                <form
                  key={p}
                  action={async () => {
                    "use server";
                    await signIn(p, { redirectTo: "/mon-espace" });
                  }}
                >
                  <button
                    type="submit"
                    className="w-full px-4 py-3 rounded-full font-medium bg-cyan text-navy hover:bg-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-navy transition-colors"
                  >
                    Me connecter avec {OAUTH_PROVIDER_LABELS[p]}
                  </button>
                </form>
              ))}

              {magicLink && (
                <div className="mt-3">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="h-px flex-1 bg-navy-lighter" />
                    <span className="text-xs text-gray-light">ou par e-mail</span>
                    <span className="h-px flex-1 bg-navy-lighter" />
                  </div>
                  <form
                    action={async (formData: FormData) => {
                      "use server";
                      const email = (formData.get("email") ?? "").toString().trim();
                      if (!email) return;
                      const ip = clientIp(await headers());
                      if (isMagicLinkThrottled(ip, email)) {
                        redirect("/connexion?error=throttle");
                      }
                      try {
                        await signIn("email", { email, redirectTo: "/mon-espace" });
                      } catch (error) {
                        const digest = (error as { digest?: string } | null)?.digest;
                        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
                          throw error;
                        }
                        const code = (error as { type?: string } | null)?.type ?? "default";
                        redirect(`/connexion?error=${encodeURIComponent(code)}`);
                      }
                    }}
                    className="flex flex-col gap-3"
                  >
                    <label htmlFor="email" className="block text-left text-sm text-gray-light">
                      Adresse e-mail de ton compte
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder="ton@email.com"
                      className="w-full bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                    />
                    <button
                      type="submit"
                      className="w-full px-4 py-3 rounded-full font-medium bg-navy border border-cyan/40 text-cyan hover:border-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-navy transition-colors"
                    >
                      Recevoir un lien de connexion
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* Choix explicite : c'est bien un nouveau compte (non bloquant). */}
          {tried && (
            <form action={continueAsNew} className="mt-8">
              <input type="hidden" name="methode" value={tried} />
              <button
                type="submit"
                className="text-sm text-gray-light underline underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
              >
                Non, créer un nouveau compte avec {OAUTH_PROVIDER_LABELS[tried]}
              </button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
