import { cache } from "react";
import {
  getAteliersByEdition,
  getAtelierMembersByEdition,
  type Atelier,
  type MembreAtelier,
} from "@/lib/tremplin-ateliers";
import { getCoachsByEdition, type Coach } from "@/lib/tremplin-coachs";
import { getRecompensesByEdition, type Recompense } from "@/lib/tremplin-recompenses";
import {
  getPhotosByEdition,
  getPhotoTagsByEdition,
  photoPubliable,
  type PhotoTag,
} from "@/lib/tremplin-photos";
import { getRegistrationsByEdition } from "@/lib/tremplin-registrations";
import { siSchemaEnRetard, siTableAbsente } from "@/lib/pg-errors";
import { getPendingProfiles, getProfilesPubliesSansNom, getProfilesEnSommeilBrefs } from "@/lib/profiles";
import { listArticlesEnRelecture } from "@/lib/articles-membres";
import { countPendingContactMessages } from "@/lib/contact-message";
import { resumeFilePropositions } from "@/lib/conference-propositions";
import { nb } from "@/lib/format";
import { listEditions, aujourdhuiParis } from "@/lib/tremplin-editions";
import { getReglages } from "@/lib/reglages";
import { getSession } from "@/lib/auth-guards";
import {
  deriverTaches,
  reclameUnGeste,
  type EditionEntrees,
  type Tache,
} from "@/lib/taches";

/**
 * Chargement des entrées du moteur de tâches pour UNE édition (partagé entre
 * le tableau de bord /admin et le hub d'édition, lot C3). Une passe de
 * requêtes en parallèle, normalisée en `EditionEntrees` ; les compteurs bruts
 * servent à la sous-page Suppression (périmètre chiffré du retrait).
 */
export interface EditionChargee {
  entrees: EditionEntrees;
  /** Les ateliers COMPLETS (déjà chargés pour le moteur) : le hub d'édition en
   * dérive le « prochain rendez-vous » sans requête supplémentaire (lot B). */
  ateliers: Atelier[];
  /** Membres par atelier (compte affiché sur la carte du prochain RDV). */
  nbMembresParAtelier: Map<number, number>;
  nbParticipantes: number;
  nbPhotos: number;
}

export async function chargerEditionEntrees(ed: {
  id: number;
  nom: string;
  statut: string;
  finaleDate: string | null;
}): Promise<EditionChargee> {
  const [ateliers, membres, coachs, recompenses, photos, tags, registrations] =
    await Promise.all([
      getAteliersByEdition(ed.id),
      getAtelierMembersByEdition(ed.id).catch(
        siTableAbsente(new Map<number, MembreAtelier[]>()),
      ),
      getCoachsByEdition(ed.id).catch(siTableAbsente(new Map<number, Coach[]>())),
      getRecompensesByEdition(ed.id).catch(siTableAbsente([] as Recompense[])),
      getPhotosByEdition(ed.id).catch(siTableAbsente([])),
      getPhotoTagsByEdition(ed.id).catch(siTableAbsente(new Map<number, PhotoTag[]>())),
      getRegistrationsByEdition(ed.id),
    ]);

  // Photos bloquées, en DEUX tas. `photoPubliable` fond deux mécanismes en un
  // booléen — `couverte` vaut `registration.public` pour une inscrite, et la
  // case « Accord recueilli » de l'orga pour les autres. Les compter ensemble
  // éteignait le signal sur un travail d'un clic (revue du 2026-08-17).
  //
  // Une photo qui cumule les deux causes va dans le premier tas : le geste de
  // l'orga existe, il fait avancer la ligne — et quand il est posé, la photo
  // bascule dans le second. La liste peut donc finir dans les deux cas.
  const bloquees = photos.filter((p) => !photoPubliable(tags.get(p.id) ?? []));
  const aConfirmer = bloquees.filter((p) =>
    (tags.get(p.id) ?? []).some((t) => t.registrationId === null && !t.couverte),
  ).length;

  return {
    entrees: {
      id: ed.id,
      nom: ed.nom,
      enPreparation: ed.statut === "preparation",
      finaleDate: ed.finaleDate,
      ateliers: ateliers.map((a) => ({
        id: a.id,
        titre: a.titre,
        date: a.date,
        dateFin: a.dateFin,
        nature: a.nature,
        lienVisio: a.lienVisio,
        coachsTexte: a.coachs,
        nbCoachs: (coachs.get(a.id) ?? []).length,
        nbNonPointees: (membres.get(a.id) ?? []).filter(
          (m) => m.presence === "non_renseignee",
        ).length,
      })),
      // Le NOM SAISI, pas `registrationLabel(r)` : sur cet ensemble, trois des
      // quatre branches du helper sont mortes. Le filtre exclut les
      // inscriptions reliées à un compte, et `CONSTRAINT registration_identite`
      // (db/schema.sql) impose `"userId" IS NOT NULL OR participante_nom IS NOT
      // NULL` — donc `participanteNom` est ici non nul PAR CONSTRUCTION, et le
      // repli `userEmail` du helper est inatteignable.
      //
      // Le dire ici plutôt que de s'en remettre au helper évite qu'une adresse
      // entre un jour dans un libellé de tâche, qui s'affiche à l'écran ET
      // partira dans l'e-mail quotidien à l'étape C. La garde est un FAIT DE
      // SCHÉMA, pas une convention d'appelant : `registrationLabel` garde son
      // repli, dont vivent les ~25 écrans qui identifient une inscrite invitée
      // par e-mail (revue de conception du 2026-08-16, angles RGPD et
      // altitude).
      participantesSansCompte: registrations.flatMap((r) =>
        r.userId || !r.participanteNom
          ? []
          : [{ id: r.id, nom: r.participanteNom }],
      ),
      nbRecompensesAAttribuer: recompenses.filter((r) => !r.beneficiaireNom).length,
      nbPhotosAccordAConfirmer: aConfirmer,
      nbPhotosPrivees: bloquees.length - aConfirmer,
    },
    ateliers,
    nbMembresParAtelier: new Map(
      [...membres].map(([atelierId, liste]) => [atelierId, liste.length]),
    ),
    nbParticipantes: registrations.length,
    nbPhotos: photos.length,
  };
}

