import type { SpeakerProfile } from "@/lib/profiles";

/**
 * LA SAISIE REFUSÉE, remise dans le profil que le formulaire rend.
 *
 * Quand le serveur refuse une section (adresse déjà prise, URL invalide), il
 * renvoie ce qui a été soumis. Sans ce recollage, le formulaire se ré-affichait
 * depuis la BASE : on lisait « Cette adresse est déjà prise, essaies-en une
 * autre » à côté d'un champ qui avait repris l'ancienne adresse, donc sans
 * pouvoir voir ni corriger ce qui venait d'être refusé.
 *
 * Pourquoi ici et pas dans les champs : le formulaire de section compte
 * vingt-quatre `defaultValue`, répartis en cinq sous-composants. Les threader un
 * par un aurait été la même rustine vingt-quatre fois, et le prochain champ
 * ajouté l'aurait oubliée. En fusionnant en amont, chaque champ retrouve la
 * saisie sans rien savoir d'elle.
 *
 * La PORTÉE est celle de la section, exactement comme pour l'écriture : un champ
 * qui n'a pas le droit d'être enregistré depuis cet écran n'a pas le droit d'y
 * revenir non plus.
 */

/** Champs à valeurs multiples : ils portent une liste de cases cochées. */
const LISTES = new Set(["secteurs", "sujets", "regions", "langues"]);

/** Cases à cocher : une case décochée n'envoie RIEN, son absence est la valeur. */
const CASES = new Set(["contactEmailOk", "isWoman", "cfpSuggestionsOk"]);

/** Le nom vit sur le COMPTE (`users.name`), jamais sur la fiche : il traverse le
 * formulaire par sa propre prop et n'a rien à faire dans le profil fusionné. */
const HORS_FICHE = new Set(["nomComplet", "cfpSyncMode"]);

export function appliquerSaisieRefusee(
  profil: SpeakerProfile | null,
  valeurs: Record<string, string[]> | undefined,
  champs: readonly string[],
): SpeakerProfile | null {
  if (!profil || !valeurs) return profil;

  const fusion = { ...profil } as SpeakerProfile & Record<string, unknown>;
  for (const champ of champs) {
    if (HORS_FICHE.has(champ)) continue;
    // Absent de `valeurs` = soumis vide (champ effacé, case décochée, liste
    // entièrement décochée) — c'est une saisie, pas un oubli, donc on la garde.
    const soumis = valeurs[champ] ?? [];
    if (LISTES.has(champ)) fusion[champ] = soumis;
    else if (CASES.has(champ)) fusion[champ] = soumis.length > 0;
    else fusion[champ] = soumis[0] ?? null;
  }
  return fusion;
}
