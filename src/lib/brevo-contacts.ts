import { brevoClient } from "@/lib/brevo-client";
import { pool } from "@/lib/db";
import type { ProfileStatus } from "@/lib/profiles";

/**
 * SYNCHRONISATION DES CONTACTS VERS BREVO — la lettre d'information.
 *
 * Deux canaux, séparés exprès :
 * - le **service** (lien de connexion, décision de publication, message reçu,
 *   rappel) part de la plateforme, en transactionnel, et ne se refuse pas ;
 * - la **lettre d'information** part de Brevo, avec son lien de désabonnement
 *   natif. Se désabonner du marketing ne coupe donc jamais le service.
 *
 * La plateforme reste la SOURCE DE VÉRITÉ des membres : elle pousse vers Brevo
 * l'adresse et les quelques attributs qui servent à segmenter (fiche en ligne,
 * Tremplin, coach, orga). Brevo reste la source de vérité du DÉSABONNEMENT : on
 * ne renvoie jamais `EMAIL_BLACKLISTED`, sinon une désinscription faite depuis
 * un e-mail serait effacée à la synchro suivante.
 *
 * PÉRIMÈTRE : cette synchro pousse les COMPTES de la plateforme, et eux seuls.
 * Elle ne prétend PAS représenter l'association : celle-ci comptera des
 * adhérentes et des adhérents sans compte ici (la plateforme est réservée aux
 * femmes et aux personnes non binaires), et des contacts d'écosystème
 * (conférences, partenaires) qui n'en auront jamais. Ceux-là vivent dans leurs
 * propres listes Brevo, alimentées par HelloAsso ou à la main — Brevo est
 * l'UNION des populations, la plateforme n'en est qu'une.
 *
 * D'où deux règles de cohabitation, tenues par le code :
 * - on n'écrit QUE nos attributs (`emptyContactsAttributes: false`), donc un
 *   attribut d'adhésion posé par ailleurs survit à chacun de nos passages ;
 * - la SYNCHRO ne retire jamais personne de la liste : elle pousse, un point
 *   c'est tout. Le seul retrait du module est `supprimerContactBrevo`, appelé
 *   par la suppression d'un compte (RGPD) — et il efface ce que la plateforme a
 *   écrit, pas ce que les autres écrivent (voir sa documentation).
 *
 * Cf. `docs/conception-synchro-contacts.md` (qui écrit quoi).
 */

/** Attributs poussés vers Brevo. Le strict nécessaire au ciblage (minimisation). */
export interface AttributsContact {
  PRENOM: string;
  NOM: string;
  /** État de la fiche speakeuse (un fait : en ligne, à publier, aucune…). */
  FICHE: EtatFiche;
  /** Segment « on peut l'inviter à publier sa fiche » (décision, pas fait). */
  INVITER_FICHE: boolean;
  /** Années d'édition du Tremplin, séparées par des virgules (« 2026 »). */
  TREMPLIN: string;
  /** Inscrite à la phase « montée sur scène » d'une édition. */
  MONTEE_SUR_SCENE: boolean;
  COACH: boolean;
  ORGA: boolean;
}

/**
 * Les états de fiche tels qu'une orga les segmente dans Brevo. Volontairement
 * en français et sans jargon : c'est ce qu'on lit dans l'éditeur de campagne.
 */
export type EtatFiche =
  | "en_ligne"
  | "a_publier"
  | "en_relecture"
  | "en_retrait"
  | "aucune";

/** Ligne brute d'un compte joignable, telle que la base la rend. */
export interface CompteASynchroniser {
  userId: number;
  email: string;
  name: string | null;
  status: string | null;
  genre: string | null;
  isCoach: boolean;
  isOrga: boolean;
  tremplin: string;
  monteeSurScene: boolean;
}

export interface ContactBrevo {
  email: string;
  attributes: AttributsContact;
}

/**
 * L'état de la fiche — un FAIT, rien d'autre. Le `Record` force l'exhaustivité :
 * un statut ajouté au produit devient une erreur de compilation ici, pas un
 * contact mal étiqueté dans Brevo. « a_publier » couvre le brouillon et le
 * refus : dans les deux cas la fiche existe et attend le même geste.
 */
