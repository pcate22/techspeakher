/**
 * Moteur de tâches du tableau de bord orga (cf.
 * docs/conception-tableau-de-bord-orga.md). PUR : zéro accès base — la page
 * charge les données avec les libs existantes et les NORMALISE en
 * `EntreesTaches` ; ici on ne fait que dériver. Une tâche apparaît parce que
 * sa condition est vraie et disparaît parce qu'on a agi : rien n'est stocké.
 *
 * Tri à deux étages, anti-bruit : les tâches DATÉES d'abord (échéance
 * croissante, donc les retards en tête), puis les résolubles sans date.
 */

import { dateParis, estPasse, finEffective } from "@/lib/tremplin-statut";
import { nb } from "@/lib/format";
import { avecVue } from "@/lib/vue-liste";

/**
 * À QUI la tâche appartient. Une seule liste par personne, trois familles —
 * c'est ce qui permet d'ajouter un monde sans dupliquer le moteur
 * (`docs/conception-technique-profil-et-a-faire.md` D1).
 *
 * Des mots ENTIERS, et pas `perso` / `coach` : cette valeur devient visible
 * dans la barre d'adresse (`?vue=personnel`) donc dans tout lien partagé, et
 * la règle du dépôt est « un seul mot par concept, de l'écran au code ».
 * `accompagnement` plutôt que `coach` parce qu'accompagner et coacher sont une
 * seule chose (conception §6 V6).
 */
export type FamilleTache = "personnel" | "association" | "accompagnement";

/**
 * L'ordre CANONIQUE des familles, celui des puces et des étiquettes (B5 :
 * « Tout · Pour moi · Pour l'association · Pour mes coachées »). Déclaré ici
 * plutôt que dérivé de l'ordre d'apparition dans la liste : un meuble de
 * navigation qui changerait de place au gré des échéances est exactement ce
 * que les principes COGA du dépôt combattent.
 */
export const ORDRE_FAMILLES = [
  "personnel",
  "association",
  "accompagnement",
] as const satisfies readonly FamilleTache[];

/**
 * LES RÈGLES du moteur, en liste FERMÉE : une valeur par dérivation. La règle
 * voyage sur la tâche (comme la famille) pour que le digest quotidien compte
 * « par règle » sans recompter la base — un canal du moteur, jamais une
 * seconde définition (étape C). Et la fermeture est le cliquet : le digest
 * épelle un libellé d'agrégat par règle (`satisfies Record<RegleTache, …>`),
 * donc une règle ajoutée ici sans son agrégat là-bas est une erreur de
 * COMPILATION — le précédent Brevo du registre, appliqué avant la faute.
 */
export const REGLES_TACHES = [
  "valider-fiche",
  "valider-conference",
  "nommer-fiche",
  "relancer-sommeil",
  "relire-article",
  "ajouter-visio",
  "trouver-coach",
  "pointer-presences",
  "dater-atelier",
  "attribuer-recompenses",
  "relier-compte",
  "recueillir-accord-photo",
  "photos-privees",
  "ouvrir-edition",
  "moderer-messages",
] as const;

export type RegleTache = (typeof REGLES_TACHES)[number];

