import type { NextConfig } from "next";
import { BASE_URL } from "./src/constants/site";

const cspDirectives = [
  "default-src 'self'",
  // challenges.cloudflare.com : widget anti-robot Turnstile du formulaire de
  // contact (script + iframe + appels de vérification). Chargé UNIQUEMENT si
  // NEXT_PUBLIC_TURNSTILE_SITE_KEY est définie ; l'autorisation reste ici en
  // permanence pour que la CSP soit la même en preview et en prod.
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  // Avatars des comptes : CDN de photos de LinkedIn (*.licdn.com) et Google
  // (*.googleusercontent.com). Sans ça, la CSP bloque l'affichage des photos de
  // profil OAuth et l'avatar retombe sur les initiales.
  // Images uploadées (articles/pages + avatars, lot 6) : Vercel Blob. Le
  // sous-domaine exact de NOTRE store n'est connu qu'une fois créé (cf.
  // docs/exploitation.md) ; le motif générique couvre donc TOUT store Blob de
  // la plateforme, pas seulement le nôtre — accepté (le champ `imageUrl` admin
  // acceptait déjà n'importe quelle URL http/https avant l'upload). À resserrer
  // au sous-domaine exact une fois le store créé, si souhaité. Migration OVH
  // prévue (docs/conception-articles.md §6) : ce domaine sera remplacé, pas
  // ajouté à côté, quand l'adaptateur `lib/media.ts` bascule.
  "img-src 'self' data: blob: https://*.licdn.com https://*.googleusercontent.com https://*.public.blob.vercel-storage.com",
  "font-src 'self'",
  "connect-src 'self' https://vitals.vercel-insights.com https://docs.google.com https://challenges.cloudflare.com",
  "frame-src https://the-playground.fr https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: cspDirectives },
];

const nextConfig: NextConfig = {
  trailingSlash: false,
  images: {
    // Miniatures des vidéos de notre chaîne YouTube (dérivées de l'URL de la
    // vidéo, cf. src/lib/youtube.ts). Next les récupère CÔTÉ SERVEUR et les
    // ressert depuis `/_next/image` : le navigateur ne contacte jamais Google,
    // la CSP reste à `img-src 'self'` et aucune requête tierce n'est émise à
    // l'affichage d'une page.
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
      // Images uploadées sur Vercel Blob (lot 6, articles/pages + avatars).
      // Motif générique (tout store Blob de la plateforme) : voir le
      // commentaire de la CSP ci-dessus pour le compromis.
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.techspeakher.fr" }],
        destination: `${BASE_URL}/:path*`,
        statusCode: 301,
      },
      // Ancienne URL du code de conduite : redirection permanente 301 pour que
      // /charte ne devienne pas une page morte (404) après le renommage. Le 301
      // transmet le référencement (link equity) vers /code-de-conduite et
      // indique aux moteurs que la page a été déplacée définitivement.
      {
        source: "/charte",
        destination: "/code-de-conduite",
        statusCode: 301,
      },
      // Lot N1 : « Mon profil » a pris /mon-espace/profil, la fiche et ses
      // sections vivent sur /mon-espace/fiche. Redirection permanente pour
      // que les liens profonds et e-mails passés continuent d'aboutir
      // (même mécanisme que /charte : le renommage appartient à la config,
      // pas à une page rendue).
      {
        source: "/mon-espace/profil/:section",
        destination: "/mon-espace/fiche/:section",
        statusCode: 308,
      },
      // Étape B : « À faire » a déménagé dans l'espace connecté, en vue
      // « Pour l'association », ce que cette adresse a toujours montré. Les
      // e-mails quotidiens déjà envoyés portent ce lien (risque 2 de la
      // conception). D'abord écrit en `permanentRedirect()` dans la page :
      // derrière le `loading.tsx`, Next streamait un 200 puis redirigeait
      // côté client, et l'audit axe de la CI mourait en pleine analyse
      // (« Execution context was destroyed »). Le renommage appartient à la
      // config, pas à une page rendue (même leçon que /charte et
      // /mon-espace/profil ci-dessus).
      //
      // Ce 308 précède le proxy : une non-orga qui suit un vieux lien atteint
      // la destination au lieu d'être renvoyée vers /mon-espace, et y voit sa
      // liste à elle, vide — `chargerTaches` ne charge que ce que la session
      // lit (gardé par e2e/espaces-connectes.spec.ts, le miroir membre).
      {
        source: "/admin/taches",
        destination: "/mon-espace/a-faire?vue=association",
        statusCode: 308,
      },
      // L'arbitrage des conférences proposées a sa page (2026-08-21) : le
      // catalogue portait 113 cartes à deux boutons, et ses messages de
      // validation avec. Les adresses de ces messages existent DÉJÀ dans les
      // historiques de navigation — `/admin/conferences?prop=validee&talks=1`
      // est celle qu'une orga a sous les yeux après chaque clic « Valider ».
      // Sans ce 308, elles arrivent sur le catalogue, qui ne lit plus `prop` :
      // l'écran ne dit plus rien de ce qui vient de se passer.
      //
      // Conditionnée à la présence de `prop` : le catalogue reste le catalogue,
      // et ses propres messages (`supprimee`, `seed`) restent chez lui. Next
      // reporte les autres paramètres de requête (`talks`) sur la destination,
      // donc le compte de talks publiés survit au renommage.
      //
      // Dans la config et pas dans la page, comme les quatre au-dessus : un
      // `redirect()` rendu derrière un `loading.tsx` streame un 200 puis
      // redirige côté client, ce qui a déjà tué l'audit axe de la CI.
      {
        source: "/admin/conferences",
        has: [{ type: "query", key: "prop" }],
        destination: "/admin/conferences/propositions",
        statusCode: 308,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // Espaces authentifiés (admin orga, espace participante) : contenu
      // dynamique et propre à chaque personne. Sans `no-store`, un navigateur
      // (Safari iOS notamment) peut resservir une vieille copie en cache (ex.
      // une fiche atelier sans une modification tout juste déployée). On force
      // le re-téléchargement à chaque affichage.
      {
        source: "/admin/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        source: "/mon-espace/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