export function etatFiche(status: string | null): EtatFiche {
  const connus: Record<ProfileStatus, EtatFiche> = {
    publie: "en_ligne",
    en_attente: "en_relecture",
    masque: "en_retrait",
    // Hors annuaire, mais pas à inviter à publier : le geste attendu est
    // l'adhésion, que la plateforme lui demande déjà.
    en_pause: "en_retrait",
    brouillon: "a_publier",
    refuse: "a_publier",
  };
  return status ? connus[status as ProfileStatus] : "aucune";
}

/**
 * Faut-il l'inviter à publier sa fiche ? C'est une DÉCISION de ciblage, tenue
 * à part de l'état : mélanger les deux faisait dire « aucune fiche » à
 * quelqu'un qui en a une en brouillon, juste pour l'exclure d'un envoi.
 *
 * Le genre « homme » l'exclut : la fiche demande d'attester être une femme ou
 * une personne non binaire, et inviter à un geste impossible est une faute, pas
 * une maladresse (même garde que la feuille ➕, `src/lib/feuille-creer.ts`).
 * Un retrait volontaire de l'annuaire l'exclut aussi : c'est un choix, qu'une
 * relance viendrait piétiner.
 */
export function inviterAPublier({
  status,
  genre,
}: {
  status: string | null;
  genre: string | null;
}): boolean {
  const etat = etatFiche(status);
  return (etat === "a_publier" || etat === "aucune") && genre !== "homme";
}

/** Prénom / nom séparés à partir du nom du compte (Brevo attend les deux). */
export function separerNom(name: string | null): { prenom: string; nom: string } {
  const morceaux = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (morceaux.length === 0) return { prenom: "", nom: "" };
  return { prenom: morceaux[0], nom: morceaux.slice(1).join(" ") };
}

/** Les attributs d'un compte. Pure : c'est la règle qu'on veut lire et tester. */
export function attributsPour(compte: CompteASynchroniser): AttributsContact {
  const { prenom, nom } = separerNom(compte.name);
  return {
    PRENOM: prenom,
    NOM: nom,
    FICHE: etatFiche(compte.status),
    INVITER_FICHE: inviterAPublier({ status: compte.status, genre: compte.genre }),
    TREMPLIN: compte.tremplin,
    MONTEE_SUR_SCENE: compte.monteeSurScene,
    COACH: compte.isCoach,
    ORGA: compte.isOrga,
  };
}

/**
 * Les comptes joignables ET abonnés. On écarte les adresses absentes, les
 * adresses factices de la migration de l'annuaire (`.invalid`) et les personnes
 * désabonnées : une désinscription doit sortir la personne de la synchro, pas
 * seulement la faire ignorer par Brevo.
 */
export async function comptesASynchroniser(): Promise<CompteASynchroniser[]> {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.genre, u.is_coach, u.is_orga, sp.status,
            COALESCE(t.annees, '')   AS tremplin,
            COALESCE(t.montee, false) AS montee
       FROM users u
       LEFT JOIN speaker_profiles sp ON sp."userId" = u.id
       LEFT JOIN LATERAL (
         SELECT string_agg(DISTINCT e.annee::text, ',') AS annees,
                bool_or(rp.phase = 'montee_sur_scene')  AS montee
           FROM tremplin_registrations r
           JOIN tremplin_editions e ON e.id = r.edition_id
           LEFT JOIN tremplin_registration_phases rp ON rp.registration_id = r.id
          WHERE r."userId" = u.id AND e.deleted_at IS NULL
       ) t ON true
      WHERE u.email IS NOT NULL
        AND u.email NOT LIKE '%.invalid'
        AND u.newsletter_optout_at IS NULL
      ORDER BY u.id`,
  );

  return (
    rows as {
      id: number;
      email: string;
      name: string | null;
      genre: string | null;
      is_coach: boolean;
      is_orga: boolean;
      status: string | null;
      tremplin: string;
      montee: boolean;
    }[]
  ).map((r) => ({
    userId: r.id,
    email: r.email,
    name: r.name,
    status: r.status,
    genre: r.genre,
    isCoach: r.is_coach === true,
    isOrga: r.is_orga === true,
    tremplin: r.tremplin,
    monteeSurScene: r.montee === true,
  }));
}

/** Combien de personnes ont refusé la lettre d'information (état, écran orga). */
export async function compterDesabonnees(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM users WHERE newsletter_optout_at IS NOT NULL`,
  );
  return (rows[0] as { n: number } | undefined)?.n ?? 0;
}