export interface Tache {
  libelle: string;
  href: string;
  famille: FamilleTache;
  /** Échéance ISO (YYYY-MM-DD). Absente = résoluble sans date (pas de puce). */
  echeance?: string;
  /** Édition d'où vient la tâche (« Tremplin DevFest Toulouse 2026 »), pour
   * situer un rappel quand le tableau de bord agrège plusieurs éditions. Absent
   * pour les tâches hors édition (validation de fiche speakeuse). */
  contexte?: string;
  /** Une date est ATTENDUE mais pas encore fixée (atelier sans date) : la liste
   * affiche une pastille « ? » (à dater), distincte d'une tâche sans notion de
   * date (« Ouvrir … », « Relier … »), qui n'a aucune pastille. */
  dateAFixer?: boolean;
  /** La dérivation qui a produit la ligne — voir `REGLES_TACHES`. */
  regle: RegleTache;
  /** Cibles derrière une ligne GROUPÉE (« Relier 3 participantes » → 3).
   * Absent = une seule : un défaut explicite, jamais un « peut-être ». */
  nb?: number;
  /**
   * La ligne INFORME, elle ne réclame rien : aucun geste posé DANS l'app ne la
   * referme. Elle reste dans la liste, où elle situe ; elle n'allume pas le
   * point de l'onglet (`reclameUnGeste`, `desTachesAttendent`).
   *
   * Règle tranchée le 2026-08-17 (`docs/principes-conception-ui.md`, corollaire
   * du compteur) : ce qui s'allume ne signale que ce qu'un geste de la personne
   * qui le voit peut refermer. Le critère est QUI referme, jamais quand — une
   * action à faire dans dix jours reste une chose à faire, elle allume.
   *
   * `true` et rien d'autre, là où `dateAFixer` juste au-dessus est un booléen :
   * une seule façon de dire non (l'absence du champ), donc aucun `constat:
   * false` à lire et à peser.
   *
   * UNE SEULE RÈGLE le porte aujourd'hui, et la liste est fermée par
   * `taches.test.ts`. Ce champ a d'abord été posé sur deux de plus, à tort — la
   * revue du 2026-08-17 a montré, code de l'écran d'arrivée à l'appui, que
   * l'orga les referme d'un clic. La leçon tient en une phrase : « qui peut
   * refermer » se lit sur l'ÉCRAN QUE LA LIGNE POINTE, jamais sur l'intuition
   * qu'on a du domaine. Et se tromper de ce côté-là est le pire des deux —
   * s'éteindre à tort apprend à ne plus regarder la barre.
   */
  constat?: true;
}

/**
 * La ligne réclame-t-elle un geste ? C'est LE prédicat du signal : ce qui
 * s'allume, ce qu'on compte comme « à faire », ce qu'un drapeau annonce.
 *
 * Exporté et unique, parce que la question se pose sur quatre surfaces (le
 * point de l'onglet, la rangée du tableau de bord, la méta de la page « À
 * faire », le hub d'édition) et qu'un `!t.constat` recopié quatre fois est une
 * divergence en attente — celle-là même que la conception refuse pour le point.
 */
export const reclameUnGeste = (t: Tache): boolean => !t.constat;

/** Combien de cibles vivent derrière la ligne — `nb` absent vaut UN. Le seul
 * interprète de l'absence : une seconde surface qui recopierait `?? 1` serait
 * une divergence en attente. */
export const nbCibles = (t: Tache): number => t.nb ?? 1;

/** Seuils (jours) — viennent de `reglages.ts` (défauts, puis table en C4). */
export interface SeuilsTaches {
  slaFicheJours: number;
  fenetreAtelierJours: number;
}

/** Ce que la page fournit pour UNE édition active (comptes déjà agrégés). */
export interface EditionEntrees {
  id: number;
  nom: string;
  /** Statut « preparation » : l'édition est encore invisible du public. */
  enPreparation: boolean;
  finaleDate: string | null;
  ateliers: {
    id: number;
    titre: string;
    date: string | null;
    /** Fin de fenêtre (activité « à faire entre deux dates »), sinon null.
     * L'échéance d'une activité à période est sa FIN (décision produit, lot B). */
    dateFin: string | null;
    /** `sous_groupes` : lien et coach vivent PAR sous-groupe, l'autonomie est
     * un état normal — les règles visio/coach/présences ne s'appliquent pas. */
    nature: "collectif" | "sous_groupes";
    lienVisio: string | null;
    /** Repli hérité : coachs saisis en texte libre (compte comme « a un coach »). */
    coachsTexte: string | null;
    nbCoachs: number;
    nbNonPointees: number;
  }[];
  /** Inscriptions sans compte relié : id + nom, pour pointer DIRECTEMENT la
   * participante quand il n'y en a qu'une (au lieu de la liste). */
  participantesSansCompte: { id: number; nom: string }[];
  nbRecompensesAAttribuer: number;
  /**
   * Photos qu'un GESTE D'ORGA débloque : au moins une personne identifiée hors
   * inscription (compte plateforme, nom libre) dont l'accord reste à recueillir
   * puis à attester, case à case, sur la page de la photo.
   */
  nbPhotosAccordAConfirmer: number;
  /**
   * Photos bloquées par les SEULES inscrites, c'est-à-dire par leur propre
   * réglage de visibilité (`registration.public`). L'orga n'a rien à y faire :
   * la ligne informe, elle n'allume pas.
   *
   * Deux nombres et non un, parce que `photoPubliable` fond deux mécanismes en
   * un booléen (`tremplin-photos.ts` : `couverte = registrationId !== null ?
   * reg_public : consentement`). Les compter ensemble éteignait le signal sur
   * un travail d'un clic — relevé par deux relectures autonomes le 2026-08-17.
   */
  nbPhotosPrivees: number;
}

