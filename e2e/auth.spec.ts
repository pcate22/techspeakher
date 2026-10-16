import { test, expect, type BrowserContext, type APIRequestContext } from "@playwright/test";
import { seConnecter, MEMBRE, ORGA, type RoleE2E } from "./session";

/**
 * LES GARDES D'ACCÈS, EN VRAI CÂBLAGE (proxy + auth.config).
 *
 * POURQUOI CE FICHIER A ÉTÉ RÉÉCRIT. La version précédente n'affirmait que des
 * redirections ANONYMES, et elle ne pouvait pas échouer. La CI E2E ne posait
 * pas d'`AUTH_SECRET` : Auth.js échouait au déchiffrement de session
 * (`MissingSecret`), `req.auth` valait `null` pour tout le monde, et le proxy
 * redirigeait quelle que soit la logique de `authConfig`. Mesuré en remplaçant
 * les gardes par « laisse tout passer » : les trois tests restaient verts. Une
 * porte qui ne peut pas tomber est indiscernable d'une porte absente — et
 * celle-ci était pourtant cochée « RÉSOLU » dans `docs/dette-technique.md`.
 *
 * ON JUGE LE BORD, PAS L'ÉCRAN D'ARRIVÉE. C'est la deuxième leçon, et elle a
 * coûté un aller-retour : chaque page privée pose EN PLUS sa propre garde
 * serveur (`requireOrgaPage`, ou un `redirect()` en tête de page). Un test qui
 * regarde où le navigateur atterrit est donc vert même quand le proxy ne filtre
 * plus rien — c'est la garde de page qui rattrape, en silence. Vérifié : en
 * neutralisant `refusDAcces`, les assertions « au navigateur » restaient vertes
 * et seules celles-ci tombaient.
 *
 * D'où la forme : on interroge le serveur SANS suivre les redirections et sans
 * exécuter de JavaScript. Ce qu'on affirme alors est exactement « le proxy a
 * refusé », et rien d'autre. Ça compte au-delà du style : c'est cette couche
 * qui protège une page admin qu'on ajouterait un jour sans sa garde.
 *
 * Ce que ces tests ne couvrent pas encore, faute de décor de données : ce que
 * les pages affichent une fois la porte franchie, et les gardes des Server
 * Actions (cf. `docs/audit-e2e-parcours-2026-08.md` §5.2).
 */