/**
 * Identifiant de la liste Brevo des COMPTES de la plateforme. En environnement,
 * jamais en dur : la liste se crée une fois dans Brevo (à côté de celle des
 * adhésions et de celle de l'écosystème) et on colle son numéro. La créer
 * depuis le code demanderait de choisir un dossier à la place de l'orga, pour
 * un geste qui n'arrive qu'une fois.
 */
export function listeComptes(): number | null {
  const brut = process.env.BREVO_LIST_COMPTES;
  const id = Number(brut);
  return brut && Number.isInteger(id) && id > 0 ? id : null;
}

/** Taille d'un lot d'import : Brevo accepte large, on reste prudent et lisible. */
export const LOT_SYNC_MAX = 100;

/**
 * Les attributs personnalisés doivent EXISTER dans Brevo avant l'import, sinon
 * il rejette le lot entier. On les crée au besoin ; un attribut déjà là renvoie
 * une erreur qu'on avale (c'est le résultat voulu, pas un échec).
 */
export async function assurerAttributs(): Promise<void> {
  for (const [nom, type] of Object.entries(TYPES_ATTRIBUTS)) {
    try {
      await brevoClient().contacts.createAttribute({
        attributeCategory: "normal",
        attributeName: nom,
        type,
      });
    } catch {
      // Déjà présent : c'est exactement l'état recherché.
    }
  }
}

/**
 * NOS attributs personnalisés et leur type Brevo. `PRENOM`/`NOM` en sont
 * absents : ce sont des attributs natifs du compte Brevo, qui existent déjà.
 *
 * Le `Record` sur les clés d'`AttributsContact` force l'exhaustivité, comme
 * celui d'`etatFiche`. Sans lui, ajouter un attribut à la synchro compilait, et
 * l'attribut n'était jamais CRÉÉ chez Brevo : l'import nocturne rejetait le lot
 * entier, et l'effacement d'un contact détaché se faisait refuser — soit un
 * compte insupprimable, exactement ce que la garde « sans-liste » existe pour
 * éviter. Trois tables listent ces attributs (`attributsPour`, celle-ci,
 * `ATTRIBUTS_VIDES`) : toutes les trois échouent maintenant à la compilation.
 */
const TYPES_ATTRIBUTS: Record<
  keyof Omit<AttributsContact, "PRENOM" | "NOM">,
  "text" | "boolean"
> = {
  FICHE: "text",
  INVITER_FICHE: "boolean",
  TREMPLIN: "text",
  MONTEE_SUR_SCENE: "boolean",
  COACH: "boolean",
  ORGA: "boolean",
};

/** Découpe une liste en lots (import Brevo, et lisibilité des erreurs). */
export function enLots<T>(items: readonly T[], taille: number): T[][] {
  const lots: T[][] = [];
  for (let i = 0; i < items.length; i += taille) {
    lots.push(items.slice(i, i + taille));
  }
  return lots;
}

/**
 * Pousse les contacts dans la liste « Comptes plateforme ».
 *
 * `updateExistingContacts` met à jour ce qui existe (une synchro se rejoue), et
 * `emptyContactsAttributes: false` garde les attributs qu'on ne gère pas ici.
 * On n'envoie JAMAIS `EMAIL_BLACKLISTED` : une désinscription faite depuis un
 * e-mail Brevo doit survivre à toutes les synchros suivantes.
 */
export async function envoyerContactsVersBrevo(
  contacts: readonly ContactBrevo[],
  listId: number,
): Promise<number> {
  let envoyes = 0;
  for (const lot of enLots(contacts, LOT_SYNC_MAX)) {
    await brevoClient().contacts.importContacts({
      listIds: [listId],
      updateExistingContacts: true,
      emptyContactsAttributes: false,
      disableNotification: true,
      jsonBody: lot.map((c) => ({
        email: c.email,
        attributes: { ...c.attributes } as Record<string, unknown>,
      })),
    });
    envoyes += lot.length;
  }
  return envoyes;
}

