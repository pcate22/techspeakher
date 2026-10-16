import { slugify } from "@/lib/slug";
import { foldRecherche } from "@/lib/normalise-recherche";
import {
  REGION_A_DISTANCE,
  REGION_INTERNATIONAL,
  regionDepuisSlug,
  slugRegion,
} from "@/lib/lieu-occurrence";
import type { ScenePublique } from "@/lib/agenda-public";

/**
 * L'ENTRÉE DE L'AGENDA PUBLIC : une recherche, trois facettes, et l'état dans
 * l'URL (lot 1 de `docs/audit-ux-agenda-2026-08.md`).
 *
 * POURQUOI L'URL, ET PAS UN ÉTAT LOCAL (§4.5). Sur l'annuaire, un filtre en
 * mémoire ne coûte rien. Ici, le lien partagé EST le produit : « les dates de la
 * communauté à Lyon » s'envoie dans un message, revient par le bouton retour du
 * téléphone, et c'est la seule façon de faire exister une page « speakeuses en
 * scène à Toulouse ». D'où des lectures côté serveur, sur des valeurs
 * CANONIQUES (slug de registre, slug de région) plutôt que des libellés.
 *
 * QUATRE DÉCISIONS PRODUIT DU 17/08 SONT CÂBLÉES ICI (§8) :
 *   1. **ville ET région**, cherchables indépendamment — deux échelles d'une
 *      même question, dans le vocabulaire de l'annuaire (`REGIONS`), jamais un
 *      second ;
 *   2. **aucune facette « intervenante »** : l'agenda répond à « quand, où, sur
 *      quoi » ; qui, c'est la question de l'annuaire. Le champ de recherche
 *      reste libre de trouver un nom — ne pas en faire une facette n'est pas en
 *      interdire la recherche ;
 *   3. **une date en ligne apparaît dans TOUS les filtres géographiques** en
 *      plus de « À distance » : une visio depuis Toulouse est joignable depuis
 *      Toulouse. Conséquence sur le libellé, et elle n'est pas cosmétique — le
 *      résumé dit « à Toulouse ou en ligne », sans quoi le compte affiché
 *      contredirait le filtre annoncé ;
 *   4. la facette **conférence se bâtit sur le REGISTRE** (`conferenceCle`,
 *      cf. `lib/agenda-conference.ts`), jamais sur le libellé figé : « DevFest »
 *      et « DevFest Toulouse » désignaient le même jour au même endroit en prod.
 *
 * ET UN INVARIANT DE FORME, rendu impossible à violer plutôt que testé : le
 * décompte d'une option de facette est calculé PAR LE FILTRE lui-même
 * (`filtrerScenes`), donc les deux ne peuvent pas diverger. Une facette qui
 * promet 7 et en rend 5 fait cliquer dans le vide.
 */

/** Les quatre dimensions, telles qu'elles voyagent dans l'URL. */
export interface FiltresAgenda {
  /** Recherche libre, vide tant qu'elle est trop courte pour filtrer. */
  q: string;
  /** Slug de ville (`toulouse`), jamais le libellé saisi. */
  ville: string | null;
  /** Slug de région du vocabulaire de l'annuaire (`occitanie`). */
  region: string | null;
  /** Clé de conférence : slug de registre, ou repli `texte:…`. */
  conference: string | null;
}

/**
 * Seuil de la recherche, le même que la loupe du site : en deçà, on ne filtre
 * pas et on ne prétend pas filtrer (sinon la première lettre tapée viderait la
 * page).
 */
const MIN_RECHERCHE = 2;

/**
 * Longueur maximale d'une valeur lue dans l'URL — deux bornes, parce que deux
 * choses différentes se comptent.
 *
 * `q` et un slug de lieu sont de la SAISIE : 80 caractères suffisent, et cette
 * borne existe parce que la valeur est réaffichée dans le résumé (une adresse
 * forgée de dix mille caractères ferait une page absurde).
 *
 * Une clé de conférence, elle, n'est pas de la saisie : c'est une CLÉ, et
 * `cleConference` la fabrique en préfixant `texte:` à un libellé qui peut aller
 * jusqu'à 160 caractères. La tronquer, c'est fabriquer une clé qui n'existe
 * pas — défaut trouvé en revue (18/08) et mesuré : l'option offerte annonçait
 * (1), le clic rendait 0 carte, et une TROISIÈME option apparaissait, étiquetée
 * de la clé coupée. L'invariant « une facette annonce ce qu'elle rend » tombait
 * en un clic, sans URL forgée.
 */
