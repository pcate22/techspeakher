import { foldRecherche } from "@/lib/normalise-recherche";

/**
 * Filtre du choix de conférence (combobox du formulaire d'occurrence) : avec
 * 126 conférences au répertoire, dérouler la liste ne suffit plus — on tape,
 * et chaque mot de la recherche est cherché indifféremment dans le NOM, la
 * VILLE et le PAYS (accents et casse repliés par `foldRecherche`). « Belgique »
 * fait remonter Devoxx Belgium, « Lille » Cloud Nord.
 *
 * Pur et déterministe : une correspondance en sous-chaîne, pas de flou — sur
 * un répertoire court, le flou (Fuse) ferait surtout remonter des surprises.
 */

export interface ConferenceCherchable {
  nom: string;
  ville: string | null;
  pays: string | null;
}

/** Rang d'un résultat : ce que la lectrice cherche le plus souvent d'abord. */
const NOM_EN_PREFIXE = 0;
const NOM_CONTIENT = 1;
const LIEU_SEUL = 2;

/**
 * Les conférences dont nom, ville ou pays contiennent CHAQUE mot de la
 * recherche, les correspondances de nom d'abord (préfixe, puis contenu, puis
 * lieu seul) ; à rang égal l'ordre d'entrée est préservé (tri stable —
 * le répertoire arrive trié alphabétiquement). Recherche vide : tout, tel quel.
 */
export function filtrerConferences<T extends ConferenceCherchable>(
  conferences: T[],
  recherche: string,
): T[] {
  const pliee = foldRecherche(recherche).trim();
  if (pliee === "") return [...conferences];
  const mots = pliee.split(" ").filter(Boolean);

  const retenues: Array<{ conf: T; rang: number }> = [];
  for (const conf of conferences) {
    const nom = foldRecherche(conf.nom);
    const lieu = foldRecherche([conf.ville ?? "", conf.pays ?? ""].join(" "));
    if (!mots.every((m) => nom.includes(m) || lieu.includes(m))) continue;
    const rang = nom.startsWith(pliee)
      ? NOM_EN_PREFIXE
      : mots.some((m) => nom.includes(m))
        ? NOM_CONTIENT
        : LIEU_SEUL;
    retenues.push({ conf, rang });
  }
  // `sort` est stable (garanti depuis ES2019) : l'ordre alphabétique survit au
  // rang. Surtout PAS `toSorted` : ES2023, absent de Safari 15 et des WebView
  // Android d'âge moyen — ce code tourne chez la cliente, sans polyfill Next.
  return retenues.sort((a, b) => a.rang - b.rang).map((r) => r.conf);
}
