import { test, type APIRequestContext } from "@playwright/test";

/**
 * LE DÉCOR DE DONNÉES : ce que les tests peuvent tenir pour acquis.
 *
 * Jusqu'ici la CI E2E tournait sans base : l'annuaire était vide, l'agenda
 * vide, la page d'édition du Tremplin renvoyait 500, et les portes RGAA et
 * débordement n'auditaient donc QUE des états vides — aucune carte de
 * speakeuse, aucune fiche, n'avait jamais été soumise à axe en vrai navigateur
 * (cf. `docs/audit-e2e-parcours-2026-08.md` §3.2).
 *
 * Le décor vient de `db/seed-preview.sql`, le jeu de données fictives que le
 * dépôt maintient déjà pour les previews. Personnes toutes INVENTÉES
 * (@demo.techspeakher.test) : aucune donnée personnelle réelle n'entre en CI.
 *
 * ON NOMME CE DONT ON DÉPEND, ici et une seule fois. Un test qui se réfère à
 * « Léa Dubois » en clair au milieu d'une assertion crée une dépendance
 * invisible au seed ; regroupées, ces constantes disent explicitement le
 * contrat entre le décor et les tests, et un seed qui change casse à un seul
 * endroit lisible.
 */

/** Une speakeuse PUBLIÉE qui a ouvert le contact par e-mail. */
export const LEA = {
  nom: "Léa Dubois",
  /** Son adresse ne doit JAMAIS apparaître dans une page servie. */
  email: "lea@demo.techspeakher.test",
  fiche: "/speakeuses/1",
} as const;

/** Publiée, mais qui n'a PAS ouvert le contact : sa page de contact n'existe pas. */
export const AICHA = {
  nom: "Aïcha Benali",
  email: "aicha@demo.techspeakher.test",
  fiche: "/speakeuses/2",
} as const;

/** Fiche EN ATTENTE de modération : invisible du public, visible de l'orga. */
export const YASMINE = {
  nom: "Yasmine Roche",
  email: "yasmine@demo.techspeakher.test",
} as const;

/**
 * Fiche restée en BROUILLON, sans changement depuis deux mois : la population
 * que la page de relance existe pour traiter. Invisible du public, et absente
 * de toute file de modération (personne ne l'a soumise) — sans elle, l'écran
 * `/admin/speakeuses/relances` ne serait jamais audité qu'à vide.
 */
export const INES = {
  nom: "Inès Kabbaj",
  email: "ines@demo.techspeakher.test",
} as const;

/**
 * LE JOUR ET L'ANNÉE DU DÉCOR — dérivés de la date du jour, comme le seed.
 *
 * `db/seed-preview.sql` date la conférence en cours à J+37 et en tire l'année
 * N de toutes ses éditions (N-1 archivée, N en cours, N+1 en préparation). Une
 * année écrite en dur ici vieillissait : l'édition « 2026 » datée en 2027, puis
 * sortie des éditions récentes de l'import (dette P2 soldée le 2026-10-14). Le
 * décalage est écrit deux fois, en SQL et ici : `seed-preview-dates.test.ts`
 * les tient égaux. Limite connue : Node lit la date LOCALE, Postgres celle de
 * son fuseau ; en local, la nuit du 24 au 25 novembre, les deux peuvent
 * diverger d'une année (en CI, runner et base sont tous deux en UTC).
 */
const JOURS_AVANT_LA_CONF = 37;
const jourDeConf = new Date();
jourDeConf.setDate(jourDeConf.getDate() + JOURS_AVANT_LA_CONF);

/** Le jour de la conférence en cours, AAAA-MM-JJ (date locale, comme `CURRENT_DATE`). */
export const DATE_CONF = jourDeConf.toLocaleDateString("sv-SE");
/** L'année N de l'édition en cours ; N-1 est archivée, N+1 en préparation. */
export const ANNEE = jourDeConf.getFullYear();

/** L'édition du Tremplin pilotée par la base (500 sans décor). */
export const EDITION = `/tremplin/devfest-toulouse/${ANNEE}`;

/**
 * L'AGENDA PUBLIC — ce que la section 8 de `db/seed-preview.sql` garantit.
 *
 * Toutes ses dates sont RELATIVES à `now()` : un décor calé sur des dates fixes
 * cesserait de distinguer le futur du passé l'année suivante, et les gardes se
 * tairaient sans que personne ne le remarque.
 */
