import type { NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";

/**
 * Un provider OAuth n'est activé que si ses identifiants sont présents en env.
 * Sert aussi à l'UI de connexion : on n'affiche un bouton que pour un provider
 * réellement configuré (sinon le clic mène à une erreur « Configuration »).
 */
export function isGoogleEnabled(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}
export function isLinkedInEnabled(): boolean {
  return Boolean(process.env.AUTH_LINKEDIN_ID && process.env.AUTH_LINKEDIN_SECRET);
}

/** Libellés d'affichage des providers OAuth (source unique, pages + écrans). */
export const OAUTH_PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  linkedin: "LinkedIn",
};

/**
 * Ids des providers OAuth réellement CONFIGURÉS. Source unique de la liste
 * {google, linkedin} filtrée par l'activation, pour les surfaces qui ont besoin
 * de la LISTE (incitation au regroupement, écrans de connexion…) et pas des
 * objets `Provider` d'Auth.js (`buildProviders`). Évite de ré-énumérer la paire
 * à la main à chaque appelant.
 */
export function enabledOAuthProviders(): string[] {
  const ids: string[] = [];
  if (isGoogleEnabled()) ids.push("google");
  if (isLinkedInEnabled()) ids.push("linkedin");
  return ids;
}

/**
 * Construit la liste des providers OAuth selon les variables d'environnement
 * présentes. Un provider déclaré sans clientId/secret fait échouer la
 * validation globale d'Auth.js (erreur « Configuration ») → on n'active que
 * ceux qui sont réellement configurés.
 */
export function buildProviders(): Provider[] {
  const providers: Provider[] = [];
  // allowDangerousEmailAccountLinking : permet à une même personne de se
  // connecter indifféremment via Google OU LinkedIn (même compte), en liant
  // par l'e-mail. Sûr ici car Google et LinkedIn renvoient un e-mail VÉRIFIÉ
  // (le risque d'usurpation viendrait d'un provider à e-mail non vérifié).
  // AUCUN provider ne pose de photo tout seul. Sans cette redéfinition,
  // l'adapter recopie `picture` dans `users.image` dès la première connexion :
  // une URL qu'on ne maîtrise pas, signée et périssable côté LinkedIn
  // (`media.licdn.com`), qui laissait l'avatar retomber sur les initiales des
  // semaines plus tard sans que personne comprenne pourquoi. La photo se
  // choisit explicitement (champ Photo), et sa copie vit chez nous — y compris
  // pour LinkedIn, qu'on va justement CHERCHER quand on la demande.
  const sansPhoto = (p: { sub: string; name?: string; email?: string }) => ({
    id: p.sub,
    name: p.name,
    email: p.email,
    image: null,
  });
  if (isGoogleEnabled()) {
    providers.push(
      Google({ allowDangerousEmailAccountLinking: true, profile: sansPhoto }),
    );
  }
  if (isLinkedInEnabled()) {
    providers.push(
      LinkedIn({ allowDangerousEmailAccountLinking: true, profile: sansPhoto }),
    );
  }
  return providers;
}

/**
 * Configuration Auth.js « edge-safe » (sans adapter base de données).
 * Utilisée à la fois par le proxy (edge) et par l'instance Node (auth.ts).
 *
 * Les identifiants OAuth sont lus depuis les variables d'environnement :
 * AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET et AUTH_LINKEDIN_ID / AUTH_LINKEDIN_SECRET.
 * (Aucun secret n'est écrit dans le code.)
 */
/**
 * LA DÉCISION D'ACCÈS, en un seul endroit : `null` = laisser passer, sinon la
 * page où renvoyer.
 *
 * Elle a été extraite de `authorized` parce que le proxy ne pouvait pas
 * l'appliquer autrement. Auth.js n'honore le verdict d'`authorized` QUE si le
 * proxy ne fournit pas son propre gestionnaire : dans `handleAuth`
 * (`next-auth/lib/index.js`), `else if (userMiddlewareOrRoute)` court-circuite
 * `else if (!authorized)`. Or `src/proxy.ts` fournit un gestionnaire — le
 * callback était donc appelé et **son résultat jeté**. Mesuré : une membre
 * connectée sans rôle orga recevait 200 sur /admin, /admin/messages,
 * /admin/reglages… La porte tenait quand même, mais par la SEULE garde de page
 * (`requireOrgaPage`) : une page admin ajoutée sans elle serait lisible par
 * n'importe quelle personne connectée. Attrapé par `e2e/auth.spec.ts` — le test
 * unitaire, lui, jugeait le callback isolé et ne pouvait pas voir que le proxy
 * ignorait sa réponse.
 *
 * La destination compte autant que le refus : une non-orga est CONNECTÉE, la
 * renvoyer vers /connexion lui montrerait un écran de login alors qu'elle a une
 * session. Elle rejoint son espace — même choix que `requireOrgaPage`.
 */
export function refusDAcces(
  pathname: string,
  user: { isOrga?: boolean } | null | undefined,
): string | null {
  const prive = pathname.startsWith("/admin") || pathname.startsWith("/mon-espace");
  if (!user) return prive ? "/connexion" : null;
  // /admin : réservé aux orgas. /mon-espace : toute membre connectée.
  if (pathname.startsWith("/admin") && user.isOrga !== true) return "/mon-espace";
  return null;
}

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/connexion", verifyRequest: "/connexion/verifie" },
  providers: buildProviders(),
  callbacks: {
    // Protège les routes privées. Le proxy applique `refusDAcces` lui-même (il
    // a besoin de la DESTINATION, pas d'un booléen) ; ce callback garde la même
    // source de vérité pour tout autre appelant d'Auth.js.
    authorized({ auth, request: { nextUrl } }) {
      return refusDAcces(nextUrl.pathname, auth?.user) === null;
    },
    // Expose l'id du compte et le rôle orga dans la session.
    session({ session, token }) {
      if (session.user) {
        if (token.sub) session.user.id = token.sub;
        session.user.isOrga = token.isOrga === true;
        session.user.isCoach = token.isCoach === true;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
