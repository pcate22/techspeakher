// Vérifie qu'un déploiement est VIVANT et correctement câblé.
//
// Pourquoi ce script existe : le job de production migrait la base, construisait,
// déployait — et s'arrêtait là. Rien ne regardait le résultat. Une migration qui
// passe mal, une variable d'environnement absente, la base injoignable depuis
// Vercel : on l'apprenait parce qu'une membre écrivait.
//
// CE QU'IL VÉRIFIE, ET QUE LA CI NE PEUT PAS VOIR. Les tests de parcours jugent
// le CODE, sur un décor connu et des réglages de test. Celui-ci juge le
// DÉPLOIEMENT : l'environnement réel, la vraie base, les vraies données. Le même
// code peut être vert en CI et mort en prod.
//
// EN LECTURE SEULE, TOUJOURS. Il tourne contre la production : aucun compte
// créé, aucun e-mail envoyé, aucune écriture. Les parcours d'écriture restent
// en CI, là où les conséquences sont nulles — ils ne seront jamais jouables ici.
//
// Usage : node scripts/verifier-prod.mjs [url]   (défaut : la production)

const BASE = (process.argv[2] ?? process.env.SMOKE_URL ?? "https://techspeakher.fr").replace(
  /\/$/,
  "",
);

/** Nombre de passes : un alias Vercel fraîchement posé met parfois quelques secondes. */
const ESSAIS = 3;
const ATTENTE_MS = 10_000;

const echecs = [];
const ok = (nom) => console.log(`  ✓ ${nom}`);
const ko = (nom, detail) => {
  console.log(`  ✗ ${nom}\n      ${detail}`);
  echecs.push(`${nom} — ${detail}`);
};

async function recuperer(chemin, opts = {}) {
  const res = await fetch(`${BASE}${chemin}`, {
    redirect: "manual",
    headers: { "user-agent": "tsh-verif-prod" },
    ...opts,
  });
  return res;
}

