import { formatDateFr, nb } from "@/lib/format";
import { finEffective, inscriptionsEtat } from "@/lib/tremplin-statut";

/**
 * Le RÉCIT d'une édition pour ses surfaces PUBLIQUES (lot G, refonte §8). Ces
 * pages ont un rôle stratégique : montrer ce qu'on fait — aux futures
 * candidates (« voilà ce que tu vivras »), aux sponsors (« voilà ce que vous
 * soutenez »), à la communauté. Elles doivent donc raconter une aventure
 * VIVANTE, pas afficher un statut administratif (« Finale passée », « En
 * cours ») : c'est la raison d'être de ce module, et pourquoi
 * `editionStatutAffiche` est désormais réservé à l'admin.
 *
 * UNE décision (`etapeEdition` : où en est l'aventure), deux rendus qui ne
 * prennent chacun que ce dont ils ont besoin :
 *
 * - `recitEdition` → la FICHE : le kicker en une phrase. La durée du parcours
 *   est mesurée à part (`semainesParcours`), car chaque page mesure SON
 *   chapitre — une valeur unique agrégeait deux programmes ;
 * - `resumeEdition` → une LIGNE de liste (le hub d'une conf), qui n'a aucun
 *   compteur à charger : la porte d'entrée et la fiche parlent la même langue
 *   sans que la liste paie une requête par édition.
 *
 * Trois règles de rédaction :
 * - **une candidature ouverte passe avant tout** : c'est la seule information
 *   convertissante de la page, et elle avait disparu avec le statut ;
 * - **l'année n'est jamais dans le kicker** : la page l'affiche déjà juste
 *   devant (on lisait « 2026 · Édition 2026 en préparation ») ;
 * - **pas d'article devant un nom de conférence** : le référentiel contient
 *   « Agile Tour Toulouse », « UX Days »… et « du UX Days » ne se dit pas. On
 *   annonce donc « scène : UX Days ».
 *
 * Les membres sont joints par «, » et non « · » : c'est une phrase, et les
 * lecteurs d'écran n'observent aucune pause sur un point médian.
 *
 * RGPD : dates, nombres et nom de conférence — aucun nominatif. Le kicker ne
 * dit jamais l'effectif de la phase 3 : ce module raconte une ÉTAPE, et le
 * compteur de cette cohorte (publié depuis l'arbitrage du 2026-08-02, cf.
 * docs/conception-deux-temps-edition-publique.md §6.3) appartient à la page qui
 * la raconte, pas à une phrase d'accroche.
 */

/** Où en est l'aventure. UNE décision, partagée par les deux rendus. */
export type EtapeEdition =
  | "candidature"
  | "en_cours"
  | "vers_la_scene"
  | "bouclee"
  | "preparation";

/** Ce qu'il faut pour situer une édition dans son aventure : ses dates et son
 * statut, rien de plus (une ligne de liste les a déjà en main). */
export interface EtapeEntrees {
  statut: string;
  finaleDate: string | null;
  confDate: string | null;
  inscriptionsDebut: string | null;
  inscriptionsFin: string | null;
  aujourdhui: string;
}

export function etapeEdition(e: EtapeEntrees): EtapeEdition {
  const finalePassee = e.finaleDate !== null && e.finaleDate < e.aujourdhui;
  const confPassee = e.confDate !== null && e.confDate < e.aujourdhui;
  // Une édition ARCHIVÉE se raconte au passé, point : l'archivage est une
  // décision explicite de l'orga. La garde ne jouait qu'en l'absence totale de
  // dates — une archive avec finale passée mais sans date de conf restait
  // « En route vers la scène » pour toujours (revue post-prod du 31/07).
  if (confPassee || e.statut === "archive") return "bouclee";
  const fenetre = inscriptionsEtat(
    { inscriptionsDebut: e.inscriptionsDebut, inscriptionsFin: e.inscriptionsFin },
    e.aujourdhui,
  );
  if (!finalePassee && fenetre === "ouvertes") return "candidature";
  if (finalePassee) return "vers_la_scene";
  return e.finaleDate ? "en_cours" : "preparation";
}

/**
 * L'étape en quelques mots, pour une LIGNE de liste. Volontairement sans
 * chiffre : le hub d'une conférence ne charge pas les effectifs de chaque
 * édition, et un compteur absent se serait affiché « 0 speakeuse ».
 */
export function resumeEdition(e: EtapeEntrees): string {
  switch (etapeEdition(e)) {
    case "bouclee":
      return "Aventure bouclée";
    case "candidature":
      return "Candidatures ouvertes";
    case "vers_la_scene":
      return "En route vers la scène";
    case "en_cours":
      return "Accompagnement en cours";
    case "preparation":
      return "En préparation";
  }
}

