import { BASE_URL } from "@/constants/site";
import { speakeuseHref, type SpeakerProfile } from "@/lib/profiles";
import { ASSOCIATION } from "@/data/association";

/**
 * Données structurées schema.org `Person` pour une fiche speakeuse PUBLIÉE
 * (retourne `null` sinon : les brouillons / fiches en attente restent noindex).
 *
 * Aide les moteurs à comprendre la speakeuse comme une entité (résultats
 * enrichis sur son nom). Via `homeLocation`, relie la fiche à sa ville pour les
 * recherches locales (« conférencière tech {ville} ») : c'est ce qui permet de
 * capter les requêtes par ville À L'ÉCHELLE DU ROSTER (annuaire national), sans
 * rien coder en dur. La ville est déjà affichée publiquement sur la fiche
 * (« Basée à … ») ; on ne fait que la rendre lisible par les machines.
 */
export function buildSpeakerPersonLd(
  profile: SpeakerProfile,
): Record<string, unknown> | null {
  if (profile.status !== "publie") return null;

  // Le nom calculé au bord : même épellation que l'ItemList de /speakeuses.
  const nom = profile.nomAffiche;

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: nom,
    url: `${BASE_URL}${speakeuseHref(profile)}`,
    jobTitle: profile.poste ?? profile.titreProfil ?? undefined,
    worksFor: profile.entreprise
      ? { "@type": "Organization", name: profile.entreprise }
      : undefined,
    // Ville de résidence → signal local par fiche. Absente si non renseignée.
    homeLocation: profile.ville
      ? {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            addressLocality: profile.ville,
            addressCountry: "FR",
          },
        }
      : undefined,
    image: profile.image ?? undefined,
    description: profile.bio ?? undefined,
    knowsAbout: [...profile.secteurs, ...profile.sujets],
    sameAs: [
      profile.linkedin,
      profile.website,
      profile.instagram,
      profile.sessionizeUrl,
      profile.conferenceHallUrl,
    ].filter(Boolean),
    memberOf: {
      "@type": "Organization",
      name: ASSOCIATION.nom,
      url: BASE_URL,
    },
  };
}