export const AGENDA = {
  /** Interventions à venir, dont une en janvier de l'année PROCHAINE. */
  aVenir: 5,
  /**
   * Interventions passées, réparties sur les deux années révolues — dont UNE
   * annoncée au mois près. Cette dernière est le décor du défaut du 18/08 :
   * l'aperçu du passé n'acceptait qu'un jour exact, l'archive comptait la
   * période close, et l'écran promettait une carte qu'il ne montrait pas.
   */
  passees: 16,
  /** Le titre de la date passée AU MOIS PRÈS (sans jour). */
  titrePasseAuMois: "Ce mois-là, sans jour précis",
  /**
   * L'ENTRÉE DE L'AGENDA (lot 1) — ce que le décor promet aux filtres.
   *
   * Deux dates toulousaines portent la MÊME conférence sous deux libellés :
   * c'est le cas de la prod (« DevFest » vs « DevFest Toulouse »), et le seul
   * décor où une facette bâtie sur le libellé figé se trahit.
   */
  filtres: {
    /** `?ville=toulouse` : les deux DevFest, plus la date en ligne. */
    toulouse: 3,
    /** `?conference=devfest-toulouse` : les deux libellés, réunis. */
    devfest: 2,
    /** `?region=a-distance-visio` : la visio, et elle seule. */
    enLigne: 1,
  },
  /** La date SANS lieu : elle doit apparaître dans tous les filtres de lieu. */
  titreEnLigne: "Démarrer une communauté en visio",
  /**
   * Le titre de la date de janvier prochain. C'est LE repère de la bascule
   * d'année : un horizon calé sur l'année civile la perdrait, et le défaut
   * n'apparaîtrait qu'une semaine par an.
   */
  titreJanvierProchain: "Ce que janvier prochain nous réserve",
  /** Une date à venir hors registre : elle doit rester visible. */
  titreTexteLibre: "Migrer sans réveiller personne",
  /** Le talk d'une fiche EN ATTENTE : il ne doit paraître nulle part. */
  titreFicheNonPubliee: "Talk d'une fiche en attente",
} as const;

/**
 * LES COMPTES DU DÉCOR, pour les pages CONNECTÉES.
 *
 * `e2e/session.ts` fabrique des rôles hors base (ids 4001+) : ils suffisent à
 * juger ce que le PROXY décide, mais pas à afficher une page — celle-ci lit un
 * compte réel. Ici on vise donc les comptes que le seed a réellement créés.
 *
 * Les ids viennent de l'ordre d'insertion de `db/seed-preview.sql`. Si le seed
 * change d'ordre, les tests le disent tout de suite : chaque parcours vérifie
 * qu'il voit bien la BONNE personne, jamais seulement « une page s'affiche ».
 */
export const COMPTES = {
  /** Léa Dubois — membre, fiche publiée. */
  membre: { id: 5, nom: LEA.nom },
  /** Camille Rivière — orga. */
  orga: { id: 2, nom: "Camille Rivière", isOrga: true },
  /** Sofia Nguyen — coach (et speakeuse publiée). */
  coach: { id: 3, nom: "Sofia Nguyen", isCoach: true },
} as const;

/** Adresse de l'expéditrice d'un message transmis à Léa (sans compte). */
export const EXPEDITRICE_MESSAGE = "elodie@demo.techspeakher.test";

/** Toutes les adresses du décor : aucune ne doit fuir dans une page publique. */
export const EMAILS_DU_DECOR = [
  LEA.email,
  AICHA.email,
  YASMINE.email,
  INES.email,
  // L'expéditrice d'un message reçu par Léa via le relais de contact. Elle n'a
  // PAS de compte : son adresse ne vit que dans `contact_messages`, et elle
  // n'a rien à faire ailleurs que sur la page où Léa lit son message.
  EXPEDITRICE_MESSAGE,
] as const;

/** Marqueur de présence du décor, cherché dans l'index public de recherche. */
const MARQUEUR = LEA.nom;

let cache: boolean | undefined;

async function decorPresent(request: APIRequestContext): Promise<boolean> {
  if (cache !== undefined) return cache;
  try {
    const res = await request.get("/api/search/speakeuses");
    if (!res.ok()) return (cache = false);
    const items = (await res.json()) as Array<{ title?: string }>;
    cache = items.some((i) => i.title === MARQUEUR);
  } catch {
    cache = false;
  }
  return cache;
}

/**
 * À appeler dans un `beforeEach` des specs qui ont besoin de données.
 *
 * SILENCE ≠ SUCCÈS, dans les deux sens. En local, sans base, on IGNORE
 * explicitement : un test vert sur une base absente mentirait (c'est
 * exactement le défaut qu'avait `auth.spec.ts`). En CI en revanche, l'absence
 * de décor est une PANNE : le job est censé fournir Postgres et le seed, et un
 * skip silencieux ferait disparaître ces garde-fous sans que personne ne le
 * remarque — la suite passerait au vert en ayant cessé de vérifier ce pour quoi
 * elle existe.
 */
export async function exigerDecor(request: APIRequestContext): Promise<void> {
  if (await decorPresent(request)) return;

  if (process.env.CI) {
    throw new Error(
      "Décor de données ABSENT en CI. Le job e2e doit fournir Postgres " +
        "(service container), appliquer db/sync-to-latest.sql puis " +
        "scripts/seed-e2e.mjs. Sans décor, ces tests ne gardent plus rien : on " +
        "échoue plutôt que de les ignorer.",
    );
  }

  test.skip(
    true,
    "Décor de données absent. Pour le poser en local : lancer un Postgres, " +
      "puis DATABASE_URL=… npm run e2e:db",
  );
}
