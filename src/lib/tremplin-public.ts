import { pool } from "@/lib/db";
import { getEditionByConfAndYear, type EditionStatut } from "@/lib/tremplin-editions";
import { sqlDansListe } from "@/lib/sql-liste";
import { STATUTS_FICHE_JOINTE } from "@/lib/profile-status";
import {
  getProgrammePublicByEdition,
  PHASES_ATELIER,
  type PhaseAtelier,
} from "@/lib/tremplin-ateliers";
import { rangLabel, rangOrdinal } from "@/lib/tremplin-registrations";
import {
  RECOMPENSE_TRANSFERT_RAISON_CLAUSE,
  type RecompenseTransfertRaison,
} from "@/lib/tremplin-recompenses";
import { getPublicPhotos, type TremplinPhoto } from "@/lib/tremplin-photos";
import { getPublicJuryByEdition, type PublicJury } from "@/lib/tremplin-jury";
import {
  getPublishedArticleByConferenceEdition,
  type RecitConference,
} from "@/lib/contenus";

/**
 * Projection PUBLIQUE d'une édition (comme `PublicSpeaker` pour l'annuaire).
 * On ne sérialise QUE des champs sûrs : compteurs anonymes, ateliers (titre/
 * date), finalistes/palmarès **consentis**, photos publiables. Jamais
 * d'e-mail, de `userId`, de liste d'inscrites, de noms non consentis, ni de
 * documents privés. Cf. docs/tremplin-edition-publique.md.
 */

export interface PublicCounts {
  inscrites: number;
  finalistes: number;
  gagnantes: number;
  /** Speakeuses accompagnées vers la scène de la conférence (phase 3). */
  accompagnees: number;
}

/* L'effectif de la phase 3 ÉTAIT tenu hors du DTO : tant que le roster se
 * réduisait aux gagnantes, le publier revenait à dire, sur une petite édition,
 * que telle gagnante nommée n'était plus accompagnée.
 *
 * L'édition 2026 a changé le fait lui-même, pas seulement l'avis : d'autres
 * participantes ont soumis au CFP du DevFest et ont été retenues, d'où la
 * décision d'accompagner six speakeuses vers la scène. Le roster n'est plus le
 * complément du palmarès, c'est une COHORTE à part entière — et son parcours a
 * sa propre page publique. L'orga a donc tranché de la raconter.
 *
 * Ce qui NE change pas : chaque nom reste gaté par un consentement horodaté et
 * retirable — celui DE CETTE PHASE (`rp.public`, migration 055), pas celui de la
 * galerie des finalistes, qui parlait d'autre chose. Le compteur, lui, reste un agrégat anonyme,
 * exactement comme `finalistes` — dont la galerie ne nomme, elle aussi, que les
 * consentantes. */

export interface PublicFinalist {
  nom: string;
  role: string | null;
  sujet: string | null;
  bio: string | null;
  linkedin: string | null;
  siteWeb: string | null;
  photoUrl: string | null;
  /** Intitulés des récompenses dont elle bénéficie (elle est déjà publique). */
  recompenses: string[];
}

/**
 * Une speakeuse ACCOMPAGNÉE vers la scène de la conférence (phase 3).
 *
 * Même forme et même contrat que la galerie des finalistes — c'est la même
 * personne, à un autre moment de son parcours — donc un alias plutôt qu'une
 * copie : deux formes jumelles finissent toujours par diverger sur le champ que
 * l'une gagne et pas l'autre.
 */
export type PublicAccompagnee = PublicFinalist;

/**
 * Une ACCOMPAGNANTE : coach ou animatrice d'une séance du programme public.
 *
 * Le consentement vit sur sa FICHE COACH (`coach_profiles.public`, migration
 * 054) — pas sur sa fiche speakeuse : être citée comme coach et figurer dans
 * l'annuaire des speakeuses sont deux finalités distinctes, et une coach qui ne
 * prend pas la parole n'a rien à faire dans un annuaire de speakeuses. L'orga
 * tient cette fiche pour celles qui ne se connectent jamais ; le consentement
 * est horodaté, et se révoque d'un geste, partout à la fois.
 *
 * Sans accord, on sous-annonce : le parcours se raconte, le nom attend.
 *
 * Ni identifiant ni e-mail : on ne sérialise que ce qui s'affiche.
 */
