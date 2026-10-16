import { getPublishedAnnuaire, toPublicSpeaker, speakeuseHref } from "@/lib/profiles";
import { getPublicTalkTextByProfile } from "@/lib/talks";
import type { SearchItem } from "@/data/search-index";

/**
 * Items de recherche pour les speakeuses **publiées** (annuaire en base), avec
 * lien vers la fiche `/speakeuses/[id]`. Source dynamique, distincte de l'index
 * statique (pages, actualités, FAQ). L'aperçu affiché (description) reste
 * concis ; `keywords` (non affiché) porte le plein-texte — bio, secteurs,
 * sujets, ville et contenu des talks — pour retrouver une speakeuse par ce
 * qu'elle raconte, pas seulement par son nom. Tout est du contenu déjà public
 * (fiche). Résilient : panne base → liste vide (la recherche statique reste).
 */
export async function getSpeakerSearchItems(): Promise<SearchItem[]> {
  try {
    const [profiles, talkText] = await Promise.all([
      getPublishedAnnuaire(),
      getPublicTalkTextByProfile(),
    ]);
    return profiles.map((p) => {
      const s = toPublicSpeaker(p);
      return {
        title: s.nomAffiche,
        // Zones et langues dans la description : « Occitanie » ou « Anglais »
        // dans la recherche fait remonter les speakeuses concernées.
        description: [s.poste, s.entreprise, ...s.regions, ...s.langues]
          .filter(Boolean)
          .join(" · "),
        url: speakeuseHref(s),
        category: "Speakeuse",
        keywords: [p.bio, p.ville, p.titreProfil, ...p.secteurs, ...p.sujets, talkText.get(p.id)]
          .filter(Boolean)
          .join(" "),
      };
    });
  } catch {
    return [];
  }
}
