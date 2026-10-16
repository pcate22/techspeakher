import type { ScenePublique } from "@/lib/agenda-public";
import { isExactTalkDate } from "@/lib/talk-date";
import { ASSOCIATION } from "@/data/association";
import { BASE_URL } from "@/constants/site";

/**
 * DONNÉES STRUCTURÉES DE L'AGENDA — le contenu de la page, dit aux moteurs.
 *
 * Mesuré avant ce lot (§4.4 de `docs/audit-ux-agenda-2026-08.md`) : l'agenda ne
 * servait qu'un bloc `NGO` hérité du gabarit, alors que son contenu EST une
 * liste d'événements datés et localisés. `/speakeuses`, elle, publiait déjà son
 * `CollectionPage`.
 *
 * DEUX RÈGLES, et la seconde prime sur la première.
 *
 * 1. **Publier ce qui est vrai, ou rien.** Une annonce imprécise (« courant
 *    2026 », « novembre 2026 ») est honnête à l'écran, où le libellé dit
 *    l'approximation. Reprise par un moteur, elle deviendrait une date ferme
 *    inventée. Ces scènes restent donc hors du balisage : mieux vaut publier
 *    moins que publier faux.
 *
 * 2. **Ne jamais publier plus que la page.** Un `performer` est une PERSONNE.
 *    L'agenda ne nomme que des fiches publiées (garanti par le `WHERE` partagé
 *    de `scenesVisiblesWhere`, et figé par un test d'intégration à cas
 *    négatifs) ; cette propriété doit tenir jusque dans le balisage, qui est
 *    lu par des machines et recopié ailleurs. On ne sérialise donc QUE des
 *    champs déjà affichés — jamais un identifiant interne.
 *
 * Cadrage Ad Grants (`docs/google-ad-grants.md`) : on décrit l'ACTIVITÉ de
 * l'association — ses membres montent sur scène chez des tiers. Le `performer`
 * est une membre, l'`organizer` la conférence hôte. Rien n'y décrit une offre
 * de prestation.
 */

/** Une entrée de liste structurée, telle que schema.org l'attend. */
interface ElementListe {
  "@type": "ListItem";
  position: number;
  item: Record<string, unknown>;
}

/** Le bloc `CollectionPage` d'une surface d'agenda, ou `null` s'il serait vide. */
export interface AgendaLd {
  "@context": string;
  "@type": "CollectionPage";
  name: string;
  url: string;
  inLanguage: string;
  isPartOf: Record<string, unknown>;
  mainEntity: Record<string, unknown>;
}

function evenement(s: ScenePublique): Record<string, unknown> {
  const enLigne = !s.ville;
  return {
    "@type": "Event",
    name: s.talkTitre,
    startDate: s.date,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: enLigne
      ? "https://schema.org/OnlineEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode",
    location: enLigne
      ? { "@type": "VirtualLocation", url: s.lienConf ?? BASE_URL }
      : {
          "@type": "Place",
          name: s.conferenceLibelle ?? s.ville,
          address: {
            "@type": "PostalAddress",
            addressLocality: s.ville,
            ...(s.pays ? { addressCountry: s.pays } : {}),
          },
        },
    // La personne qui porte l'intervention, et sa fiche. C'est la valeur de ce
    // balisage : relier une date à quelqu'un.
    performer: {
      "@type": "Person",
      name: s.speakeuseNom,
      url: `${BASE_URL}${s.speakeuseHref}`,
    },
    // Sous le nom du REGISTRE : le libellé figé diverge d'une saisie à l'autre
    // (« DevFest » / « DevFest Toulouse »), ce qui donnerait deux organisateurs
    // pour un même événement.
    ...(s.conferenceLibelle
      ? { organizer: { "@type": "Organization", name: s.conferenceLibelle } }
      : {}),
    ...(s.lienConf ? { url: s.lienConf } : {}),
  };
}

/**
 * Le `CollectionPage` d'une surface d'agenda (l'horizon ou une année), ou
 * `null` quand aucune scène n'est assez précise pour être publiée — une
 * `ItemList` vide est du bruit pour un moteur, et un mensonge poli.
 */
export function agendaItemList({
  scenes,
  url,
  nom,
}: {
  scenes: readonly ScenePublique[];
  url: string;
  nom: string;
}): AgendaLd | null {
  const publiables = scenes.filter((s) => isExactTalkDate(s.date));
  if (publiables.length === 0) return null;

  const itemListElement: ElementListe[] = publiables.map((s, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: evenement(s),
  }));

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: nom,
    url,
    inLanguage: "fr-FR",
    isPartOf: { "@type": "WebSite", name: ASSOCIATION.nom, url: BASE_URL },
    mainEntity: { "@type": "ItemList", itemListElement },
  };
}