export interface PublicAccompagnante {
  nom: string;
  /** Rôle tel qu'il figure sur sa fiche coach, ou null. */
  role: string | null;
  /** Un lien vers elle (LinkedIn, site), ou null. */
  lien: string | null;
}

/** Récompense de l'édition, côté public : la bénéficiaire n'est nommée que si
 * son inscription est publique ; le motif (interne) ne sort jamais. */
export interface PublicRecompense {
  intitule: string;
  detail: string | null;
  rang: number | null;
  /** Nom de la bénéficiaire, seulement si ELLE a consenti (sinon null). */
  beneficiaireNom: string | null;
  /** Classement de la bénéficiaire (gaté par son consentement) — pour « (2ᵉ) ». */
  beneficiaireClassement: number | null;
  /** Raison publique énumérée d'un transfert, ou null (pas un transfert). */
  transfertRaison: RecompenseTransfertRaison | null;
  /** Nom de la lauréate d'origine (dérivée du rang), seulement si ELLE a
   * consenti (sinon null : on n'expose alors ni son nom ni son rang). */
  origineNom: string | null;
}

/** Élision française devant voyelle ou h : « de Ada » → « d'Ada ». */
function deNom(nom: string): string {
  return /^[aeiouyàâäéèêëïîôöùûüh]/i.test(nom) ? `d'${nom}` : `de ${nom}`;
}

/**
 * Phrase publique du transfert d'une récompense, ou null (pas un transfert, ou
 * aucun nom consenti). Implémente la matrice des 4 cas de consentement — chaque
 * nom n'apparaît que si CETTE personne a consenti ; si l'origine n'a pas
 * consenti on n'expose pas non plus son rang (anti-ré-identification). Sans
 * cadratin, « Attribuée » au féminin (accord avec « récompense »), insécables.
 */
export function mentionTransfert(rec: PublicRecompense): string | null {
  if (rec.transfertRaison === null) return null;
  const clause = RECOMPENSE_TRANSFERT_RAISON_CLAUSE[rec.transfertRaison];
  const suffixe = clause ? `, ${clause}` : "";
  const benefRang = rangOrdinal(rec.beneficiaireClassement);
  const origineRang = rangOrdinal(rec.rang);
  // « Attribuée » (accord avec « récompense ») plutôt que « Présentée » : marche
  // pour tout type de lot (talk, coaching, meetup…), pas seulement une présentation.
  const aBenef = rec.beneficiaireNom
    ? `à ${rec.beneficiaireNom}${benefRang ? ` (${benefRang})` : ""}`
    : null;
  const placeOrigine = rec.origineNom
    ? `à la place ${deNom(rec.origineNom)}${origineRang ? ` (${origineRang})` : ""}`
    : null;

  if (aBenef && placeOrigine) return `Attribuée ${aBenef} ${placeOrigine}${suffixe}.`;
  if (aBenef) return `Attribuée ${aBenef}.`;
  if (placeOrigine) return `Récompense du ${rangLabel(rec.rang)}, transmise${suffixe}.`;
  return null;
}

export interface PublicAward {
  recompense: string;
  /** Nom + talk seulement si la gagnante a consenti (sinon null = anonyme). */
  nom: string | null;
  sujet: string | null;
}

/**
 * Une séance du programme, telle que le PUBLIC la lit : de quoi soutenir
 * l'argument de la page (« N semaines d'accompagnement, du premier atelier à la
 * scène »), et rien de plus.
 *
 * PAS de `lieu` : l'adresse d'une séance dit OÙ et QUAND un petit groupe de
 * femmes identifiables se retrouve. Elle a sa place dans l'espace des inscrites,
 * pas sur une page indexée — et la vitrine n'en a pas besoin pour convaincre.
 */
