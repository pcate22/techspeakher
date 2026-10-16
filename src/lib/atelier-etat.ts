import { libelleAudience } from "@/lib/atelier-audience";
import { quandFr, estFenetre, nb } from "@/lib/format";
import { repartitionComplete } from "@/lib/atelier-sous-groupes";
import { estPasse } from "@/lib/tremplin-statut";
import type { Atelier, Presence, SousGroupesEtat } from "@/lib/tremplin-ateliers";

/**
 * L'ÉTAT d'un atelier vu comme un ÉVÉNEMENT (lot C, refonte §4) : quand, où,
 * qui, avancement — quatre faits dérivés d'une seule fonction PURE, au lieu de
 * cinq rangées à drapeaux qui criaient toutes en même temps.
 *
 * Quatre règles de fond, contre les fausses alertes de la fiche actuelle :
 *
 * 1. **Rien ne se réclame avant que l'atelier soit DATÉ** : sans date, il n'y a
 *    qu'une chose à faire (le dater), et c'est le QUAND qui le dit. Un atelier
 *    tout juste créé affichait sinon trois faits orange sur quatre — « le vide
 *    qui crie », exactement ce que le lot supprime.
 * 2. **L'avancement dépend de la NATURE** : un atelier collectif se pointe
 *    (présences), un atelier en sous-groupes se suit par réalisation. Réclamer
 *    des présences sur une revue croisée n'a aucun sens.
 * 3. **L'absence de coach n'est une alerte que là où c'est un manque** : sur un
 *    atelier autonome, « autonome » est un état NORMAL — plus de « À trouver ».
 * 4. **Un manque se dit en MOTS**, jamais par la seule couleur (RGAA 3.1) :
 *    deux situations distinctes n'ont jamais le même texte. « À préciser » (il
 *    reste à faire) et « Lieu non consigné » (c'est de l'histoire) sont deux
 *    phrases, pas une phrase en deux teintes. Le QUI se rend d'ailleurs en
 *    SEGMENTS, pour que l'orange ne colore que le fait qui manque et laisse en
 *    blanc celui qui va bien.
 *
 * Et rien ne s'alarme sur le passé : une fois l'activité derrière nous, le lieu
 * manquant est de l'histoire, pas une tâche.
 */

/** Les champs d'`Atelier` dont l'état dépend — pas de recopie champ par champ
 * au site d'appel : une colonne qui bouge ne se paie qu'ici. */
export type AtelierEtatSource = Pick<
  Atelier,
  | "date"
  | "dateFin"
  | "heureDebut"
  | "heureFin"
  | "lieu"
  | "lienVisio"
  | "nature"
  | "audience"
  | "auProgrammePublic"
  | "phase"
  | "coachs"
>;

export type { SousGroupesEtat };

export interface AtelierEtatEntrees {
  atelier: AtelierEtatSource;
  nbMembres: number;
  /** Inscrites de l'édition : le public réel d'un atelier « ouvert à toutes ». */
  nbInscritesEdition: number;
  nbCoachs: number;
  /** Présences des membres, ou null si la colonne n'est pas encore migrée. */
  presences: Presence[] | null;
  /** Combien de personnes l'atelier CONCERNE (son audience). Différent du
   * nombre de lignes de présence : sur une audience de phase ou « toutes », la
   * ligne n'existe qu'une fois la personne pointée. Sans ce total, la fiche
   * restait muette sur les présences à pointer d'une séance passée où personne
   * n'avait encore été pointé — le cas le plus fréquent.
   *
   * C'est AUSSI l'ensemble que les sous-groupes doivent couvrir : face aux
   * `ranges`, il donne le reste à ranger. Même question posée deux fois — « qui
   * est concerné par cet atelier » — donc UNE entrée, sinon les deux
   * dérivations finiraient par diverger. */
  nbCohorte: number;
  sousGroupes: SousGroupesEtat;
  aujourdhui: string;
}

/** Un fait de la fiche : son texte, et s'il réclame une action. */
export interface Fait {
  texte: string;
  alerte: boolean;
}

