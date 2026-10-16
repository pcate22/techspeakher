import { test, expect } from "@playwright/test";

/**
 * LE CONTRAT HTTP : redirections, en-têtes, ressources annexes.
 *
 * Tout ce fichier garde des choses qui vivent dans `next.config.ts` — donc hors
 * de portée d'un test de composant — et qui cassent SANS BRUIT. Une redirection
 * perdue, ce sont des liens d'e-mails déjà envoyés et du référencement acquis
 * qui tombent en 404 ; une directive CSP retirée par mégarde, un affichage qui
 * meurt chez la visiteuse sans qu'aucune page ne change d'un octet. Rien de
 * tout ça ne se voit à la relecture d'une diff, et rien ne le gardait.
 *
 * Sans navigateur (fixture `request`) : ces assertions ne dépendent ni du
 * viewport ni du JavaScript, d'où le `testIgnore` du projet mobile.
 */

/**
 * Les redirections que le dépôt a promises, une par raison. La colonne
 * « statut » n'est pas décorative : 301/308 sont mises en cache par le
 * navigateur et par les moteurs (permanent), 307 ne l'est pas — se tromper de
 * code, c'est soit graver une erreur chez les visiteuses, soit perdre le
 * bénéfice SEO du renommage.
 */
const REDIRECTIONS = [
  {
    de: "/charte",
    vers: "/code-de-conduite",
    statut: 301,
    pourquoi: "ancienne URL de la charte, renommée",
  },
  {
    de: "/articles",
    vers: "/actualites",
    statut: 307,
    pourquoi: "la liste des articles a fusionné avec les actualités",
  },
  {
    de: "/tremplin/2026",
    vers: "/tremplin/devfest-toulouse/2026",
    statut: 308,
    pourquoi: "l'édition est servie par la route pilotée par la base",
  },
  {
    de: "/tremplin/participantes",
    vers: "/tremplin/devfest-toulouse/2026#participantes",
    statut: 308,
    pourquoi: "la galerie statique court-circuitait le consentement",
  },
  {
    de: "/mon-espace/profil/parcours",
    vers: "/mon-espace/fiche/parcours",
    statut: 308,
    pourquoi: "« Mon profil » a pris /mon-espace/profil, la fiche a déménagé",
  },
  {
    de: "/admin/taches",
    vers: "/mon-espace/a-faire?vue=association",
    statut: 308,
    pourquoi: "« À faire » a déménagé dans l'espace connecté (étape B)",
  },
  {
    de: "/admin/conferences?prop=validee&talks=1",
    vers: "/admin/conferences/propositions?prop=validee&talks=1",
    statut: 308,
    pourquoi:
      "l'arbitrage a sa page, et cette adresse est celle qu'une orga a sous les yeux après chaque « Valider »",
  },
] as const;

/**
 * Le REVERS de la redirection ci-dessus : elle est conditionnée à un paramètre,
 * donc il faut aussi garder ce qu'elle NE prend PAS. Sans cette assertion, une
 * `source` élargie par mégarde enverrait le catalogue entier sur la file — et
 * les 130 conférences référencées deviendraient inatteignables.
 */
test.describe("Redirections — ce qui ne bouge pas", () => {
  for (const url of ["/admin/conferences", "/admin/conferences?seed=3"]) {
    test(`${url} reste le catalogue`, async ({ request }) => {
      const res = await request.get(url, { maxRedirects: 0 });
      // Le catalogue est derrière la garde orga : sans session, le proxy renvoie
      // vers la connexion. Ce qui compte ici est qu'il ne parte JAMAIS sur la
      // file d'arbitrage — quel que soit le statut que la garde décide.
      expect(res.headers()["location"] ?? "").not.toContain("/propositions");
    });
  }
});

test.describe("Redirections", () => {
  for (const r of REDIRECTIONS) {
    test(`${r.de} → ${r.vers} (${r.statut} : ${r.pourquoi})`, async ({ request }) => {
      const res = await request.get(r.de, { maxRedirects: 0 });
      expect(res.status()).toBe(r.statut);
      // `location` peut être absolue : on compare la fin du chemin.
      expect(res.headers()["location"]).toContain(r.vers);
    });
  }
});

/**
 * Les en-têtes de sécurité. On les NOMME un à un plutôt que de comparer la
 * chaîne entière : une CSP se complète au fil des besoins (un nouveau domaine
 * d'avatar, une iframe partenaire), et une égalité stricte transformerait
 * chaque ajout légitime en échec. Ce qu'on garde, ce sont les directives qui ne
 * doivent JAMAIS disparaître.
 */
test.describe("En-têtes de sécurité", () => {
  test("les en-têtes sont posés sur une page publique", async ({ request }) => {
    const h = (await request.get("/")).headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("SAMEORIGIN");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["permissions-policy"]).toContain("camera=()");
  });

  test("la CSP garde ses directives de fond", async ({ request }) => {
    const csp = (await request.get("/")).headers()["content-security-policy"];
    expect(csp, "aucune CSP servie").toBeTruthy();
    for (const directive of [
      "default-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      // Empêche qu'un formulaire injecté poste vers un tiers.
      "form-action 'self'",
    ]) {
      expect(csp, `directive perdue : ${directive}`).toContain(directive);
    }
  });

  /**
   * Les espaces authentifiés ne doivent pas être resservis depuis le cache du
   * navigateur : sur iOS notamment, une vieille copie d'une page personnelle
   * peut réapparaître après déconnexion.
   */
  for (const espace of ["/mon-espace", "/admin"]) {
    test(`${espace} interdit la mise en cache`, async ({ request }) => {
      const res = await request.get(espace, { maxRedirects: 0 });
      expect(res.headers()["cache-control"]).toContain("no-store");
    });
  }
});

/**
 * Les ressources annexes : personne ne les ouvre à la main, donc personne ne
 * remarque qu'elles sont tombées. Elles portent pourtant le référencement
 * (sitemap, robots), les abonnements (RSS) et l'identité de marque.
 */
test.describe("Ressources annexes", () => {
  const RESSOURCES = [
    { chemin: "/feed.xml", type: /xml/ },
    { chemin: "/sitemap.xml", type: /xml/ },
    { chemin: "/robots.txt", type: /text/ },
    { chemin: "/llms.txt", type: /text/ },
    { chemin: "/brand/tokens.json", type: /json/ },
    // Le kit de communication : l'archive est construite au build par une
    // route (`force-static`), les fichiers sont servis depuis `public/kit/`.
    { chemin: "/kit-de-communication/tech-speakher-kit-communication.zip", type: /zip/ },
    { chemin: "/kit/tech-speakher-logo-complet-fond-sombre.png", type: /png/ },
  ];

  for (const r of RESSOURCES) {
    test(`${r.chemin} répond`, async ({ request }) => {
      const res = await request.get(r.chemin);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toMatch(r.type);
    });
  }

  test("le sitemap annonce les pages publiques principales", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    // Agnostique aux données : on n'exige que les routes STATIQUES, celles qui
    // ne dépendent pas de la base (les fiches et articles s'y ajoutent en prod).
    for (const route of ["/tremplin", "/speakeuses", "/actualites", "/code-de-conduite"]) {
      expect(xml, `${route} absente du sitemap`).toContain(route);
    }
  });

  test("robots.txt pointe le sitemap", async ({ request }) => {
    const txt = await (await request.get("/robots.txt")).text();
    expect(txt.toLowerCase()).toContain("sitemap");
  });
});