const MAX_SAISIE = 80;
const MAX_CLE_CONFERENCE = 200;

/**
 * Une clé de conférence a DEUX formes légitimes, et rien d'autre : un slug de
 * registre, ou le repli `texte:` suivi du libellé replié (cf.
 * `lib/agenda-conference.ts`). Ce qui n'a aucune de ces deux formes n'est pas
 * une clé : c'est du texte, et le laisser passer le ferait réafficher dans la
 * copie de la page (« aucune intervention annoncée pour … »), sur une adresse
 * qui se partage. Tout ce qui n'est pas reconnu vaut absence, comme partout
 * ailleurs ici.
 */
const CLE_CONFERENCE = /^(?:[a-z0-9-]+|texte:[^A-Z]+)$/;

/** Le slug de « À distance (visio) », calculé une fois depuis le vocabulaire. */
const SLUG_A_DISTANCE = slugRegion(REGION_A_DISTANCE);

/** Première valeur d'un paramètre, bornée — un paramètre répété est tranché,
 *  jamais laissé en tableau (deux villes ne rendraient rien). */
function valeur(v: string | string[] | undefined, max = MAX_SAISIE): string | null {
  const brut = (Array.isArray(v) ? v[0] : v)?.trim();
  return brut ? brut.slice(0, max) : null;
}

/** Lit les filtres d'une URL. Tout ce qui n'est pas reconnu vaut absence. */
export function lireFiltres(
  params: Record<string, string | string[] | undefined>,
): FiltresAgenda {
  const q = valeur(params.q) ?? "";
  const ville = valeur(params.ville);
  const region = valeur(params.region);
  const slugVille = ville ? slugify(ville) : null;
  const slugRegionDemandee = region ? slugify(region) : null;
  return {
    q: q.length >= MIN_RECHERCHE ? q : "",
    // Ville et région se canonisent à la lecture : `?ville=Nîmes` et
    // `?ville=nimes` sont la même vue, donc la même valeur.
    //
    // « À distance » SUBSUME la ville : une visio n'a pas de lieu, donc un
    // filtre de ville n'y change rien. Sans ce retrait, l'écran se
    // contredisait sur 200 px — la commande affichait « Toulouse » et la phrase
    // « en ligne » (relevé en revue d'écran, 18/08, atteignable en deux clics).
    ville: slugRegionDemandee === SLUG_A_DISTANCE ? null : slugVille,
    region: slugRegionDemandee,
    // La clé de conférence est DÉJÀ canonique (slug de registre ou repli
    // `texte:…`) : la re-slugifier casserait son espace de noms. On vérifie donc
    // sa FORME au lieu de la réécrire, et on la borne à sa longueur réelle.
    conference: cleConferenceValide(valeur(params.conference, MAX_CLE_CONFERENCE)),
  };
}

function cleConferenceValide(v: string | null): string | null {
  return v && CLE_CONFERENCE.test(v) ? v : null;
}

/** Un filtre est-il posé ? Sert à choisir ce que le résumé annonce, et à
 *  n'offrir « Tout effacer » que quand il y a quelque chose à effacer. */
export function filtresActifs(f: FiltresAgenda): boolean {
  return Boolean(f.q || f.ville || f.region || f.conference);
}

/**
 * Une intervention qui se suit DE PARTOUT : elle traverse tous les filtres
 * géographiques (décision du 17/08), et c'est elle que « À distance » ramène.
 *
 * Le juge est la région du DTO, jamais l'absence de ville : `regionAffichee`
 * a déjà tranché où ranger l'intervention, et deux définitions de « en ligne »
 * finiraient par diverger — une facette étiquetée « Occitanie » qu'un filtre
 * « À distance » ramènerait quand même.
 */
function estEnLigne(s: ScenePublique): boolean {
  return s.region === REGION_A_DISTANCE;
}