export interface EntreesTaches {
  /** `submittedAt` : TIMESTAMPTZ, donc un `Date` JS au runtime (pg). */
  fiches: { id: number; nom: string | null; submittedAt: string | Date | null }[];
  /** Fiches restées en BROUILLON, sans changement depuis le délai réglé : elles
   * n'entrent dans aucune file de modération (personne ne les a soumises), donc
   * sans cette tâche, personne ne saurait jamais qu'elles dorment. Aucune
   * échéance : c'est l'orga qui juge du bon moment pour écrire. */
  fichesEnSommeil: { id: number; nom: string | null }[];
  /** Fiches PUBLIÉES dont le nom réel est vide (cohorte migrée, #233 rendu
   * rétroactif) : l'affichage a son repli (`nomAffiche`), ce canal dit à
   * l'orga où est le travail. Le titre du profil aide à la reconnaître. */
  fichesSansNom: { id: number; titreProfil: string | null }[];
  editions: EditionEntrees[];
  /**
   * La FILE des conférences proposées par des membres, en trois chiffres
   * (migrations 041 puis 068). Une soumission de membre avec, derrière elle,
   * des talks tenus hors ligne jusqu'à la validation — donc le même engagement
   * de délai qu'une fiche ou un article.
   *
   * Le résumé plutôt que les lignes : ce moteur est lu à chaque rendu de
   * l'espace connecté (le point de la barre basse), et la table est remplie par
   * des membres. Détail et mesure : `resumeFilePropositions`.
   */
  conferencesProposees:
    | { attend: false }
    | {
        attend: true;
        total: number;
        /** Attente la plus ancienne. TIMESTAMPTZ, donc un `Date` JS au runtime
         * (pg), comme `submittedAt` plus haut. */
        plusAncienne: string | Date;
        /** Renseignée quand la file n'en compte qu'UNE : la ligne la nomme. */
        seule: { id: number; nom: string; proposeParNom: string | null } | null;
      };
  /** Articles de membres EN RELECTURE (lot N3) : même engagement de délai que
   * la validation d'une fiche. `majLe` = l'instant de la soumission. */
  articles: {
    id: number;
    slug: string;
    titre: string;
    auteurNom: string | null;
    majLe: string | Date;
  }[];
}

/** Jours d'écart entre deux dates ISO (échéance - aujourd'hui). */
function joursRestants(echeance: string, aujourdhui: string): number {
  const MS_JOUR = 86_400_000;
  return Math.round((Date.parse(echeance) - Date.parse(aujourdhui)) / MS_JOUR);
}

/** Puce d'échéance, dérivée à l'affichage : « En retard », « Aujourd'hui », « N\u00a0j ». */
export function libelleEcheance(echeance: string, aujourdhui: string): string {
  const j = joursRestants(echeance, aujourdhui);
  if (j < 0) return "En retard";
  if (j === 0) return "Aujourd'hui";
  return `${j}\u00a0j`;
}

/** Équivalent textuel LONG de la puce (lecteurs d'écran : pas d'abréviation). */
export function libelleEcheanceLong(echeance: string, aujourdhui: string): string {
  const j = joursRestants(echeance, aujourdhui);
  if (j < 0) return "en retard";
  if (j === 0) return "aujourd'hui";
  return j === 1 ? "dans 1 jour" : `dans ${j} jours`;
}

/**
 * Sous-titre d'un rappel daté : le mot d'urgence (« En retard », « Aujourd'hui »,
 * « Dans N j ») + un drapeau `enRetard` pour l'accent visuel (l'urgence est TOUJOURS
 * dite en toutes lettres, jamais portée par la seule couleur, cf. principes UI §9).
 * La date absolue, elle, vit dans la pastille agenda à côté.
 */
export function motEcheance(
  echeance: string,
  aujourdhui: string,
): { texte: string; enRetard: boolean } {
  const j = joursRestants(echeance, aujourdhui);
  if (j < 0) return { texte: "En retard", enRetard: true };
  if (j === 0) return { texte: "Aujourd'hui", enRetard: false };
  return { texte: `Dans ${j} j`, enRetard: false };
}