/** L'en-tête `cookie` d'un rôle, pour interroger le serveur hors navigateur. */
async function enteteCookie(context: BrowserContext, role: RoleE2E): Promise<string> {
  await seConnecter(context, role);
  const cookies = await context.cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

/** La décision du PROXY sur un chemin : la redirection brute, ou `null`. */
async function decisionDuProxy(
  request: APIRequestContext,
  chemin: string,
  cookie?: string,
): Promise<string | null> {
  const res = await request.get(chemin, {
    headers: cookie ? { cookie } : {},
    maxRedirects: 0,
  });
  if (res.status() !== 307 && res.status() !== 308) return null;
  return res.headers()["location"] ?? null;
}

test.describe("Gardes d'accès", () => {
  test("/connexion se charge sans erreur", async ({ page }) => {
    const res = await page.goto("/connexion");
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/Connexion/i);
    await expect(page.getByRole("heading", { name: /connexion/i })).toBeVisible();
  });

  /**
   * LA SONDE, avant tout le reste : une session fabriquée par les tests est-elle
   * réellement lue par le serveur ? Tant qu'elle échoue, TOUTE affirmation sur
   * les rôles ci-dessous est vide de sens — c'est exactement l'état dans lequel
   * la suite a vécu jusqu'ici, sans que rien ne le dise. Même esprit que le
   * `expect(socle.total).toBeGreaterThan(50)` d'`a11y.spec.ts` : on vérifie que
   * la mesure a bien eu lieu avant de croire son résultat.
   */
  test("une session fabriquée est bien reconnue par le serveur", async ({
    context,
    page,
  }) => {
    await seConnecter(context, MEMBRE);
    const res = await page.goto("/api/auth/session");
    expect(res?.status()).toBe(200);
    const session = await res!.json();
    expect(
      session?.user,
      "Le serveur n'a pas déchiffré la session forgée. Sans ça, les tests de " +
        "rôle ci-dessous ne mesurent rien : vérifier qu'AUTH_SECRET est posé " +
        "pour le serveur de test ET pour les workers (cf. e2e/session.ts).",
    ).toBeTruthy();
    expect(String(session.user.id)).toBe(String(MEMBRE.id));
    expect(session.user.isOrga).toBe(false);
  });

  test.describe("/mon-espace — réservé aux personnes connectées", () => {
    test("anonyme : refusée au bord, vers /connexion", async ({ request }) => {
      expect(await decisionDuProxy(request, "/mon-espace")).toContain("/connexion");
    });

    // La moitié qui manquait. Sans elle, une garde qui refuse TOUT LE MONDE
    // passe la suite au vert alors que plus personne n'accède à son espace.
    test("membre connectée : laissée passer", async ({ context, request }) => {
      const cookie = await enteteCookie(context, MEMBRE);
      expect(await decisionDuProxy(request, "/mon-espace", cookie)).toBeNull();
    });
  });

  test.describe("/admin — réservé aux orgas", () => {
    test("anonyme : refusée au bord, vers /connexion", async ({ request }) => {
      expect(await decisionDuProxy(request, "/admin")).toContain("/connexion");
    });

    /**
     * L'ESCALADE DE PRIVILÈGE, la raison d'être de ce fichier : une membre
     * parfaitement légitime, connectée, qui tape /admin dans la barre d'adresse.
     * Ce cas ne vivait qu'en unitaire, sur le callback isolé — et c'est
     * précisément ce qui l'avait laissé passer : le proxy appelait le callback
     * mais jetait sa réponse. Le premier passage de ce test l'a attrapé (200 sur
     * /admin, /admin/messages, /admin/reglages…, au lieu d'une redirection).
     *
     * On balaie plusieurs chemins : une garde posée sur la seule racine /admin
     * laisserait les sous-pages ouvertes.
     */
    test("membre connectée SANS rôle orga : refusée au bord", async ({
      context,
      request,
    }) => {
      const cookie = await enteteCookie(context, MEMBRE);
      for (const chemin of [
        "/admin",
        "/admin/messages",
        "/admin/reglages",
        "/admin/tremplins",
        "/admin/adhesions",
        "/admin/adhesions/inviter",
      ]) {
        expect(
          await decisionDuProxy(request, chemin, cookie),
          `${chemin} devrait être refusé PAR LE PROXY (et non par la garde de page)`,
        ).toContain("/mon-espace");
      }
    });

    test("orga : laissée passer par le proxy", async ({ context, request }) => {
      const cookie = await enteteCookie(context, ORGA);
      expect(await decisionDuProxy(request, "/admin", cookie)).toBeNull();
    });
  });

  /**
   * Le trajet tel que la personne le vit : une membre connectée qui vise
   * l'admin ne doit pas tomber sur un écran de connexion — elle A une session.
   * Elle rejoint son espace.
   */
  test("une membre qui vise /admin atterrit dans son espace", async ({ context, page }) => {
    await seConnecter(context, MEMBRE);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/mon-espace/);
  });

  /**
   * Le `matcher` du proxy (`src/proxy.ts`) ne couvre que /mon-espace et /admin.
   * Un matcher trop large fermerait le site public d'un coup — et aucun test ne
   * s'en apercevait.
   */
  test("les pages publiques échappent au proxy", async ({ request }) => {
    for (const chemin of ["/", "/speakeuses", "/contact", "/connexion"]) {
      expect(
        await decisionDuProxy(request, chemin),
        `${chemin} devrait rester public`,
      ).toBeNull();
    }
  });
});