export interface PublicAtelier {
  titre: string;
  date: string | null;
  /** Fin de période (« semaine du 7 au 13 »), sinon null — lot A. */
  dateFin: string | null;
  description: string | null;
  /**
   * Le temps du parcours auquel la séance appartient : avant la soirée finale
   * (préparation au CFP et au pitch) ou après (montée sur scène). Deux pages
   * publiques s'en servent pour ne rendre chacune QUE son parcours — sans elle,
   * une liste plate de quinze séances laissait croire à un seul programme, et la
   * durée affichée courait d'avril à novembre.
   */
  phase: PhaseAtelier;
}

export interface PublicEdition {
  nom: string;
  annee: number;
  confSlug: string | null;
  statut: EditionStatut;
  description: string | null;
  confNom: string | null;
  confLieu: string | null;
  confDate: string | null;
  confLien: string | null;
  finaleDate: string | null;
  finaleLieu: string | null;
  /** Fenêtre d'inscriptions (pour dériver le libellé affiché — pas de donnée perso). */
  inscriptionsDebut: string | null;
  inscriptionsFin: string | null;
  counts: PublicCounts;
  ateliers: PublicAtelier[];
  finalistes: PublicFinalist[];
  /** Le roster de la phase 3, limité aux consentantes (cf. `PublicAccompagnee`). */
  accompagnees: PublicAccompagnee[];
  /** Qui a accompagné, phase par phase. Les deux clés existent toujours, quitte
   * à être vides : une phase absente de la structure est une phase qu'on oublie
   * de créditer. */
  accompagnantes: Record<PhaseAtelier, PublicAccompagnante[]>;
  palmares: PublicAward[];
  recompenses: PublicRecompense[];
  jury: PublicJury[];
  photos: TremplinPhoto[];
  /**
   * Le récit de la conférence où se tient cette édition, quand il y en a un
   * (`contenus.conference_edition_id`). Une année peut avoir été autre chose
   * qu'un parcours : c'est là qu'elle le raconte. Slug/titre/chapô seulement,
   * pas d'identifiant interne.
   */
  recit: RecitConference | null;
}

interface CountsRow {
  inscrites: string;
  finalistes: string;
  gagnantes: string;
}

interface FinalistRow {
  id: number;
  // Nom : saisi par l'orga (sans compte) OU nom du compte relié.
  nom: string | null;
  // Bio / site / photo / poste : DONNÉES PERSONNELLES, lues sur la fiche
  // speakeuse (profil) et l'avatar du compte — jamais saisies par l'orga.
  role: string | null;
  sujet: string | null;
  bio: string | null;
  linkedin: string | null;
  site_web: string | null;
  photo_url: string | null;
}

interface AwardRow {
  classement: number | null;
  nom: string | null;
  sujet: string | null;
  public: boolean;
}

interface AccompagnanteRow {
  phase: PhaseAtelier;
  user_id: number;
  nom: string | null;
  role: string | null;
  lien: string | null;
}

/**
 * Les colonnes de la galerie : nom consenti + fiche speakeuse. Une seule
 * définition pour les finalistes et les accompagnées — ce sont les mêmes
 * personnes, lues sous le même contrat, et la clause de l'avatar OAuth avait
 * tout pour être recopiée de travers.
 *
 * Cf. la requête des finalistes pour le détail du contrat : bio/rôle/liens
 * suivent le consentement d'ÉDITION (fiche jointe sauf retrait explicite),
 * l'avatar reste réservé aux fiches PUBLIÉES.
 */
const COLS_GALERIE = `r.id,
              COALESCE(r.participante_nom, u.name) AS nom,
              sp.poste   AS role,
              st.titre   AS sujet,
              sp.bio     AS bio,
              sp.linkedin AS linkedin,
              sp.website AS site_web,
              CASE WHEN sp.status = 'publie' THEN u.image END AS photo_url`;