function cleVille(s: ScenePublique): string | null {
  const ville = s.ville?.trim();
  return ville ? slugify(ville) : null;
}

/** La région est toujours renseignée dans le DTO (`regionAffichee`). */
function cleRegion(s: ScenePublique): string {
  return slugRegion(s.region);
}

/** Ce dans quoi une recherche libre fouille : ce que la carte montre, plus le
 *  nom de celle qui porte la date (pas de facette, mais un nom cherchable). */
function corpus(s: ScenePublique): string {
  return foldRecherche(
    [
      s.talkTitre,
      s.conferenceLibelle,
      s.conference,
      s.ville,
      s.region,
      s.pays,
      s.speakeuseNom,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/**
 * La géographie d'une intervention, aux deux échelles à la fois.
 *
 * Une date en ligne passe partout ; une date en salle doit être là où on la
 * cherche. Et « À distance » n'a pas besoin d'un cas à lui : sa région ne vaut
 * que pour les visios, donc la règle générale l'exclut déjà — un `if` de plus
 * aurait été du code que rien ne peut faire tomber (vérifié en le retirant).
 */
function passeGeographie(s: ScenePublique, f: FiltresAgenda): boolean {
  if (estEnLigne(s)) return true;
  if (f.ville && cleVille(s) !== f.ville) return false;
  if (f.region && cleRegion(s) !== f.region) return false;
  return true;
}

/** Les interventions que la visiteuse obtient pour ces filtres, dans l'ordre
 *  reçu (le tri est déjà celui de l'agenda, un filtre ne le rejoue pas). */
export function filtrerScenes(
  scenes: readonly ScenePublique[],
  f: FiltresAgenda,
): ScenePublique[] {
  const recherche = f.q ? foldRecherche(f.q) : "";
  return scenes.filter(
    (s) =>
      (!recherche || corpus(s).includes(recherche)) &&
      passeGeographie(s, f) &&
      (!f.conference || s.conferenceCle === f.conference),
  );
}

/** Une valeur proposée par une facette, et ce qu'elle rend. */
export interface OptionFacette {
  valeur: string;
  libelle: string;
  /** Ce que le filtre rendra, dates en ligne comprises. */
  nombre: number;
}

/** Une facette : ses options, ce que la vue rend SANS elle (l'option neutre),
 *  et si le DOCUMENT offre un choix — deux choses différentes. */
export interface Facette {
  options: OptionFacette[];
  total: number;
  /**
   * Le document entier porte-t-il au moins deux valeurs pour cette dimension ?
   *
   * C'est la PRÉSENCE de la commande, et elle ne se décide pas sur la vue
   * filtrée : sinon taper « devfest » dans la recherche faisait DISPARAÎTRE les
   * trois listes (relevé bloquant de la revue d'écran, 18/08), donc le parcours
   * « je cherche puis j'affine » devenait impossible, et le bouton qu'on venait
   * d'actionner remontait de 230 px sous le doigt. Le DÉCOMPTE, lui, reste
   * celui de la vue : une option ne promet jamais plus qu'elle ne rend.
   */
  offerte: boolean;
}

export interface FacettesAgenda {
  villes: Facette;
  regions: Facette;
  conferences: Facette;
}

/** Les trois dimensions à facette. La recherche libre n'en est pas une : elle
 *  ne propose rien, elle tamise. */
export type Dimension = "ville" | "region" | "conference";

/**
 * CE QU'EST UNE DIMENSION, décrit en UN seul endroit : la clé canonique qu'elle
 * lit dans une intervention, le libellé qu'elle en tire, et le nom qu'elle sait
 * donner à une valeur que la vue ne porte pas.
 *
 * Deux tables parallèles indexées sur la même énumération finissent par
 * diverger (une facette qui compterait sur une clé et s'étiquetterait sur une
 * autre), et un `if (dim === "region")` posé au milieu d'un traitement générique
 * est le même défaut, écrit autrement.
 */
const DIMENSIONS: Record<
  Dimension,
  {
    /** `null` = l'intervention n'entre pas dans cette facette (une visio n'a
     *  pas de ville, une saisie sans conférence n'a pas de clé). */
    cle: (s: ScenePublique) => string | null;
    libelle: (s: ScenePublique) => string | null;
    /**
     * Le nom d'une valeur qu'AUCUNE intervention du document ne porte, à
     * afficher tel quel dans une option comme dans le résumé.
     *
     * Il ne montre jamais d'interne, et c'est un correctif de revue (18/08) :
     * une ville sortait en slug minuscule au milieu d'une phrase française
     * (« à saint-etienne »), et une conférence sortait sa CLÉ, préfixe compris
     * (« pour texte:reunion secrete »). Un préfixe d'implémentation n'a rien à
     * faire à l'écran, et une valeur de conférence est la seule des trois que
     * `slugify` ne borne pas : elle ne se répète donc pas, on la nomme.
     */
    nomDeRepli: (valeur: string) => string;
  }
> = {
  ville: {
    cle: cleVille,
    libelle: (s) => s.ville?.trim() ?? null,
    nomDeRepli: capitaliser,
  },
  region: {
    cle: cleRegion,
    libelle: (s) => s.region,
    // Le vocabulaire d'abord : `?region=corse` un mois sans date en Corse
    // s'annonce quand même « en Corse ».
    nomDeRepli: (v) => regionDepuisSlug(v) ?? capitaliser(v),
  },
  conference: {
    cle: (s) => s.conferenceCle,
    libelle: (s) => s.conferenceLibelle,
    nomDeRepli: () => CONFERENCE_INCONNUE,
  },
};

/**
 * Le nom d'une conférence que le document ne porte pas. On ne répète PAS la
 * valeur : c'est la seule des trois que `slugify` ne borne pas, donc la seule
 * par laquelle un lien forgé pourrait faire dire n'importe quoi à la page.
 * En minuscules parce que la phrase la reprend telle quelle (« pour la
 * conférence demandée ») et qu'un seul libellé vaut mieux que deux.
 */
const CONFERENCE_INCONNUE = "la conférence demandée";

/** Première lettre en capitale, le reste intact : `saint-etienne` devient
 *  « Saint-etienne ». L'accent perdu par `slugify` ne se rattrape pas — mais un
 *  slug minuscule au milieu d'une phrase se remarque bien davantage. */
function capitaliser(valeur: string): string {
  return valeur.charAt(0).toUpperCase() + valeur.slice(1);
}

function facette(
  scenes: readonly ScenePublique[],
  f: FiltresAgenda,
  dim: Dimension,
): Facette {
  // La base d'une facette est la vue filtrée par les AUTRES dimensions : sans
  // ça, une option annoncerait un décompte que le reste des filtres démentira.
  const base = filtrerScenes(scenes, { ...f, [dim]: null });
  const { cle: cleDe, libelle: libelleDe } = DIMENSIONS[dim];
  const libelles = new Map<string, string>();
  for (const s of base) {
    const cle = cleDe(s);
    if (cle && !libelles.has(cle)) libelles.set(cle, libelleDe(s) ?? nommer(dim, cle, scenes));
  }
  // Un filtre actif que la vue ne porte pas (`?ville=lyon`, ou Toulouse quand la
  // région voisine ne laisse que des visios) garde SON option, à son vrai
  // décompte : sinon l'écran afficherait « Toutes les villes » sur une page
  // filtrée, et la commande dirait le contraire de la page (« ne pas dépendre
  // de la mémoire », checklist COGA). Son libellé se cherche sur TOUT le
  // document — cherché sur la vue, « Toulouse » ressortait en « toulouse ».
  const active = f[dim];
  if (active && !libelles.has(active)) {
    libelles.set(active, nommer(dim, active, scenes));
  }
  const options = [...libelles]
    .map(([valeurOption, libelle]) => ({
      valeur: valeurOption,
      libelle,
      // Compté PAR LE FILTRE : c'est ce qui rend le mensonge impossible plutôt
      // que testé. Le volume se compte en dizaines, la boucle est sans enjeu.
      nombre: filtrerScenes(base, { ...f, [dim]: valeurOption }).length,
    }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
  // La PRÉSENCE de la commande se juge sur le document, jamais sur la vue.
  const valeursDuDocument = new Set(
    scenes.map((s) => cleDe(s)).filter((cle): cle is string => cle !== null),
  );
  return { options, total: base.length, offerte: valeursDuDocument.size >= 2 };
}

/** Les trois facettes, chacune comptée sans elle-même et avec les autres. */
export function facettesAgenda(
  scenes: readonly ScenePublique[],
  f: FiltresAgenda,
): FacettesAgenda {
  return {
    villes: facette(scenes, f, "ville"),
    regions: facette(scenes, f, "region"),
    conferences: facette(scenes, f, "conference"),
  };
}

/** Les libellés des filtres actifs — de quoi les NOMMER dans le résumé. */
export interface LibellesFiltres {
  ville: string | null;
  region: string | null;
  conference: string | null;
}

/**
 * Le nom d'une valeur de filtre : celui que porte le DOCUMENT d'abord (c'est la
 * graphie que la visiteuse a vue), le repli de la dimension sinon. Jamais
 * `null` : une page filtrée doit toujours pouvoir dire SUR QUOI elle a filtré.
 */
function nommer(
  dim: Dimension,
  valeur: string,
  scenes: readonly ScenePublique[],
): string {
  const { cle, libelle, nomDeRepli } = DIMENSIONS[dim];
  const porteuse = scenes.find((s) => cle(s) === valeur);
  return (porteuse && libelle(porteuse)) || nomDeRepli(valeur);
}

/** Les libellés des filtres actifs, tels que le résumé les prononcera. */
export function libellesActifs(
  scenes: readonly ScenePublique[],
  f: FiltresAgenda,
): LibellesFiltres {
  const nomActif = (dim: Dimension) => {
    const cherchee = f[dim];
    return cherchee ? nommer(dim, cherchee, scenes) : null;
  };
  return {
    ville: nomActif("ville"),
    region: nomActif("region"),
    conference: nomActif("conference"),
  };
}

/** « en Occitanie », mais « à l'international » : une zone hors France n'est
 *  pas une région administrative, et « en International » ne se dit pas. */
function clauseRegion(region: string): string {
  return region === REGION_INTERNATIONAL ? "à l'international" : `en ${region}`;
}

/**
 * La géographie annoncée, dates en ligne COMPRISES (décision du 17/08) : un
 * résumé qui dit « à Toulouse » alors que le compte inclut les visios ferait
 * mentir le nombre affiché.
 *
 * Quand « À distance » est le filtre, la vue ne porte QUE des visios — même si
 * une ville est aussi demandée : « en ligne » est alors le seul énoncé juste.
 */
function clauseGeographie(f: FiltresAgenda, l: LibellesFiltres): string | null {
  if (f.region === SLUG_A_DISTANCE) return "en ligne";
  const parties: string[] = [];
  if (f.ville && l.ville) parties.push(`à ${l.ville}`);
  if (f.region && l.region) parties.push(clauseRegion(l.region));
  if (parties.length === 0) return null;
  // Les deux échelles se CUMULENT : « à Toulouse ET en Occitanie ». Écrites
  // « à Toulouse, en Occitanie ou en ligne », elles se lisaient comme trois
  // possibilités (revue d'écran du 18/08) — et la virgule devient alors utile
  // pour isoler le « ou », qui est cette fois la vérité : les visios
  // s'AJOUTENT au lieu demandé. Un seul lieu garde la forme tranchée le 17/08.
  return parties.length > 1
    ? `${parties.join(" et ")}, ou en ligne`
    : `${parties[0]} ou en ligne`;
}

/**
 * Le résumé d'une vue filtrée : le fait que la page annonce, suivi de CE SUR
 * QUOI elle a filtré.
 *
 * Nommer le filtre actif est essentiel, et pas seulement pour la politesse :
 * deux filtres qui rendent le même compte donneraient sinon le même texte, donc
 * un DOM inchangé, donc aucune annonce en région vivante (leçon écrite dans
 * `LiveStatus`).
 *
 * `debut` appartient à l'appelant : l'horizon annonce « à ce jour », une année
 * révolue non. Le libellé de la page ne se décide pas dans une lib de filtres.
 */
export function phraseFiltre(
  debut: string,
  f: FiltresAgenda,
  l: LibellesFiltres,
): string {
  const clauses: string[] = [];
  const geo = clauseGeographie(f, l);
  if (geo) clauses.push(geo);
  if (f.conference) clauses.push(`pour ${l.conference ?? CONFERENCE_INCONNUE}`);
  if (f.q) clauses.push(`correspondant à ta recherche « ${f.q} »`);
  return clauses.length > 0 ? `${debut} ${clauses.join(", ")}.` : `${debut}.`;
}

/** Une vue filtrée : ce qu'elle montre, les commandes qui la raffinent, et la
 *  phrase qui l'annonce. */
export interface VueFiltree {
  facettes: FacettesAgenda;
  affichees: ScenePublique[];
  resume: string;
}

/**
 * TOUT CE QU'UNE PAGE D'AGENDA FAIT DE SES FILTRES, en un appel.
 *
 * Les deux surfaces (`/agenda` et `/agenda/[annee]`) posaient la même suite de
 * quatre appels dans le même ordre : celle qui en oublierait un annoncerait un
 * compte qui n'est pas celui de sa liste, ou des facettes qui s'éteignent au
 * premier clic. La suite vit donc ici, une fois.
 *
 * `fait` appartient à l'appelant : l'horizon annonce « à ce jour », une année
 * révolue « en 2025 ». Il reçoit le nombre AFFICHÉ, le seul dont la phrase ait
 * le droit de parler.
 */
export function vueFiltree(
  scenes: readonly ScenePublique[],
  f: FiltresAgenda,
  fait: (nombre: number) => string,
): VueFiltree {
  const affichees = filtrerScenes(scenes, f);
  return {
    // Les facettes se comptent sur TOUT le document, la liste sur ce que les
    // filtres laissent : une facette comptée sur la vue déjà filtrée
    // s'éteindrait au premier clic.
    facettes: facettesAgenda(scenes, f),
    affichees,
    resume: phraseFiltre(fait(affichees.length), f, libellesActifs(scenes, f)),
  };
}

/**
 * L'ADRESSE CANONIQUE d'une vue, à partir de ce qu'on a lu — ou `null` si
 * l'adresse reçue est déjà la bonne.
 *
 * Pourquoi : un formulaire GET soumet TOUS ses champs, donc filtrer sur une
 * ville produisait `?q=&ville=toulouse&region=&conference=`. Or ce lot pose que
 * « le lien partagé est le produit » : ce qu'une visiteuse copie dans un message
 * doit être `?ville=toulouse`. Les pages redirigent donc une fois vers la forme
 * propre, ce qui range du même coup les valeurs non canoniques (`?ville=Nîmes`),
 * les recherches trop courtes et les filtres subsumés.
 *
 * IDEMPOTENT par construction — la sortie de `lireFiltres` est déjà canonique,
 * donc la forme calculée ici ne se recalcule pas autrement la fois suivante.
 * C'est ce qui interdit la boucle de redirection, et un test le fige.
 */
export function adresseCanonique(
  params: Record<string, string | string[] | undefined>,
  f: FiltresAgenda,
): string | null {
  const NOS_CLES = ["q", "ville", "region", "conference"] as const;
  /** Les paramètres qui ne nous appartiennent pas (une campagne, un `utm_`) :
   *  ils suivent, dans l'ordre reçu. Ce n'est pas à nous de les jeter. */
  const autres = (dans: URLSearchParams) => {
    for (const [cle, v] of Object.entries(params)) {
      if ((NOS_CLES as readonly string[]).includes(cle) || v === undefined) continue;
      for (const valeur of Array.isArray(v) ? v : [v]) dans.append(cle, valeur);
    }
  };
  // Ordre FIXE : deux ordres possibles donneraient deux adresses pour une même
  // vue, et une redirection qui les échange tournerait en rond.
  const propre = new URLSearchParams();
  if (f.q) propre.set("q", f.q);
  if (f.ville) propre.set("ville", f.ville);
  if (f.region) propre.set("region", f.region);
  if (f.conference) propre.set("conference", f.conference);
  autres(propre);

  const recue = new URLSearchParams();
  for (const cle of NOS_CLES) {
    const v = params[cle];
    const brut = Array.isArray(v) ? v[0] : v;
    if (brut !== undefined) recue.set(cle, brut);
  }
  autres(recue);
  return recue.toString() === propre.toString() ? null : propre.toString();
}