/**
 * Les compteurs de l'édition valent-ils la peine d'être montrés ?
 *
 * Trois zéros ne disent pas « zéro » : posés en grand sous un titre invisible
 * (`sr-only`), ils se lisent « ça a raté ». C'est faux d'une année qui a existé
 * autrement qu'en parcours — elle a son récit — comme d'une édition dont les
 * inscriptions ouvrent demain. Dès qu'UN chiffre existe, les trois se montrent :
 * c'est là qu'un zéro informe (« 8 inscrites, 0 gagnante » raconte l'étape).
 */
export function aDesChiffresAAfficher(counts: {
  inscrites: number;
  finalistes: number;
  gagnantes: number;
}): boolean {
  return counts.inscrites > 0 || counts.finalistes > 0 || counts.gagnantes > 0;
}

/**
 * Cette édition a-t-elle un Tremplin à décrire ?
 *
 * Les blocs éditoriaux de la page (« Ce qu'il y a à gagner », « La soirée pitch
 * devant jury ») racontent COMMENT se déroule un Tremplin. Sur une édition à
 * venir ou en cours, c'est exactement ce qui donne envie de candidater : ils
 * restent, même sans une seule inscrite encore.
 *
 * Sur une édition BOUCLÉE qui n'a rien tenu, ils promettent au futur des prix
 * que personne n'a gagnés et une soirée qui n'a pas eu lieu. C'est le cas de
 * 2025 : cette année-là, la communauté est montée sur la scène du DevFest, sans
 * parcours autour. Sa page a un récit à raconter, pas un règlement à afficher.
 */
export function aUnTremplinADecrire(
  e: EtapeEntrees & {
    /** Séances du chapitre 1 — celles que la page rend, pas toutes phases confondues. */
    nbAteliers: number;
    nbInscrites: number;
    nbPalmares: number;
    nbRecompenses: number;
    /** Un jury saisi et consenti n'a nulle part ailleurs où s'afficher. */
    nbJury: number;
  },
): boolean {
  if (etapeEdition(e) !== "bouclee") return true;
  return (
    e.nbAteliers > 0 ||
    e.nbInscrites > 0 ||
    e.nbPalmares > 0 ||
    e.nbRecompenses > 0 ||
    e.nbJury > 0 ||
    e.finaleDate !== null
  );
}

export interface RecitEntrees extends EtapeEntrees {
  annee: number;
  confNom: string;
  /** Ateliers du programme PUBLIC : les bornes du parcours s'en dérivent ici,
   * pour qu'elles gagnent la couverture des tests de ce module. */
  ateliers: readonly { date: string | null; dateFin: string | null }[];
  nbInscrites: number;
  nbGagnantes: number;
}

export interface Recit {
  kicker: string;
  titreParcours: string;
}

/** Jour + mois, sans année : le récit vit dans l'année de son titre. */
function jourMois(d: string): string {
  return formatDateFr(d, { day: "numeric", month: "long" }) ?? d;
}

const JOUR_MS = 86_400_000;

/**
 * Semaines de parcours entre la PREMIÈRE séance d'une liste et une fin donnée,
 * ou `null` si c'est indéterminable (aucune séance datée, fin absente, ou moins
 * d'une semaine — une journée d'atelier ne devient jamais « 0 semaine »).
 *
 * Fonction à part, et pas un champ du récit, parce que chaque page mesure SON
 * chapitre : la page d'édition compte du premier atelier à la soirée finale,
 * celle de la montée sur scène compte de la finale à la conférence. Une mesure
 * unique et agrégée annonçait 29 semaines sur un parcours qui en dure 6 — elle
 * additionnait deux programmes que rien ne relie pour la lectrice.
 *
 * La fin est fournie par l'appelant (finale, conférence, dernière séance) : ce
 * module ne peut pas deviner de quel chapitre on parle, et une valeur par défaut
 * l'aurait fait deviner de travers.
 */
export function semainesParcours(
  ateliers: readonly { date: string | null; dateFin: string | null }[],
  fin: string | null,
): number | null {
  // Un accompagnement, ce sont PLUSIEURS séances : une seule est un événement,
  // et « du premier atelier » suppose déjà qu'il y en ait un second. Même règle
  // que le mot « accompagnées » du kicker (`aUnParcours`), sans quoi les deux
  // phrases de la page se contrediraient — l'une se taisant faute de parcours
  // pendant que l'autre en affirmerait un.
  if (ateliers.length < 2) return null;
  const debuts = ateliers.map((a) => a.date).filter((d): d is string => Boolean(d));
  if (debuts.length === 0 || !fin) return null;
  const premier = debuts.reduce((m, d) => (d < m ? d : m));
  if (fin <= premier) return null;
  const semaines = Math.round((Date.parse(fin) - Date.parse(premier)) / JOUR_MS / 7);
  return semaines > 0 ? semaines : null;
}