export interface AtelierEtat {
  quand: Fait & { consigne: string | null };
  ou: Fait & { lienVisio: string | null };
  /** Le public et son encadrement, en SEGMENTS : chacun porte sa propre
   * alerte, pour qu'un manque ne teinte pas un fait sain. `texte` en est la
   * jointure, pour les contextes qui n'ont qu'une chaîne (sous-titres). */
  qui: Fait & { segments: Fait[] };
  /** `null` = rien à suivre encore (activité à venir) : on ne réclame pas. */
  avancement: Fait | null;
  /** Le lien de connexion se règle-t-il sur l'atelier ? (collectif, ou lien déjà posé) */
  montreVisio: boolean;
  libelleParticipantes: string;
  /** Où en est le roster, pour la rangée « participantes » — même décision que
   * `libelleParticipantes`, donc même endroit. */
  sousTitreParticipantes: string;
  /** Où en est la RÉPARTITION, pour la rangée « Sous-groupes » de la fiche (et
   * en écho dans le QUI). `null` sur un atelier collectif : il n'y a pas de
   * répartition à suivre, la rangée ne s'affiche pas. */
  sousTitreSousGroupes: string | null;
  /** Ce qu'on dit de l'encadrement quand personne n'est nommé : la rangée
   * « Coachs » et le QUI doivent raconter la MÊME chose (la fiche affichait
   * « Par sous-groupe » deux centimètres sous « autonome »). */
  sousTitreCoachs: string;
}