/** « de {nom} » avec élision (« d'Ada »). */
function de(nom: string): string {
  return /^[aeiouyàâéèêëîïôùûh]/i.test(nom) ? `d'${nom}` : `de ${nom}`;
}

/**
 * Décale un instant de N jours → YYYY-MM-DD. La partie date est prise en heure
 * de PARIS d'abord (une soumission à 00 h 30 Paris est « du jour », pas de la
 * veille UTC), puis l'arithmétique se fait sur la date seule.
 */
function plusJours(instant: string | Date, jours: number): string {
  const d = new Date(dateParis(instant));
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

/**
 * Péremption post-finale (décision produit, lot B) : la finale passée, les
 * présences des ateliers d'AVANT-finale sont de l'histoire — l'édition vit sa
 * suite, le cockpit cesse de les réclamer (les pointées restent en base).
 *
 * Exportée : la vue `?vue=presences` de la liste des ateliers rejoue la MÊME
 * règle — sinon, cas mixte, la tâche compte N ateliers et la vue en montre
 * N+1, dont l'« histoire » que le cockpit a décidé de taire.
 */
export function presencesPerimees(
  fin: string,
  finaleDate: string | null,
  aujourdhui: string,
): boolean {
  // « Finale passée » se décide ICI (une seule épellation de la borne) : la
  // page qui rejoue la règle n'a rien à recalculer.
  const finalePassee = finaleDate !== null && estPasse({ date: finaleDate }, aujourdhui);
  return finalePassee && finaleDate !== null && fin < finaleDate;
}

/**
 * Une règle DÉRIVÉE, avant que la famille lui soit apposée. Les collecteurs
 * internes travaillent avec cette forme : la famille est une propriété de la
 * FRONTIÈRE (quelle dérivation a produit la ligne), pas de la règle — la
 * stamper quinze fois donnerait quinze occasions de l'oublier.
 */
type RegleDerivee = Omit<Tache, "famille">;

/** « Un seul candidat → ligne directe nommée ; plusieurs → UNE ligne groupée
 * vers la liste » — LE motif anti-mur du cockpit (présences, à dater, comptes). */
function directeOuGroupee<T>(
  items: T[],
  une: (x: T) => RegleDerivee,
  groupe: (n: number) => RegleDerivee,
): RegleDerivee | null {
  if (items.length === 0) return null;
  return items.length === 1 ? une(items[0]) : groupe(items.length);
}

export function deriverTaches(
  entrees: EntreesTaches,
  seuils: SeuilsTaches,
  aujourdhui: string,
): Tache[] {
  const datees: RegleDerivee[] = [];
  const calmes: RegleDerivee[] = [];

  // Fiches speakeuses en attente : engagement de validation (SLA).
  for (const f of entrees.fiches) {
    datees.push({
      regle: "valider-fiche",
      libelle: f.nom ? `Valider la fiche ${de(f.nom)}` : "Valider une fiche speakeuse",
      // Directement la FICHE (c'est là qu'on publie/refuse), pas la liste.
      href: `/speakeuses/${f.id}`,
      ...(f.submittedAt
        ? { echeance: plusJours(f.submittedAt, seuils.slaFicheJours) }
        : {}),
    });
  }

  // Fiches publiées SANS NOM réel : CONSTAT — le nom s'écrit en self-service
  // sur le compte, aucun geste d'orga sur la fiche ne referme la ligne
  // (précédent « photos privées », 2026-08-17). UNE ligne PAR fiche, chacune
  // vers la sienne : le roster affiche nomAffiche, le repli y masquerait
  // exactement le défaut qu'on vient chercher. Sans échéance : le défaut est
  // ancien (cohorte migrée), c'est un état à résorber, pas un SLA.
  for (const f of entrees.fichesSansNom) {
    calmes.push({
      regle: "nommer-fiche",
      libelle: f.titreProfil
        ? `La fiche «\u00a0${f.titreProfil}\u00a0» est publiée sans nom réel`
        : "Une fiche est publiée sans nom réel",
      href: `/speakeuses/${f.id}`,
      constat: true,
    });
  }

  // Fiches en sommeil : UNE ligne quel qu'en soit le nombre — vers la fiche
  // quand il n'y en a qu'une (l'orga y relance en un geste), vers la page de
  // relance sinon. Sans échéance : rien ne se périme, on écrit quand on veut.
  const sommeil = directeOuGroupee(
    entrees.fichesEnSommeil,
    (f) => ({
      regle: "relancer-sommeil",
      libelle: f.nom
        ? `Relancer la fiche ${de(f.nom)}, en sommeil`
        : "Relancer une fiche en sommeil",
      href: `/speakeuses/${f.id}`,
    }),
    (n) => ({
      regle: "relancer-sommeil",
      nb: n,
      libelle: `Relancer ${nb(n, "fiche")} en sommeil`,
      href: "/admin/speakeuses/relances",
    }),
  );
  if (sommeil) calmes.push(sommeil);

  // Articles de membres en relecture (lot N3) : l'engagement de relecture
  // partage le SLA de la fiche — une soumission de membre attend une orga,
  // quelle que soit sa forme.
  for (const a of entrees.articles) {
    datees.push({
      regle: "relire-article",
      libelle: a.auteurNom
        ? `Relire l'article ${de(a.auteurNom)}`
        : "Relire un article de membre",
      // Directement l'ÉDITEUR (c'est là qu'on publie/renvoie), pas la liste.
      href: `/admin/contenus/publication/${a.slug}`,
      echeance: plusJours(a.majLe, seuils.slaFicheJours),
    });
  }

  // Conférences proposées par des membres : LA règle qui manquait au moteur
  // (2026-08-21 — 113 propositions dans la file, « Tout roule » à l'écran ;
  // `docs/conception-arbitrage-conferences.md`, défaut A).
  //
  // Datée, au SLA de la fiche : une soumission de membre attend l'association,
  // quelle que soit sa forme — c'est déjà ce que `relire-article` a tranché.
  //
  // Une ligne nommée vers SA page quand il n'y en a qu'une ; UNE ligne groupée
  // vers la file dès qu'elles sont plusieurs. Le motif anti-mur du moteur n'a
  // jamais été aussi littéral qu'ici — mais il s'écrit à la main plutôt qu'avec
  // `directeOuGroupee` : celui-là compte les ÉLÉMENTS d'un tableau, et lire 113
  // lignes pour en compter le nombre est précisément ce que ce chemin ne peut
  // pas se permettre (passe sécurité du lot).
  //
  // Aucun `contexte` : ce champ est un nom d'ÉDITION du tremplin, et c'est le
  // seul champ que le digest publie vers la boîte partagée de l'association.
  const file = entrees.conferencesProposees;
  if (file.attend) {
    const echeance = plusJours(file.plusAncienne, seuils.slaFicheJours);
    datees.push(
      file.seule
        ? {
            regle: "valider-conference",
            libelle: file.seule.proposeParNom
              ? `Valider la conférence «\u00a0${file.seule.nom}\u00a0» proposée par ${file.seule.proposeParNom}`
              : `Valider la conférence «\u00a0${file.seule.nom}\u00a0»`,
            href: `/admin/conferences/propositions/${file.seule.id}`,
            echeance,
          }
        : {
            regle: "valider-conference",
            nb: file.total,
            // `nb()` plutôt qu'un pluriel en dur : la ligne groupée peut
            // afficher UN quand la proposition unique n'a pas pu être nommée.
            libelle: `Valider ${nb(file.total, "conférence")} proposée${file.total > 1 ? "s" : ""}`,
            href: "/admin/conferences/propositions",
            echeance,
          },
    );
  }

  for (const ed of entrees.editions) {
    const base = `/admin/tremplins/${ed.id}`;
    // Contexte commun à toutes les tâches de cette édition (« Tremplin DevFest
    // Toulouse 2026 ») : sur le tableau de bord qui agrège plusieurs éditions,
    // chaque rappel dit de quel tremplin il parle. Exception : la tâche
    // « Ouvrir … » nomme déjà l'édition dans son libellé (pas de doublon).
    const ctx = ed.nom;

    if (ed.enPreparation) {
      // Une édition en préparation a toujours un prochain pas : l'ouvrir au
      // public (résoluble, sans date — c'est l'orga qui décide du bon moment).
      // Le libellé dit QUOI (une édition du tremplin) et À QUI (au public,
      // c.-à-d. rendue visible sur les pages Tremplin) : « Ouvrir » seul est
      // opaque. Sans cette règle, le hub afficherait « Tout roule » sur une
      // édition que le public ne voit pas encore.
      calmes.push({
        regle: "ouvrir-edition",
        libelle: `Ouvrir au public l'édition «\u00a0${ed.nom}\u00a0» du tremplin`,
        href: `${base}/statut`,
      });
    }

    // Collecteurs du regroupement par type (lot B) + péremption post-finale.
    const aDater: { id: number; titre: string }[] = [];
    const presences: { id: number; titre: string; fin: string }[] = [];
    const finalePassee =
      ed.finaleDate !== null && joursRestants(ed.finaleDate, aujourdhui) < 0;

    for (const a of ed.ateliers) {
      if (!a.date) {
        // Sans date : aucune fenêtre d'urgence, mais l'atelier ne doit pas
        // être invisible — le dater est résoluble (un atelier, c'est un
        // titre et une date — ou une fenêtre).
        aDater.push(a);
        continue;
      }
      // Nature sous_groupes : lien, coach et réalisation vivent PAR
      // sous-groupe — aucune de ces règles d'atelier ne s'applique (fini les
      // fausses alertes « présences » et « coach à trouver » sur l'autonome).
      if (a.nature === "sous_groupes") continue;

      // La fenêtre EST sa date (lot B) : une activité à période échoit à sa
      // FIN — mêmes définitions partagées que l'agenda (tremplin-statut).
      const fin = finEffective(a)!;
      const finPassee = estPasse(a, aujourdhui);
      const j = joursRestants(a.date, aujourdhui);
      const imminent = j >= 0 && j <= seuils.fenetreAtelierJours;
      // Directement la SOUS-PAGE mono-fonction (C3b) : l'écran d'action,
      // pas le sommaire de l'atelier.
      const href = `${base}/ateliers/${a.id}`;

      if (imminent && !a.lienVisio?.trim()) {
        datees.push({ regle: "ajouter-visio", libelle: `Ajouter le lien visio de «\u00a0${a.titre}\u00a0»`, href: `${href}/visio`, echeance: a.date, contexte: ctx });
      }
      // PAS de règle « 0 participante » : un atelier « ouvert à toutes »
      // (propriété explicite) n'a pas d'inventaire à remplir, et le sommaire
      // de l'atelier signale déjà le cas « ni ouvert ni participante ».
      if (imminent && a.nbCoachs === 0 && !a.coachsTexte?.trim()) {
        datees.push({ regle: "trouver-coach", libelle: `Trouver un coach pour «\u00a0${a.titre}\u00a0»`, href: `${href}/coachs`, echeance: a.date, contexte: ctx });
      }
      if (
        finPassee &&
        a.nbNonPointees > 0 &&
        !presencesPerimees(fin, ed.finaleDate, aujourdhui)
      ) {
        presences.push({ id: a.id, titre: a.titre, fin });
      }
    }

    // Regroupement par type (lot B, fini le mur de cartes).
    const tPresences = directeOuGroupee(
      presences,
      (p) => ({
        regle: "pointer-presences",
        libelle: `Pointer les présences de «\u00a0${p.titre}\u00a0»`,
        href: `${base}/ateliers/${p.id}/presences`,
        echeance: p.fin,
        contexte: ctx,
      }),
      (n) => ({
        regle: "pointer-presences",
        nb: n,
        libelle: `Compléter les présences de ${n} ateliers passés`,
        // La VUE de la liste, pas son sommet : on arrive sur les ateliers
        // concernés (cf. src/lib/vue-liste.ts).
        href: avecVue(`${base}/ateliers`, "presences"),
        // L'urgence du groupe = le retard le plus ancien.
        echeance: presences.map((p) => p.fin).sort()[0],
        contexte: ctx,
      }),
    );
    if (tPresences) datees.push(tPresences);

    const tADater = directeOuGroupee(
      aDater,
      (a) => ({
        regle: "dater-atelier",
        libelle: `Donner une date à «\u00a0${a.titre}\u00a0»`,
        href: `${base}/ateliers/${a.id}/infos`,
        contexte: ctx,
        dateAFixer: true,
      }),
      (n) => ({
        regle: "dater-atelier",
        nb: n,
        libelle: `Donner une date à ${n} ateliers`,
        href: avecVue(`${base}/ateliers`, "a-dater"),
        contexte: ctx,
        dateAFixer: true,
      }),
    );
    if (tADater) calmes.push(tADater);

    if (finalePassee && ed.nbRecompensesAAttribuer > 0) {
      datees.push({
        regle: "attribuer-recompenses",
        nb: ed.nbRecompensesAAttribuer,
        libelle: `Attribuer ${nb(ed.nbRecompensesAAttribuer, "récompense")}`,
        href: `${base}/recompenses`,
        echeance: ed.finaleDate!,
        contexte: ctx,
      });
    }

    // Une seule à relier : DROIT à sa sous-page « compte », en la nommant ;
    // plusieurs : la liste est le bon point d'entrée (on choisit laquelle).
    //
    // Refermable par l'orga, donc ALLUMANTE. Le lot du 2026-08-17 l'avait
    // marquée `constat` en croyant que le rattachement attendait la première
    // connexion de la participante : faux. `attachUserToRegistration` écrit
    // `"userId"` dans les DEUX branches de l'écran — compte existant choisi
    // dans la recherche, ou compte pré-créé par invitation — et la règle dérive
    // justement de `!r.userId`. La première connexion sert à ce qu'elle VOIE
    // son espace, pas au rattachement.
    const tComptes = directeOuGroupee(
      ed.participantesSansCompte,
      (p) => ({
        regle: "relier-compte",
        libelle: `Relier ${p.nom} à un compte`,
        href: `${base}/participantes/${p.id}/compte`,
        contexte: ctx,
      }),
      (n) => ({
        regle: "relier-compte",
        nb: n,
        libelle: `Relier ${nb(n, "participante")} à un compte`,
        href: avecVue(`${base}/participantes`, "sans-compte"),
        contexte: ctx,
      }),
    );
    if (tComptes) calmes.push(tComptes);

    // DEUX règles pour les photos bloquées, parce qu'il y a deux mécanismes et
    // qu'un seul est du ressort de l'orga (cf. `EditionEntrees`).
    //
    // Celle-ci l'est : la case « Accord recueilli » se coche photo par photo,
    // dans l'app. Le libellé garde son impératif, et il est juste — recueillir
    // l'accord de vive voix PUIS l'attester est bien le travail.
    if (ed.nbPhotosAccordAConfirmer > 0) {
      calmes.push({
        regle: "recueillir-accord-photo",
        nb: ed.nbPhotosAccordAConfirmer,
        libelle: `Recueillir l'accord pour ${nb(ed.nbPhotosAccordAConfirmer, "photo")}`,
        href: `${base}/photos`,
        contexte: ctx,
      });
    }
    // Celle-là ne l'est pas : ne restent que des inscrites, dont la couverture
    // vaut `registration.public`, LEUR réglage de visibilité. Un constat, donc,
    // et un libellé qui dit ce qui EST — l'ancien « Recueillir l'accord »
    // réclamait ici un geste impossible, parfois pour un accord déjà REFUSÉ.
    //
    // « restent privées » plutôt qu'« accord manquant » : un refus n'est pas
    // une absence de réponse. Le détail — qui, et pourquoi — est à un tap, sur
    // la page des photos. Le lot « accord global + retrait ciblé » précisera ce
    // libellé (trois états), il ne le contredira pas.
    if (ed.nbPhotosPrivees > 0) {
      const n = ed.nbPhotosPrivees;
      calmes.push({
        regle: "photos-privees",
        nb: n,
        libelle: `${nb(n, "photo")} ${n > 1 ? "restent privées" : "reste privée"}`,
        href: `${base}/photos`,
        contexte: ctx,
        constat: true,
      });
    }
  }

  // Une fiche sans date de soumission reste résoluble mais non datée.
  const [avecEcheance, sansEcheance] = [
    datees.filter((t) => t.echeance),
    datees.filter((t) => !t.echeance),
  ];
  avecEcheance.sort((a, b) => a.echeance!.localeCompare(b.echeance!));
  // La famille est apposée AU RETOUR, en un seul endroit : toutes les règles
  // de ce moteur appartiennent à l'association. Les stamper une à une aurait
  // répété quinze fois la même valeur, avec quinze occasions de l'oublier —
  // et la prochaine règle d'association n'a rien à déclarer.
  //
  // Quand les familles `personnel` et `accompagnement` arriveront, chacune
  // aura sa propre dérivation et son propre stamp : c'est la frontière qui
  // porte la famille, pas la règle.
  return [...avecEcheance, ...sansEcheance, ...calmes].map((t) => ({
    ...t,
    famille: "association" as const,
  }));
}