/**
 * Ce qu'une suppression de contact a trouvé chez Brevo. Un résultat, pas un
 * booléen : « déjà absent », « détaché » et « supprimé » sont trois succès à
 * raisons différentes, qu'on ne saurait plus distinguer après coup. Aujourd'hui
 * ce sont les tests qui le lisent (chaque chemin se juge à son résultat) ; le
 * jour où le compte-rendu du cron voudra dire lequel, la donnée est là.
 */
export type ResultatSuppressionContact =
  /** Contact effacé : il ne vivait que par nous. */
  | "supprime"
  /** Retiré de NOTRE liste, nos attributs vidés : d'autres listes le portent. */
  | "detache"
  /** Rien chez Brevo : le résultat voulu, atteint sans nous. */
  | "absent"
  /** Adresse absente ou factice (`.invalid`) : jamais poussée. */
  | "hors-perimetre"
  /** Aucune clé d'API (dev, aperçu) : rien n'a jamais été poussé d'ici. */
  | "sans-cle"
  /** Aucune liste configurée, et d'autres listes portent ce contact : rien de
   *  nous à retirer (la synchro s'arrête avant l'import sans `BREVO_LIST_COMPTES`). */
  | "sans-liste";

/**
 * Nos attributs de ciblage, remis à zéro — sans PRENOM ni NOM (cf. ci-dessous).
 *
 * Le type force l'exhaustivité, comme le `Record` d'`etatFiche` : un attribut
 * ajouté à `AttributsContact` (et poussé par la synchro) devient une erreur de
 * compilation ICI, au lieu de survivre en silence sur le contact d'une personne
 * qui a demandé son effacement.
 */
const ATTRIBUTS_VIDES: Omit<AttributsContact, "PRENOM" | "NOM"> = {
  FICHE: "aucune",
  INVITER_FICHE: false,
  TREMPLIN: "",
  MONTEE_SUR_SCENE: false,
  COACH: false,
  ORGA: false,
};

/** Le code HTTP porté par une erreur du SDK, quand il y en a un. */
function statutHttp(err: unknown): number | null {
  const code = (err as { statusCode?: unknown } | null)?.statusCode;
  return typeof code === "number" ? code : null;
}

/**
 * Une panne du sous-traitant, redite SANS L'ADRESSE.
 *
 * Le SDK identifie le contact par l'e-mail dans le CHEMIN de l'URL
 * (`contacts/ada%40ex.fr`), et l'erreur qu'il lève porte cette URL dans
 * `rawResponse`, plus le corps de la réponse. Journaliser l'erreur brute
 * écrirait donc l'adresse en clair dans les logs — sur le chemin de
 * l'effacement RGPD, c'est-à-dire précisément pour quelqu'un qui vient de
 * demander qu'on l'oublie, et pour une adresse qui n'existera bientôt plus
 * nulle part ailleurs. `journal-erreurs.ts` pose la même règle pour la chaîne
 * de requête ; ici la donnée est dans le chemin.
 *
 * On ne garde que le code HTTP : c'est ce qui sert à décider (retenter, ou
 * appeler le support du sous-traitant).
 */
function pannePropre(err: unknown): Error {
  const statut = statutHttp(err);
  return new Error(
    `Brevo a refusé l'effacement du contact${statut === null ? "" : ` (HTTP ${statut})`}`,
  );
}

/**
 * LE DROIT À L'EFFACEMENT, JUSQU'AU SOUS-TRAITANT.
 *
 * La synchro ne poussait que des contacts : un compte supprimé devenait
 * simplement absent de la poussée suivante, et son contact restait dans la
 * liste « Comptes plateforme » avec ses attributs, indéfiniment — la lettre
 * d'information continuait de lui parvenir (dette P0-6, 2026-08-16).
 *
 * Ce qu'on efface, et ce qu'on laisse : Brevo est l'**union** de trois
 * populations (comptes, adhésions HelloAsso, écosystème), et la discipline de
 * cohabitation veut qu'un écrivain ne touche QUE ce qu'il écrit
 * (`docs/conception-synchro-contacts.md`). D'où deux chemins :
 *
 * - le contact ne vit que par nous (notre liste, ou aucune) → il est
 *   **supprimé**, c'est le cas de l'immense majorité des comptes ;
 * - une AUTRE liste le porte (une adhérente à l'association, un contact
 *   écosystème) → on le **détache** de notre liste et on vide nos attributs de
 *   ciblage. Le supprimer effacerait le travail de HelloAsso pour quelqu'un qui
 *   reste membre de l'association. `PRENOM`/`NOM` restent : ce sont les champs
 *   d'identité que les trois populations partagent, et la personne demeure une
 *   contact de l'association par une autre porte.
 *
 * LÈVE en cas de panne, exprès : l'appelant tient encore l'adresse, seul moyen
 * d'aller chercher ce contact. Renoncer et retenter vaut mieux qu'effacer la
 * base et perdre la trace pour toujours.
 */