export function atelierEtat({
  atelier: a,
  nbMembres,
  nbInscritesEdition,
  nbCoachs,
  presences,
  nbCohorte,
  sousGroupes,
  aujourdhui,
}: AtelierEtatEntrees): AtelierEtat {
  const date = a.date;
  const aPeriode = estFenetre(date, a.dateFin);
  const passe = date !== null && estPasse({ date, dateFin: a.dateFin }, aujourdhui);
  const commence = date !== null && date <= aujourdhui;
  const enSousGroupes = a.nature === "sous_groupes";
  // Le reste à ranger : l'ensemble à couvrir moins ce qui l'est déjà. Borné à 0
  // — une participante rangée puis sortie de l'ensemble ne fait pas un négatif.
  // (Invariant qui rend ce max() théorique : rangées ⊆ membres ⊆ ensemble.)
  const aRanger = Math.max(0, nbCohorte - sousGroupes.ranges);
  // Tant que l'atelier n'est pas daté, il n'y a rien à préparer : le seul
  // manque est la date, et le QUAND la réclame déjà (règle 1).
  const aPreparer = date !== null && !passe;

  // ── QUAND ──
  const quand = {
    texte: quandFr(date, a.dateFin) ?? "Date à définir",
    alerte: date === null,
    // Une fenêtre ne se « tient » pas à une heure : chaque sous-groupe y
    // choisit son créneau. Refermée, elle ne demande plus rien.
    consigne: aPeriode && !passe ? "Chaque sous-groupe choisit son créneau" : null,
  };

  // ── OÙ ──
  const ouTexte = (): string => {
    if (a.lieu && a.lienVisio) return `${a.lieu} et en visio`;
    if (a.lieu) return a.lieu;
    if (a.lienVisio) return enSousGroupes ? "En visio, lien par sous-groupe" : "En visio";
    // Rien de posé : on ne promet pas un lien de sous-groupe qui n'existe pas,
    // et sur le passé on CONSTATE au lieu de réclamer.
    if (enSousGroupes) return "À préciser (par sous-groupe)";
    return passe ? "Lieu non consigné" : "À préciser";
  };
  const ou = {
    texte: ouTexte(),
    alerte: !enSousGroupes && !a.lieu && !a.lienVisio && aPreparer,
    lienVisio: a.lienVisio,
  };

  // ── QUI (en segments : une alerte par fait) ──
  // QUI voit l'atelier : son AUDIENCE le dit (migration 051). Une sélection
  // encore vide reste le seul cas « visible de personne » — les deux autres
  // audiences désignent une cohorte, même si personne n'y est encore rattachée.
  const publicSegment: Fait =
    a.audience === "toutes"
      ? { texte: `Ouvert à toutes (${nb(nbInscritesEdition, "inscrite")})`, alerte: false }
      : a.audience === "phase"
        ? { texte: libelleAudience("phase", a.phase), alerte: false }
        : nbMembres > 0
          ? { texte: `Réservé à ${nb(nbMembres, "participante")}`, alerte: false }
          : // Un roster vide est un CONSTAT tant que l'atelier n'est pas daté (ou
            // qu'il est derrière nous) ; il ne devient un manque qu'entre les deux.
            { texte: "Aucune participante\u00a0: visible de personne", alerte: aPreparer };
  // Sorties précoces : la règle se lit dans l'ordre où on la raconte.
  const coachSegment = (): Fait | null => {
    if (nbCoachs > 0) return { texte: nb(nbCoachs, "coach"), alerte: false };
    if (a.coachs?.trim()) return { texte: "coach indiqué", alerte: false };
    // Autonome : dire ce qui EST (les sous-groupes portent leur coach).
    if (enSousGroupes)
      return {
        texte: sousGroupes.avecCoach > 0 ? "coach par sous-groupe" : "autonome",
        alerte: false,
      };
    // Ni le passé ni un atelier encore à dater ne réclament un coach.
    return aPreparer ? { texte: "coach à trouver", alerte: true } : null;
  };
  // La RÉPARTITION se dit dans le QUI, donc dès la liste des ateliers : c'est
  // là qu'on cherchait « où en est cet atelier » sans le trouver. Le reste à
  // ranger est écrit EN TOUTES LETTRES (jamais la seule couleur, RGAA 3.1) ;
  // il ne s'alarme, comme le reste, qu'une fois l'atelier daté (règle 1).
  const repartitionSegment = (): Fait | null => {
    if (!enSousGroupes) return null;
    if (sousGroupes.total === 0) {
      // Personne à répartir : rien à réclamer (le public manque déjà, plus haut).
      return nbCohorte === 0 ? null : { texte: "sous-groupes à créer", alerte: aPreparer };
    }
    return aRanger > 0
      ? { texte: `${nb(aRanger, "participante")} à ranger`, alerte: aPreparer }
      : { texte: nb(sousGroupes.total, "sous-groupe"), alerte: false };
  };
  // Au PROGRAMME PUBLIC, ou pas — désormais LU sur le réglage que l'orga coche
  // (migration 056), plus déduit de l'audience. L'état s'écrit en toutes lettres
  // (registre §RGAA 3.1) : c'est ce qui garantit qu'une séance ne quitte ni ne
  // rejoint la vitrine sans que personne s'en aperçoive — la raison d'être de ce
  // segment, et le garde-fou qui rend le réglage séparé sûr.
  const programmeSegment: Fait = a.auProgrammePublic
    ? { texte: "au programme public", alerte: false }
    : { texte: "hors programme public", alerte: false };
  const segments = [
    publicSegment,
    programmeSegment,
    repartitionSegment(),
    coachSegment(),
  ].filter((s): s is Fait => s !== null);
  const qui = {
    segments,
    texte: segments.map((s) => s.texte).join(" · "),
    alerte: segments.some((s) => s.alerte),
  };

  // ── AVANCEMENT (selon la nature) ──
  let avancement: Fait | null = null;
  if (enSousGroupes && sousGroupes.total > 0 && commence) {
    // Une fenêtre se suit DÈS son début (les binômes travaillent) ; ce n'est
    // une alerte qu'une fois la fenêtre refermée — et alors la phrase le dit,
    // pour que le retard ne tienne pas à la seule couleur.
    const { total, faits } = sousGroupes;
    const reste = total - faits;
    avancement = {
      texte:
        reste === 0
          ? `Séances faites (${total}/${total})`
          : [
              faits > 0 && `${faits} faite${faits > 1 ? "s" : ""} sur ${total}`,
              `${nb(reste, "séance")} à faire`,
              passe && "la fenêtre est fermée",
            ]
              .filter(Boolean)
              .join(" · "),
      alerte: reste > 0 && passe,
    };
  } else if (!enSousGroupes && passe && presences !== null && nbCohorte > 0) {
    const pointees = presences.filter((p) => p !== "non_renseignee").length;
    const total = nbCohorte;
    const reste = total - pointees;
    avancement = {
      texte:
        reste === 0
          ? `Présences complètes (${total}/${total})`
          : [
              pointees > 0 && `${pointees} pointée${pointees > 1 ? "s" : ""} sur ${total}`,
              `${nb(reste, "présence")} à pointer`,
            ]
              .filter(Boolean)
              .join(" · "),
      alerte: reste > 0,
    };
  }

  // La rangée « Sous-groupes » dit le RESTE À RANGER, pas un simple compte :
  // savoir qu'il y a 3 sous-groupes n'apprend rien ; savoir qu'il en manque 2,
  // si. Le dénominateur est ÉCRIT (« 2 à ranger sur 10 ») : la rangée voisine
  // « Participantes » compte, elle, toutes les inscrites d'un atelier ouvert à
  // toutes — sans le dénominateur, les deux nombres semblaient se contredire.
  const sousTitreSousGroupes = (): string => {
    if (sousGroupes.total === 0) {
      return nbCohorte > 0
        ? `Créer les sous-groupes\u00a0: ${nb(nbCohorte, "participante")} à répartir`
        : "Créer les sous-groupes";
    }
    const groupes = nb(sousGroupes.total, "sous-groupe");
    if (aRanger > 0) return `${groupes} · ${aRanger} à ranger sur ${nbCohorte}`;
    // Rien à répartir : on COMPTE, on ne rassure pas (« tout le monde est
    // rangé » sur un ensemble vide contredisait la page de répartition).
    return repartitionComplete(nbCohorte, sousGroupes.ranges)
      ? `${groupes} · tout le monde est rangé`
      : groupes;
  };

  return {
    quand,
    ou,
    qui,
    avancement,
    // Le lien d'atelier ne se règle que pour un collectif — sauf s'il en porte
    // déjà un (on ne cache jamais une donnée saisie).
    montreVisio: !enSousGroupes || Boolean(a.lienVisio),
    // Deux fonctions, deux rangées (hub-and-spoke) : QUI participe d'un côté,
    // COMMENT c'est réparti de l'autre. Les mêler sur une page — et sous un
    // libellé de présences — c'est ce qui rendait la répartition introuvable.
    libelleParticipantes: enSousGroupes ? "Participantes" : "Participantes et présences",
    // En sous-groupes, on compte l'ENSEMBLE À COUVRIR — le même effectif que la
    // rangée « Sous-groupes » juste en dessous. Compter ici toutes les inscrites
    // de l'édition et là la cohorte de la phase mettait deux nombres
    // contradictoires à deux lignes d'écart.
    sousTitreParticipantes: enSousGroupes
      ? nbCohorte > 0
        ? nb(nbCohorte, "participante")
        : "Dire qui participe"
      : a.audience === "toutes"
        ? // Le public réel, chiffré comme la variante réservée ; on ne réclame le
          // pointage que quand il y a vraiment lieu de le faire.
          `${nb(nbInscritesEdition, "inscrite")}${
            avancement?.alerte ? "\u00a0: présences à pointer" : ""
          }`
        : a.audience === "phase"
          ? libelleAudience("phase", a.phase)
          : nb(nbMembres, "participante"),
    sousTitreSousGroupes: enSousGroupes ? sousTitreSousGroupes() : null,
    sousTitreCoachs: enSousGroupes
      ? sousGroupes.avecCoach > 0
        ? "Coach par sous-groupe"
        : "Autonome"
      : aPreparer
        ? "À trouver"
        : "Non consigné",
  };
}