/** Fin EFFECTIVE la plus tardive d'une liste de séances (fenêtre comprise). */
export function derniereSeance(
  ateliers: readonly { date: string | null; dateFin: string | null }[],
): string | null {
  const fins = ateliers.map(finEffective).filter((d): d is string => Boolean(d));
  return fins.length > 0 ? fins.reduce((m, d) => (d > m ? d : m)) : null;
}

export function recitEdition(e: RecitEntrees): Recit {
  const etape = etapeEdition(e);
  const debuts = e.ateliers.map((a) => a.date).filter((d): d is string => Boolean(d));
  const premierAtelier = debuts.length > 0 ? debuts.reduce((m, d) => (d < m ? d : m)) : null;

  // ── Y A-T-IL EU UN PARCOURS ? ──
  //
  // Un accompagnement, ce sont plusieurs séances. Une seule est un événement, et
  // « du PREMIER atelier » suppose déjà qu'il y en ait un second.
  //
  // On compte les SÉANCES, pas les séances datées : l'admin a une section « À
  // dater », donc une séance sans date est un état normal du programme, pas une
  // absence. Et pas les jours non plus — une fenêtre (« du 7 au 13 ») reste une
  // séance, même longue.
  //
  // Le kicker s'en sert pour le mot « accompagnées », qui se MÉRITE ; la durée,
  // elle, est mesurée à part (`semainesParcours`) et applique la même règle,
  // sans quoi les deux phrases se contrediraient à nouveau.
  const aUnParcours = e.ateliers.length >= 2;

  // ── Le kicker : l'étape où l'on est, racontée ──
  const scene = e.confNom ? `scène\u00a0: ${e.confNom}` : null;
  const morceaux: (string | false | null)[] = (() => {
    switch (etape) {
      case "bouclee":
        // L'aventure est bouclée : on dit ce qu'elle a produit.
        return [
          // « Accompagnées » se MÉRITE : sans parcours, elles ont participé, ce
          // qui est déjà vrai et déjà beau. Le mot fort affirmait un service
          // rendu que l'édition n'avait pas rendu (2025 n'a pas eu de
          // préparation), sur une page indexée.
          e.nbInscrites > 0 &&
            (aUnParcours
              ? `${nb(e.nbInscrites, "speakeuse")} accompagnées`
              : `${nb(e.nbInscrites, "participante")}`),
          e.nbGagnantes > 0 && nb(e.nbGagnantes, "gagnante"),
          e.confNom && `sur la scène du ${e.confNom}`,
        ];
      case "candidature":
        // Le seul état où la page a quelque chose à demander au visiteur.
        return [
          e.inscriptionsFin
            ? `Candidatures ouvertes jusqu'au ${jourMois(e.inscriptionsFin)}`
            : "Candidatures ouvertes",
          e.finaleDate && `finale le ${jourMois(e.finaleDate)}`,
          scene,
        ];
      case "vers_la_scene":
        // Entre-deux : la finale a eu lieu, la conférence se prépare.
        return [
          e.nbGagnantes > 0
            ? `${nb(e.nbGagnantes, "gagnante")} à la finale`
            : e.finaleDate && `Finale tenue le ${jourMois(e.finaleDate)}`,
          e.confDate ? `en scène le ${jourMois(e.confDate)}` : scene,
        ];
      case "en_cours":
        // L'aventure court : on dit qui est embarquée et vers quoi.
        return [
          e.nbInscrites > 0
            ? `${nb(e.nbInscrites, "speakeuse")} en préparation`
            : "Préparation en cours",
          e.finaleDate && `finale le ${jourMois(e.finaleDate)}`,
          scene,
        ];
      case "preparation":
        // Rien de daté encore : une invitation, jamais un vide (et jamais
        // l'année, la page l'affiche déjà).
        return ["Édition en préparation", e.confNom && `avec le ${e.confNom}`];
    }
  })();
  // Repli : une aventure bouclée dont on n'a aucun chiffre se dit quand même.
  const kicker = morceaux.filter(Boolean).join(", ") || resumeEdition(e);

  const parcoursCommence = premierAtelier !== null && premierAtelier <= e.aujourdhui;
  return {
    kicker,
    titreParcours: parcoursCommence
      ? "Ce qu'on a travaillé ensemble"
      : "Ce qu'on va travailler ensemble",
  };
}