// Lecture en LISTE BLANCHE sur une liste fermée en base (CHECK 073, miroir
// PROFILE_STATUSES) : un statut AJOUTÉ demain reste dehors tant qu'il n'entre
// pas dans STATUTS_FICHE_JOINTE — c'est-à-dire tant que personne n'a tranché
// s'il expose bio, LinkedIn et site perso. Re-juger cette liste à chaque
// extension de PROFILE_STATUSES.
const JOINTURES_GALERIE = `LEFT JOIN users u ON u.id = r."userId"
         LEFT JOIN speaker_profiles sp
                ON sp."userId" = r."userId" AND ${sqlDansListe("sp.status", STATUTS_FICHE_JOINTE)}
         LEFT JOIN speaker_talks st ON st.id = r.talk_id`;

/**
 * L'édition a-t-elle un CHAPITRE 2 à montrer — l'accompagnement d'après-finale
 * vers la scène ?
 *
 * SOURCE UNIQUE de la condition, parce que trois surfaces en dépendent : la page
 * du chapitre 2 (qui renvoie un 404 sinon), le lien depuis la page d'édition, et
 * la carte du hub de la conférence. Recopiée, la règle se serait désynchronisée
 * au premier ajustement — et le symptôme est un lien qui mène à un 404, c'est-à-
 * dire la seule chose que ces trois surfaces cherchent à éviter.
 *
 * Une séance publiée OU une accompagnée nommée suffit : il y a alors quelque
 * chose à raconter. Le compteur seul ne suffit pas — une cohorte comptée mais
 * sans aucun nom ni séance publique donnerait une page vide.
 */
export function aUnChapitreMonteeSurScene(ed: PublicEdition): boolean {
  return (
    ed.ateliers.some((a) => a.phase === "montee_sur_scene") || ed.accompagnees.length > 0
  );
}

/**
 * Construit le DTO public d'une édition à partir de (conf, année), ou `null`
 * si l'édition n'existe pas. Résilient : aucune donnée privée n'en sort.
 */