async function verifier() {
  echecs.length = 0;

  // 1. Le site répond, et ce n'est pas une coquille vide. Un déploiement cassé
  //    peut très bien servir un 200 sur une page blanche.
  try {
    const res = await recuperer("/");
    const html = await res.text();
    if (res.status !== 200) ko("L'accueil répond", `statut ${res.status}`);
    else if (!/Tech\s*Speak/i.test(html)) ko("L'accueil répond", "page servie sans son contenu");
    else ok("L'accueil répond");
  } catch (e) {
    ko("L'accueil répond", e.message);
  }

  // 2. L'AUTHENTIFICATION EST CONFIGURÉE.
  //    Attention au piège : `/admin` redirige vers /connexion MÊME si l'auth est
  //    entièrement cassée (sans secret, aucune session n'est déchiffrable, donc
  //    tout le monde est refusé). Mesuré. C'est exactement ce qui rendait
  //    l'ancien test d'accès incapable d'échouer. Le témoin fiable est la route
  //    de session : 200 quand tout va bien, 500 « problem with the server
  //    configuration » dès qu'AUTH_SECRET manque.
  try {
    const res = await recuperer("/api/auth/session");
    if (res.status !== 200)
      ko("L'authentification est configurée", `session → ${res.status} (AUTH_SECRET absent ?)`);
    else ok("L'authentification est configurée");
  } catch (e) {
    ko("L'authentification est configurée", e.message);
  }

  // 3. LA BASE EST JOIGNABLE DEPUIS LA PRODUCTION — le contrôle le plus
  //    important, et le plus piégeux.
  //    L'annuaire répond 200 même quand la base se tait : il affiche alors
  //    « L'annuaire revient dans un instant ». Un contrôle qui regarde le code
  //    de réponse serait donc resté vert pendant tout l'incident du 2026-07-23
  //    (annuaire vide servi alors que 5 fiches étaient publiées).
  //    Le signal juste est le `noindex` que la page pose UNIQUEMENT en panne
  //    (cf. src/app/speakeuses/page.tsx). Il ne dépend pas du nombre de fiches :
  //    un annuaire légitimement vide reste indexable.
  try {
    const res = await recuperer("/speakeuses");
    const html = await res.text();
    if (res.status !== 200) ko("La base répond", `annuaire → ${res.status}`);
    else if (/name="robots"[^>]*noindex/i.test(html))
      ko("La base répond", "l'annuaire se déclare noindex : base injoignable");
    else ok("La base répond");
  } catch (e) {
    ko("La base répond", e.message);
  }

  // 4. Les pages pilotées par la donnée s'affichent vraiment.
  //    ADAPTATIF : on suit la première fiche que l'index publie, au lieu de
  //    coder un identifiant en dur. Aucune supposition sur le contenu de la
  //    production — et si l'annuaire est légitimement vide, on ne réclame rien.
  try {
    const res = await recuperer("/api/search/speakeuses");
    if (res.status !== 200) {
      ko("L'index de recherche répond", `statut ${res.status}`);
    } else {
      const items = await res.json();
      ok(`L'index de recherche répond (${items.length} fiche(s))`);
      const premiere = items.find((i) => typeof i.url === "string" && i.url.startsWith("/"));
      if (!premiere) {
        console.log("  · aucune fiche publiée : contrôle de fiche ignoré");
      } else {
        const f = await recuperer(premiere.url);
        const html = await f.text();
        if (f.status !== 200) ko("Une fiche s'affiche", `${premiere.url} → ${f.status}`);
        else ok("Une fiche s'affiche");
        // Le joyau du site : l'adresse d'une speakeuse ne sort jamais. Aucune
        // fiche ne porte de `mailto:` (le contact passe par un relais modéré) ;
        // les seuls du dépôt vivent sur /code-de-conduite et l'espace privé.
        if (/mailto:/i.test(html)) ko("Aucune adresse sur une fiche", `${premiere.url} en porte une`);
        else ok("Aucune adresse sur une fiche");
      }
    }
  } catch (e) {
    ko("L'index de recherche répond", e.message);
  }

  // 5. La configuration Next a bien été appliquée au déploiement.
  try {
    const res = await recuperer("/");
    const manquants = ["content-security-policy", "x-content-type-options", "x-frame-options"].filter(
      (h) => !res.headers.get(h),
    );
    if (manquants.length) ko("Les en-têtes de sécurité sont posés", `absents : ${manquants.join(", ")}`);
    else ok("Les en-têtes de sécurité sont posés");
  } catch (e) {
    ko("Les en-têtes de sécurité sont posés", e.message);
  }

  // 6. Ce que personne n'ouvre à la main, donc que personne ne voit tomber.
  for (const chemin of ["/feed.xml", "/sitemap.xml", "/robots.txt"]) {
    try {
      const res = await recuperer(chemin);
      if (res.status !== 200) ko(`${chemin} répond`, `statut ${res.status}`);
      else ok(`${chemin} répond`);
    } catch (e) {
      ko(`${chemin} répond`, e.message);
    }
  }

  return echecs.length === 0;
}

console.log(`Vérification du déploiement : ${BASE}\n`);

let succes = false;
for (let essai = 1; essai <= ESSAIS; essai++) {
  if (essai > 1) {
    console.log(`\n… nouvelle tentative ${essai}/${ESSAIS} dans ${ATTENTE_MS / 1000}s (propagation)\n`);
    await new Promise((r) => setTimeout(r, ATTENTE_MS));
  }
  succes = await verifier();
  if (succes) break;
}

if (succes) {
  console.log("\nDéploiement vérifié : OK.");
} else {
  console.error(
    `\n${echecs.length} contrôle(s) en échec :\n` +
      echecs.map((e) => `  - ${e}`).join("\n") +
      "\n\nLe déploiement est en ligne mais ne se comporte pas comme attendu." +
      "\nRetour arrière immédiat possible depuis Vercel (déploiement précédent).",
  );
  process.exit(1);
}
