/**
 * LA CADENCE DES RAPPELS, choisie par la speakeuse (cf.
 * `docs/conception-cadence-rappels.md`).
 *
 * Ce réglage porte EXACTEMENT les deux e-mails qui poussent :
 *   - le rappel de mise à jour des fiches publiées (cron quotidien) ;
 *   - la relance des brouillons en sommeil (orga).
 *
 * Il ne touche à RIEN d'autre. Un lien de connexion, une décision de
 * modération, un message reçu annoncent un fait et s'arrêtent : on ne coupe
 * jamais ceux-là. Un rappel, lui, revient — c'est ce qui se règle.
 *
 * Brique pure : aucun accès base, aucune connaissance des requêtes.
 */

/** Les quatre choix, du plus fréquent au plus rare. `null` = défaut de l'équipe. */
export const CADENCE_CHOIX = [
  "mensuel",
  "bimestriel",
  "semestriel",
  "aucun",
] as const;

export type CadenceRappel = (typeof CADENCE_CHOIX)[number];

/**
 * Libellé affiché et durée. `jours: null` pour « Aucun » — et pas `0`, qui se
 * lirait « tout le temps », l'exact inverse de ce que la personne a demandé.
 * Ce cas se traite par EXCLUSION dans les requêtes, jamais par un seuil.
 */
export const CADENCES: Record<CadenceRappel, { label: string; jours: number | null }> = {
  mensuel: { label: "Tous les mois", jours: 30 },
  bimestriel: { label: "Tous les 2 mois", jours: 60 },
  semestriel: { label: "Tous les 6 mois", jours: 180 },
  aucun: { label: "Aucun", jours: null },
};

/**
 * Normalise ce qui vient du navigateur. Tout ce qui n'est pas un choix connu
 * vaut `null` = « laisse l'équipe décider » — y compris la chaîne vide, qui est
 * la valeur du bouton radio du défaut, un choix légitime et pas une erreur.
 *
 * `Object.hasOwn` : un `in` accepterait les clés du prototype (`toString`…).
 */
export function cadenceValide(valeur: unknown): CadenceRappel | null {
  if (typeof valeur !== "string") return null;
  return Object.hasOwn(CADENCES, valeur) ? (valeur as CadenceRappel) : null;
}

/**
 * Les instants de seuil passés aux requêtes : « un rappel envoyé AVANT cet
 * instant autorise le suivant ». Un par cadence, plus celui du délai réglé par
 * l'équipe pour qui n'a rien choisi.
 *
 * Calculés ici, en JS, plutôt qu'en SQL (`now() - N * interval '1 day'`) :
 * `pg-mem`, le Postgres en mémoire de nos tests d'intégration, refuse
 * l'arithmétique `integer * interval` — et une protection qu'on ne peut pas
 * faire crier ne protège rien (`docs/principes-tests.md` § 3). Une soustraction
 * de dates dit la même chose et se laisse mesurer.
 *
 * UN seul `Date.now()` pour les quatre instants : le délai de l'équipe sert des
 * deux côtés (seuil de sommeil d'un côté, cadence par défaut de l'autre), et
 * deux horloges lues à une milliseconde d'écart pour une même notion sont une
 * divergence qui attend son bug.
 *
 * `params` fige l'ORDRE attendu par `sqlRappelPermis` ; c'est la fonction, elle,
 * qui numérote les placeholders, pour qu'aucune requête n'ait à se souvenir
 * d'une convention écrite dans un autre fichier.
 *
 * `maintenant` est injectable pour que les tests décrivent un instant précis.
 */
export function seuilsCadence(
  defautJours: number,
  maintenant: number = Date.now(),
): {
  mensuel: Date;
  bimestriel: Date;
  semestriel: Date;
  defaut: Date;
  params: Date[];
} {
  const ilYA = (jours: number) => new Date(maintenant - jours * 86_400_000);
  const mensuel = ilYA(CADENCES.mensuel.jours!);
  const bimestriel = ilYA(CADENCES.bimestriel.jours!);
  const semestriel = ilYA(CADENCES.semestriel.jours!);
  const defaut = ilYA(defautJours);
  return {
    mensuel,
    bimestriel,
    semestriel,
    defaut,
    params: [mensuel, bimestriel, semestriel, defaut],
  };
}

/**
 * Le fragment SQL qui décide si un nouveau rappel est permis pour CETTE ligne.
 *
 * Deux conditions, et la première est la plus importante : « Aucun » exclut,
 * point — sans seuil, sans exception, y compris pour le geste manuel de l'orga.
 * Un réglage qu'on contourne vaut moins que pas de réglage du tout.
 *
 * FONCTION et pas constante : les quatre seuils (`seuilsCadence().params`) se
 * placent où l'appelante veut, à partir de `depart`. Une constante figée en
 * `$1..$4` imposait à quatre requêtes de deux fichiers de se souvenir que leurs
 * propres paramètres commencent à `$5` — une convention non écrite dans le
 * langage, qu'un paramètre ajouté ou déplacé aurait cassée en silence, sans que
 * ni TypeScript ni Postgres n'aient de quoi s'en apercevoir.
 */
export function sqlRappelPermis(depart = 1): string {
  const [mensuel, bimestriel, semestriel, defaut] = [0, 1, 2, 3].map(
    (i) => `$${depart + i}::timestamptz`,
  );
  return `(sp.rappel_cadence IS NULL OR sp.rappel_cadence <> 'aucun')
        AND (sp.last_reminder_at IS NULL
             OR sp.last_reminder_at < CASE sp.rappel_cadence
                  WHEN 'mensuel'    THEN ${mensuel}
                  WHEN 'bimestriel' THEN ${bimestriel}
                  WHEN 'semestriel' THEN ${semestriel}
                  ELSE ${defaut}
                END)`;
}