/**
 * Ce que rendent les deux portes : la liste, et le JOUR qui l'a dérivée.
 *
 * `aujourdhui` voyage avec les tâches parce que les échéances s'affichent en
 * relatif (« En retard », « Dans 3 j ») : la vue doit compter à partir du même
 * jour que le moteur, sans le recalculer.
 */
export interface TachesChargees {
  taches: Tache[];
  aujourdhui: string;
}

/**
 * Les tâches de la famille ASSOCIATION, sans session.
 *
 * Nommée pour ce qu'elle CHARGE, pas pour qui la lit : c'est la porte du cron
 * du digest, qui n'a pas de session et n'a pas à en inventer une. Sa garde est
 * `CRON_SECRET`, en amont.
 *
 * Ne pas la confondre avec `chargerTaches` : celle-ci ne vérifie RIEN, et
 * c'est voulu — un appelant depuis l'espace connecté doit passer par la porte
 * gardée. Ses appelants : les deux pages `/admin` (qui portent
 * `requireOrgaPage`, derrière le préfixe refusé aux non-orgas) et, depuis le
 * lot 7, le cron du digest — celui pour qui cette porte existait.
 *
 * MÉMOÏSÉE PAR PASSE DE RENDU (`cache` de React, comme `getSession` et
 * `getProfileByUserId`) : c'est ce qui rend `desTachesAttendent()` gratuit sur
 * la page qui affiche déjà la liste — la barre d'onglets et l'écran partagent
 * un seul chargement.
 *
 * Le cache s'arrête là, et il le doit : au-delà il servirait du PÉRIMÉ, une
 * tâche déjà refermée. Ce n'est pas une frontière d'identité — cette porte ne
 * lit aucune session et rend la même chose à toute orga. La frontière est
 * ailleurs, et elle y reste : dans `chargerTaches`.
 *
 * Hors passe de rendu (le cron, un script, Vitest) la mémoïsation n'existe
 * simplement pas : `cache` retombe sur l'appel direct. C'est la bonne
 * dégradation, et c'est pourquoi aucun test ne la couvre — elle n'est pas une
 * garde.
 */
export const chargerTachesAssociation = cache(async function chargerTachesAssociation(): Promise<TachesChargees> {
  // Les réglages d'abord, seuls : le délai « fiche en sommeil » paramètre la
  // requête suivante. Une lecture de plus, sur une table d'une poignée de lignes.
  const reglages = await getReglages();
  const [
    fiches,
    enSommeil,
    sansNom,
    editions,
    messagesEnAttente,
    articles,
    fileConferences,
  ] = await Promise.all([
    getPendingProfiles(),
    getProfilesEnSommeilBrefs(reglages.relance_brouillon_jours),
    getProfilesPubliesSansNom(),
    listEditions(),
    countPendingContactMessages().catch(() => 0),
    // Colonnes du lot N3 : une base pas encore synchronisée n'a rien à relire
    // (la table `contenus` existe, c'est la COLONNE auteur_user_id qui manque).
    listArticlesEnRelecture().catch(siSchemaEnRetard([])),
    // La file d'arbitrage des conférences proposées : elle n'entrait dans
    // AUCUNE tâche, et 113 soumissions de membres attendaient derrière un
    // « Tout roule » (2026-08-21). Un RÉSUMÉ borné, pas la file : ce chemin
    // est celui du point de la barre basse, donc de chaque page connectée.
    // La lecture est résiliente côté lib.
    resumeFilePropositions(),
  ]);
  const actives = editions.filter((e) => e.statut !== "archive");
  const chargees = await Promise.all(actives.map(chargerEditionEntrees));
  const aujourdhui = aujourdhuiParis();
  const taches = deriverTaches(
    {
      // Nom REL ou rien : un nom blanc ("   ") donnerait « Valider la fiche
      // de    » — la branche sans nom du libellé existe pour ça.
      fiches: fiches.map((f) => ({ id: f.id, nom: f.name?.trim() || null, submittedAt: f.submittedAt })),
      fichesEnSommeil: enSommeil,
      fichesSansNom: sansNom,
      editions: chargees.map((c) => c.entrees),
      articles,
      conferencesProposees: fileConferences,
    },
    {
      slaFicheJours: reglages.validation_fiche_jours,
      fenetreAtelierJours: reglages.alerte_atelier_jours,
    },
    aujourdhui,
  );
  // Les messages à modérer sont une NOTIFICATION comme les autres : une tâche
  // ici, et la rangée Messages du menu Gérer reste neutre (fini le flag).
  if (messagesEnAttente > 0) {
    taches.push({
      regle: "moderer-messages",
      nb: messagesEnAttente,
      libelle: `Modérer ${nb(messagesEnAttente, "message")} reçu${messagesEnAttente > 1 ? "s" : ""} via les fiches`,
      href: "/admin/messages",
      // Modérer est un travail donné à l'association, pas un message qu'on
      // reçoit : la famille le dit. (Côté membre, « Répondre à … » sera une
      // tâche `personnel` distincte — deux gestes, deux familles.)
      famille: "association",
    });
  }
  return { aujourdhui, taches };
});