export async function supprimerContactBrevo(
  email: string | null,
): Promise<ResultatSuppressionContact> {
  const adresse = email?.trim() ?? "";
  // Les adresses factices de la migration de l'annuaire sont exclues de la
  // synchro (`comptesASynchroniser`) : aucune n'a jamais atteint Brevo.
  if (adresse === "" || adresse.endsWith(".invalid")) return "hors-perimetre";
  // Avant `brevoClient()`, qui LÈVE sans clé : dev et aperçu doivent pouvoir
  // supprimer un compte.
  if (!process.env.BREVO_API_KEY) return "sans-cle";
  const contacts = brevoClient().contacts;

  // Un seul `try` pour les trois appels : quel que soit celui qui tombe,
  // l'erreur qui remonte est propre — l'adresse ne sort jamais d'ici.
  try {
    const info = await contacts.getContactInfo({ identifier: adresse });
    const listes = info.listIds ?? [];

    const notreListe = listeComptes();
    if (listes.every((id) => id === notreListe)) {
      // Aucune liste du tout : le contact vient de nos envois transactionnels
      // (Brevo crée un contact à la première adresse servie), donc il est à
      // nous et part avec le compte.
      await contacts.deleteContact({ identifier: adresse, identifierType: "email_id" });
      return "supprime";
    }

    // Sans liste configurée, la plateforme n'a JAMAIS rien poussé : la synchro
    // s'arrête sur `sans-liste` avant l'import, donc ni appartenance ni
    // attributs de notre fait. Un contact qu'une AUTRE liste porte ne nous
    // appartient donc pas — et le détacher reviendrait à retirer des attributs
    // que le compte Brevo n'a même pas (`assurerAttributs` ne tourne pas non
    // plus), soit un rejet qui rendrait le compte INSUPPRIMABLE.
    if (notreListe === null) return "sans-liste";

    // Retrait de liste ET vidage des attributs en UN geste (`unlinkListIds`) :
    // en deux appels, le second pouvait échouer après le premier et laisser un
    // contact détaché qui garde nos attributs de ciblage.
    await contacts.updateContact({
      identifier: adresse,
      attributes: ATTRIBUTS_VIDES,
      unlinkListIds: listes.includes(notreListe) ? [notreListe] : undefined,
    });
    return "detache";
  } catch (err) {
    if (statutHttp(err) === 404) return "absent";
    throw pannePropre(err);
  }
}

/** Ce qu'une synchro a fait, dit de la même façon au bouton et au cron. */
export interface ResultatSync {
  /** Contacts poussés (0 quand il n'y a rien à pousser). */
  contacts: number;
  /** Renseigné quand la synchro n'a PAS eu lieu, et pourquoi. */
  ignore?: "sans-liste";
}

/**
 * LA synchro des COMPTES, appelée par le bouton de l'écran orga ET par le cron
 * quotidien.
 *
 * Une seule fonction pour les deux, exprès : deux copies auraient divergé au
 * premier ajout d'attribut, et c'est précisément le genre d'écart qu'on ne
 * verrait qu'en lisant les contacts dans Brevo.
 *
 * Pousse la liste ENTIÈRE à chaque passage. À l'échelle d'une communauté (des
 * centaines de contacts, pas des millions), un envoi complet coûte deux ou
 * trois appels et n'a aucun état à tenir : pas de journal des modifications à
 * maintenir, donc pas de journal à réparer le jour où il se désynchronise.
 */
export async function synchroniserComptes(): Promise<ResultatSync> {
  const listId = listeComptes();
  if (listId === null) return { contacts: 0, ignore: "sans-liste" };

  const comptes = await comptesASynchroniser();
  const contacts = comptes.map((c) => ({ email: c.email, attributes: attributsPour(c) }));
  await assurerAttributs();
  return { contacts: await envoyerContactsVersBrevo(contacts, listId) };
}