export async function getPublicEdition(
  confSlug: string,
  annee: number,
): Promise<PublicEdition | "deleted" | null> {
  const edition = await getEditionByConfAndYear(confSlug, annee);
  if (!edition) return null;
  // Édition supprimée : coquille gardée pour un tombstone (page « supprimée »
  // hors index), au lieu d'un 404 cassé.
  if (edition.deletedAt) return "deleted";
  // Une édition en préparation n'existe pas encore publiquement (404).
  if (edition.statut === "preparation") return null;

  const [
    countsRes,
    finalistsRes,
    awardsRes,
    ateliers,
    photos,
    recompensesRes,
    jury,
    accompagneesRes,
    accompagneesCountRes,
    accompagnantesRes,
    recit,
  ] = await Promise.all([
    pool.query(
      // COUNT(CASE…)/COUNT(col) plutôt que FILTER : portable (et supporté pg-mem).
      `SELECT
         COUNT(*)                                    AS inscrites,
         COUNT(CASE WHEN finale_presente THEN 1 END) AS finalistes,
         COUNT(classement)                           AS gagnantes
       FROM tremplin_registrations r WHERE edition_id = $1`,
      [edition.id],
    ).catch((e) => {
      // Comme les six autres : une base incomplète ne doit JAMAIS abattre la
      // page publique. Les `Number(… ?? 0)` ci-dessous dégradent à zéro.
      console.error("Comptes publics indisponibles", e);
      return { rows: [] as unknown[] };
    }),
    // Galerie : finalistes ayant consenti à être nommées. Bio / site / photo /
    // poste viennent de la FICHE speakeuse (profil) et de l'avatar du compte —
    // jamais de l'inscription (l'orga ne gère pas ces données personnelles).
    // Le nom : saisi par l'orga (sans compte) ou nom du compte relié.
    pool.query(
      // Sur la page d'ÉDITION, bio/rôle/liens/photo suivent le consentement
      // d'ÉDITION (r.public, filtré ci-dessous), PAS la publication dans
      // l'annuaire général. Une finaliste apparaît donc avec sa fiche même en
      // brouillon : elle garde la main pour publier — ou non — dans l'annuaire
      // /speakeuses (gaté séparément sur status='publie', cf. profiles.ts).
      // La fiche est jointe SAUF si elle est explicitement retirée (masquée ou
      // refusée) : ce signal de retrait est respecté, rien n'est alors exposé.
      // Le nom, lui, dépend du seul consentement galerie (r.public).
      // EXCEPTION photo : l'avatar OAuth (Google/LinkedIn) n'est PAS une donnée
      // que la personne a choisi de diffuser ; il reste réservé aux fiches
      // PUBLIÉES (opt-in annuaire), jamais exposé automatiquement pour un
      // brouillon créé par le workflow orga.
      `SELECT ${COLS_GALERIE}
         FROM tremplin_registrations r
         ${JOINTURES_GALERIE}
        WHERE r.edition_id = $1 AND r."public" = true AND r.finale_presente = true
        ORDER BY COALESCE(r.participante_nom, u.name)`,
      [edition.id],
    ),
    // Palmarès : récompensées ; nom seulement si consentement. Même COALESCE
    // que la galerie (nom saisi OU nom du compte relié) — sinon une gagnante
    // reliée par compte serait « non communiquée » ici tout en étant nommée
    // dans la galerie (et privée du badge gagnante).
    pool.query(
      `SELECT r.classement, COALESCE(r.participante_nom, u.name) AS nom,
              r.titre_palmares AS sujet, r."public"
         FROM tremplin_registrations r
         LEFT JOIN users u ON u.id = r."userId"
        WHERE r.edition_id = $1 AND r.classement IS NOT NULL
        ORDER BY r.classement`,
      [edition.id],
    ),
    // Public : le PROGRAMME — les séances dont l'audience vise une COHORTE ; une
    // sélection nominative reste dehors (cf. getProgrammePublicByEdition). Repli
    // [] si la colonne `audience` (migration 051) n'a pas encore été jouée : une
    // migration manquante ne doit jamais abattre la page publique.
    getProgrammePublicByEdition(edition.id).catch((e) => {
      console.error("Programme public indisponible (migration 051 ?)", e);
      return [];
    }),
    // Photos (table tags pas encore migrée en prod → section vide, pas d'oups) :
    // une migration manquante ne doit JAMAIS abattre la page publique.
    getPublicPhotos(edition.id).catch((e) => {
      console.error("Photos publiques indisponibles (migration 020 ?)", e);
      return [] as TremplinPhoto[];
    }),
    // Récompenses (table pas encore migrée en preview → section vide, pas d'oups).
    pool
      .query(
        // Origine d'un transfert : DÉRIVÉE (la lauréate du même rang), gatée par
        // SON propre consentement (alias `ro`, jamais celui de la bénéficiaire).
        // Le classement étant unique par édition, la jointure ne multiplie pas.
        `SELECT rec.intitule, rec.detail, rec.rang, rec.transfert_raison,
                CASE WHEN r."public" THEN COALESCE(r.participante_nom, u.name) END AS beneficiaire_nom,
                CASE WHEN r."public" THEN r.classement END AS beneficiaire_classement,
                CASE WHEN r."public" THEN rec.beneficiaire_registration_id END AS beneficiaire_public_id,
                CASE WHEN ro."public" THEN COALESCE(ro.participante_nom, uo.name) END AS origine_nom
           FROM tremplin_recompenses rec
           LEFT JOIN tremplin_registrations r ON r.id = rec.beneficiaire_registration_id
           LEFT JOIN users u ON u.id = r."userId"
           LEFT JOIN tremplin_registrations ro
                  ON ro.edition_id = rec.edition_id AND ro.classement = rec.rang
                 AND ro.id <> rec.beneficiaire_registration_id
           LEFT JOIN users uo ON uo.id = ro."userId"
          WHERE rec.edition_id = $1
          ORDER BY COALESCE(rec.rang, 1000000), rec.id`,
        [edition.id],
      )
      .catch((e) => {
        console.error("Récompenses publiques indisponibles (migration 018 ?)", e);
        return { rows: [] as unknown[] };
      }),
    // Jury (table pas encore migrée en preview → section vide, pas d'oups).
    getPublicJuryByEdition(edition.id).catch((e) => {
      console.error("Jury public indisponible (migration 025 ?)", e);
      return [] as PublicJury[];
    }),
    // Les accompagnées vers la scène : le roster de la phase 3.
    //
    // Le consentement lu est celui DE LA PHASE (`rp.public`, migration 055), pas
    // celui de la galerie des finalistes : `r.public` a été recueilli pour la
    // soirée de juin, et la cohorte de la phase 3 la déborde (des participantes
    // retenues au CFP de la conférence n'ont jamais été finalistes). Les deux
    // accords se donnent et se retirent séparément.
    //
    // L'appartenance vient de la table de liaison, JAMAIS de `phase_entree` —
    // celle-ci dit par où on est ENTRÉE dans le parcours, pas où l'on est.
    pool
      .query(
        `SELECT ${COLS_GALERIE}
           FROM tremplin_registrations r
           JOIN tremplin_registration_phases rp
             ON rp.registration_id = r.id AND rp.phase = 'montee_sur_scene'
           ${JOINTURES_GALERIE}
          WHERE r.edition_id = $1 AND rp."public" = true
          ORDER BY COALESCE(r.participante_nom, u.name)`,
        [edition.id],
      )
      .catch((e) => {
        console.error("Accompagnées indisponibles (migration 055 ?)", e);
        return { rows: [] as unknown[] };
      }),
    // Leur EFFECTIF, agrégat anonyme : il compte celles qui n'ont pas consenti à
    // être nommées, exactement comme `finalistes` compte les finalistes discrètes.
    pool
      .query(
        `SELECT COUNT(*) AS n
           FROM tremplin_registrations r
           JOIN tremplin_registration_phases rp
             ON rp.registration_id = r.id AND rp.phase = 'montee_sur_scene'
          WHERE r.edition_id = $1`,
        [edition.id],
      )
      .catch((e) => {
        console.error("Effectif accompagnées indisponible (migration 055 ?)", e);
        return { rows: [] as unknown[] };
      }),
    // Les accompagnantes, phase par phase. Deux gardes, chacune pour une raison
    // différente : les séances sont celles du PROGRAMME PUBLIC (une séance hors
    // programme n'expose pas plus son encadrement que son contenu), et les
    // personnes sont celles dont la FICHE COACH porte l'accord (`cp.public`) —
    // surtout pas la publication dans l'annuaire des speakeuses, qui répond à
    // une autre question.
    pool
      .query(
        `SELECT a.phase, u.id AS user_id, u.name AS nom, cp.role, cp.lien
           FROM tremplin_ateliers a
           JOIN tremplin_atelier_coachs ac ON ac.atelier_id = a.id
           JOIN users u ON u.id = ac.user_id
           JOIN coach_profiles cp ON cp."userId" = u.id AND cp."public" = true
          WHERE a.edition_id = $1 AND a.au_programme_public = true
          ORDER BY u.name, a.phase`,
        [edition.id],
      )
      .catch((e) => {
        console.error("Accompagnantes indisponibles (migration 054 ?)", e);
        return { rows: [] as unknown[] };
      }),
    // Le récit de la conférence où se tient l'édition : le contenu rattaché à
    // la conférence répertoriée (migration 040), écrit dans /admin/contenus.
    // Sans conférence rattachée, il n'y a rien à raconter d'autre.
    edition.conferenceEditionId == null
      ? Promise.resolve(null)
      : getPublishedArticleByConferenceEdition(edition.conferenceEditionId).catch((e) => {
          console.error("Récit de conférence indisponible", e);
          return null;
        }),
  ]);

  const c = (countsRes.rows[0] ?? {}) as CountsRow;
  const nbAccompagnees = (accompagneesCountRes.rows[0] ?? {}) as { n?: string };
  const counts: PublicCounts = {
    inscrites: Number(c.inscrites ?? 0),
    finalistes: Number(c.finalistes ?? 0),
    gagnantes: Number(c.gagnantes ?? 0),
    accompagnees: Number(nbAccompagnees.n ?? 0),
  };

  interface RecompensePubRow {
    intitule: string;
    detail: string | null;
    rang: number | null;
    transfert_raison: RecompenseTransfertRaison | null;
    beneficiaire_nom: string | null;
    beneficiaire_classement: number | null;
    beneficiaire_public_id: number | null;
    origine_nom: string | null;
  }
  const recRows = recompensesRes.rows as RecompensePubRow[];
  const recompenses: PublicRecompense[] = recRows.map((r) => ({
    intitule: r.intitule,
    detail: r.detail,
    rang: r.rang,
    beneficiaireNom: r.beneficiaire_nom ?? null,
    beneficiaireClassement: r.beneficiaire_classement ?? null,
    transfertRaison: r.transfert_raison ?? null,
    origineNom: r.origine_nom ?? null,
  }));
  // Mention sur la carte de la bénéficiaire (uniquement des inscriptions
  // publiques : l'id ne sert qu'au rapprochement interne, jamais sérialisé).
  const recsParInscription = new Map<number, string[]>();
  for (const r of recRows) {
    if (r.beneficiaire_public_id == null) continue;
    const liste = recsParInscription.get(r.beneficiaire_public_id) ?? [];
    liste.push(r.intitule);
    recsParInscription.set(r.beneficiaire_public_id, liste);
  }

  /** Une ligne de galerie → sa carte publique. Le nom manquant écarte la ligne :
   * une inscription sans nom ni compte relié n'a rien à afficher. */
  const galerie = (rows: unknown[]): PublicFinalist[] =>
    (rows as FinalistRow[])
      .filter((r) => r.nom !== null)
      .map((r) => ({
        nom: r.nom as string,
        role: r.role,
        sujet: r.sujet,
        bio: r.bio,
        linkedin: r.linkedin,
        siteWeb: r.site_web,
        photoUrl: r.photo_url,
        recompenses: recsParInscription.get(r.id) ?? [],
      }));

  const finalistes = galerie(finalistsRes.rows);
  const accompagnees: PublicAccompagnee[] = galerie(accompagneesRes.rows);

  // Les deux phases existent toujours, quitte à être vides. Une accompagnante
  // qui encadre plusieurs séances d'une même phase n'y figure qu'une fois :
  // c'est une liste de personnes, pas de rattachements.
  const accompagnantes = Object.fromEntries(
    PHASES_ATELIER.map((p) => [p, [] as PublicAccompagnante[]]),
  ) as Record<PhaseAtelier, PublicAccompagnante[]>;
  const dejaCreditee = new Set<string>();
  for (const row of accompagnantesRes.rows as AccompagnanteRow[]) {
    const liste = accompagnantes[row.phase];
    // Phase inconnue (valeur hors enum arrivée on ne sait comment) : on passe,
    // plutôt que de créer une clé que personne ne rendra.
    if (!liste || !row.nom) continue;
    const cle = `${row.phase}:${row.user_id}`;
    if (dejaCreditee.has(cle)) continue;
    dejaCreditee.add(cle);
    liste.push({ nom: row.nom, role: row.role, lien: row.lien });
  }

  const palmares: PublicAward[] = (awardsRes.rows as AwardRow[]).map((r) => ({
    recompense: rangLabel(r.classement) ?? "",
    nom: r.public ? r.nom : null,
    sujet: r.public ? r.sujet : null,
  }));

  return {
    nom: edition.nom,
    annee: edition.annee,
    confSlug: edition.confSlug,
    statut: edition.statut,
    description: edition.description,
    confNom: edition.confNom,
    confLieu: edition.confLieu,
    confDate: edition.confDate,
    confLien: edition.confLien,
    finaleDate: edition.finaleDate,
    finaleLieu: edition.finaleLieu,
    inscriptionsDebut: edition.inscriptionsDebut,
    inscriptionsFin: edition.inscriptionsFin,
    counts,
    ateliers: ateliers.map((a) => ({
      titre: a.titre,
      date: a.date,
      dateFin: a.dateFin,
      description: a.description,
      phase: a.phase,
    })),
    finalistes,
    accompagnees,
    accompagnantes,
    palmares,
    recompenses,
    jury,
    photos,
    recit,
  };
}
