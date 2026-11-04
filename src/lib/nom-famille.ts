/**
 * Le nom de famille s'affiche en capitales partout (« Asma TABERKOKT »).
 *
 * Le compte ne porte qu'un nom complet (`users.name`) : la coupe entre prénom
 * et nom est DEVINÉE (tout ce qui suit le premier mot), et la membre la
 * corrige au besoin en désignant son nom de famille (`users.nom_famille`),
 * pour un prénom composé sans trait d'union (« Marie Anne Dupont »).
 *
 * Fonction pure, appliquée au BORD (mapRow des lectures publiques) : la
 * colonne garde le nom tel que saisi, la recherche et le tri le lisent tel quel.
 */

/** Particules qui précèdent un nom sans en faire partie : elles restent en
 * minuscules (« Marie de LA TOUR » — le « La » qui suit appartient au nom). */
const PARTICULES = new Set(["de", "d'", "du", "des", "van", "von", "der", "den", "di", "da", "del", "della", "dos", "das"]);

function mots(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

function enCapitales(motsNom: string[]): string {
  let enTete = true;
  return motsNom
    .map((mot) => {
      if (enTete && PARTICULES.has(mot.toLowerCase())) return mot;
      // « d'Arc » : la particule élidée tient au mot.
      const elision = enTete ? /^(d['’])(.+)$/i.exec(mot) : null;
      enTete = false;
      if (elision) return elision[1] + elision[2].toLocaleUpperCase("fr-FR");
      return mot.toLocaleUpperCase("fr-FR");
    })
    .join(" ");
}

/** Vrai si `nomFamille` désigne des mots ENTIERS qui terminent `nom`, sans en
 * être la totalité (il reste au moins un prénom). Casse ignorée. */
export function nomFamilleValide(nom: string, nomFamille: string): boolean {
  const n = mots(nom).map((m) => m.toLowerCase());
  const f = mots(nomFamille).map((m) => m.toLowerCase());
  if (f.length === 0 || f.length >= n.length) return false;
  return f.every((m, i) => m === n[n.length - f.length + i]);
}

/** Le nom affiché, nom de famille en capitales. Une correction qui ne termine
 * pas le nom (nom changé depuis) est ignorée : l'heuristique reprend la main. */
export function nomEnCapitales(nom: string, nomFamille?: string | null): string {
  const m = mots(nom);
  if (m.length < 2) return m.join(" ");
  const taille =
    nomFamille && nomFamilleValide(nom, nomFamille) ? mots(nomFamille).length : m.length - 1;
  const famille = m.slice(m.length - taille);
  // Rien que des particules : pas de nom à mettre en capitales.
  if (famille.every((mot) => PARTICULES.has(mot.toLowerCase()))) return m.join(" ");
  return [...m.slice(0, m.length - taille), enCapitales(famille)].join(" ");
}

/** Variante pour un nom facultatif (consentement refusé, inscription sans
 * nom) : l'absence reste une absence. */
export function nomPublic(nom: string | null, nomFamille?: string | null): string | null {
  return nom?.trim() ? nomEnCapitales(nom, nomFamille) : null;
}

/** Message quand la saisie ne désigne pas la fin du nom. */
export const NOM_FAMILLE_INVALIDE =
  "Écris la fin de ton nom telle qu'elle figure au-dessus, par exemple « Dupont » pour Marie Anne Dupont.";

/**
 * La saisie du champ « Nom de famille », lue contre le nom complet qu'elle
 * coupe. Vide = `null` (la coupe devinée reprend). Les mots retenus sont ceux
 * du NOM, dans sa casse : la saisie désigne une coupe, elle ne réécrit rien.
 */
export function lireNomFamille(
  nom: string,
  saisie: string,
): { ok: true; valeur: string | null } | { ok: false; erreur: string } {
  if (!saisie.trim()) return { ok: true, valeur: null };
  if (!nomFamilleValide(nom, saisie)) return { ok: false, erreur: NOM_FAMILLE_INVALIDE };
  const m = mots(nom);
  return { ok: true, valeur: m.slice(m.length - mots(saisie).length).join(" ") };
}