/**
 * Les tâches de la personne CONNECTÉE — la porte de l'espace connecté.
 *
 * AUCUN ARGUMENT, et c'est tout le sujet. La première conception passait les
 * capacités (`chargerTaches({ estOrga, estCoach })`) ; la revue du 2026-08-16
 * l'a écartée pour trois raisons vérifiées dans le code :
 *
 * - `/mon-espace/a-faire` n'a PAS la garde de préfixe de `/admin`
 *   (`auth.config.ts` ne teste le rôle que sur `/admin`), donc la capacité
 *   serait la seule protection restante sur du contenu NOMINATIF ;
 * - trois appelants l'auraient composée — la page, la barre d'onglets et le
 *   cron —, soit trois occasions de se tromper et zéro vérification ;
 * - un test « on passe `estOrga: true` en dur, le test doit tomber » aurait
 *   gardé le MOTEUR, pas l'appelant : il serait resté vert si c'est la page
 *   qui ment.
 *
 * Ici la session est lue par la fonction elle-même. Une capacité qu'aucun
 * appelant ne peut passer est une capacité qu'aucun appelant ne peut mentir —
 * « rendre la faute impossible » plutôt que la tester
 * (`docs/principes-tests.md`).
 *
 * `getSession` est mémoïsée par requête : sur une page qui appelle aussi
 * `desTachesAttendent`, le cookie n'est déchiffré qu'une fois.
 *
 * Les familles `personnel` et `accompagnement` viendront ici, chacune bornée
 * chez elle — l'accompagnement EN SQL par les liaisons coach ↔ cible, jamais
 * par un drapeau (revue S4 : `estCoach` dit « elle est coach », pas « ces
 * ateliers sont les siens »).
 */
export async function chargerTaches(): Promise<TachesChargees> {
  const session = await getSession();
  // Strict : un champ absent vaut NON. Jamais de « truthy » sur une capacité.
  const estOrga = session?.user?.isOrga === true;
  if (!estOrga) return { taches: [], aujourdhui: aujourdhuiParis() };
  return chargerTachesAssociation();
}

/**
 * LE POINT de l'onglet « À faire » : reste-t-il quelque chose que la personne
 * connectée puisse refermer ?
 *
 * Un booléen, pas un compte (conception D3, révisée le 2026-08-17) : sur des
 * volumes de une à cinq lignes, « 3 » et « il y a quelque chose » déclenchent
 * la même décision — j'ouvre. Le nombre ne devient utile que le jour où 2 et 20
 * se traitent différemment, et il s'ajoutera alors sans rien défaire (`EXISTS`
 * est un sous-ensemble de `COUNT`).
 *
 * UN SEUL CHEMIN, et c'est le point dur. La version bon marché — un `EXISTS`
 * par famille — aurait été une SECONDE définition de ce qu'est une tâche, donc
 * une divergence en puissance ; et un signal qui diverge est pire qu'une
 * absence de signal. On lit donc la même dérivation que l'écran, et on paie le
 * chargement. Le chiffrage de ce que ça coûte, et la porte de sortie si ça se
 * voit, sont dans la conception (D3 et risque 1) : ils bougeront, pas ici.
 *
 * Ce qui allume est décidé par `reclameUnGeste`, partagé avec les trois autres
 * surfaces qui posent la même question.
 */
export async function desTachesAttendent(): Promise<boolean> {
  const { taches } = await chargerTaches();
  return taches.some(reclameUnGeste);
}
