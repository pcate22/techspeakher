import { describe, it, expect } from "vitest";
import { agendaItemList } from "@/lib/agenda-jsonld";
import type { ScenePublique } from "@/lib/agenda-public";

/**
 * LES DONNÉES STRUCTURÉES DE L'AGENDA — §4.4 de
 * `docs/audit-ux-agenda-2026-08.md`.
 *
 * Mesuré avant ce lot : la page ne servait QU'UN bloc `application/ld+json`, de
 * type `NGO`, hérité du gabarit. Aucun `ItemList`, aucun `Event` — sur une page
 * dont le contenu EST une liste d'événements datés et localisés, le cas d'école
 * de `schema.org/Event`. La page sœur `/speakeuses` publiait déjà son
 * `CollectionPage` complet.
 *
 * Deux exigences se croisent ici, et la seconde prime :
 *   • être repris par les moteurs (donc des `Event` valides et complets) ;
 *   • ne JAMAIS publier plus que ce que la page affiche déjà. Un `performer`
 *     est une personne : l'agenda ne nomme que des fiches PUBLIÉES, et cette
 *     propriété doit tenir jusque dans le balisage.
 */

const scene = (o: Partial<ScenePublique> = {}): ScenePublique => ({
  occurrenceId: 1,
  date: "2026-11-19",
  conference: "DevFest Toulouse",
  conferenceCle: "devfest-toulouse",
  conferenceLibelle: "DevFest Toulouse",
  ville: "Toulouse",
  region: "Occitanie",
  pays: "France",
  lienConf: "https://devfest.example.org",
  talkTitre: "Accessibilité sans excuse",
  talkType: "Conférence",
  speakeuseNom: "Léa Dubois",
  speakeuseHref: "/speakeuses/lea-dubois",
  profileId: 5,
  image: null,
  ...o,
});

const BASE = "https://techspeakher.fr";

describe("agendaItemList — ce que les moteurs peuvent reprendre", () => {
  it("décrit chaque intervention comme un Event, dans l'ordre de la page", () => {
    const ld = agendaItemList({
      scenes: [
        scene({ occurrenceId: 1, talkTitre: "Premier" }),
        scene({ occurrenceId: 2, talkTitre: "Second", date: "2026-12-01" }),
      ],
      url: `${BASE}/agenda`,
      nom: "Agenda des speakeuses",
    });

    expect(ld?.["@type"]).toBe("CollectionPage");
    const liste = ld?.mainEntity as { itemListElement: Array<Record<string, unknown>> };
    expect(liste.itemListElement).toHaveLength(2);
    const premier = liste.itemListElement[0] as Record<string, unknown>;
    expect(premier.position).toBe(1);
    const evt = premier.item as Record<string, unknown>;
    expect(evt["@type"]).toBe("Event");
    expect(evt.name).toBe("Premier");
    expect(evt.startDate).toBe("2026-11-19");
  });

  it("nomme la speakeuse comme INTERPRÈTE, et pointe vers sa fiche", () => {
    // C'est la valeur de ce balisage : relier une intervention à la personne
    // qui la porte. C'est aussi ce qui demande le plus de soin (voir plus bas).
    const [{ item }] = extraire(agendaItemList({ scenes: [scene()], url: BASE, nom: "x" }));
    const performer = item.performer as Record<string, unknown>;
    expect(performer["@type"]).toBe("Person");
    expect(performer.name).toBe("Léa Dubois");
    expect(performer.url).toBe(`${BASE}/speakeuses/lea-dubois`);
  });

  it("attribue la conférence hôte comme ORGANISATRICE, sous son nom de registre", () => {
    // Le libellé figé diverge (« DevFest » vs « DevFest Toulouse ») : publier
    // celui-là donnerait deux organisateurs pour un même événement.
    const [{ item }] = extraire(
      agendaItemList({
        scenes: [scene({ conference: "DevFest", conferenceLibelle: "DevFest Toulouse" })],
        url: BASE,
        nom: "x",
      }),
    );
    expect((item.organizer as Record<string, unknown>).name).toBe("DevFest Toulouse");
  });

  it("situe l'événement par sa ville et son pays", () => {
    const [{ item }] = extraire(agendaItemList({ scenes: [scene()], url: BASE, nom: "x" }));
    const lieu = item.location as Record<string, unknown>;
    expect(lieu["@type"]).toBe("Place");
    const adresse = lieu.address as Record<string, unknown>;
    expect(adresse.addressLocality).toBe("Toulouse");
    expect(adresse.addressCountry).toBe("France");
  });

  it("sans ville, l'événement est déclaré EN LIGNE plutôt que situé nulle part", () => {
    // Une occurrence sans lieu est en visio. Lui inventer une adresse serait
    // faux ; la laisser sans rien la rendrait inexploitable.
    const [{ item }] = extraire(
      agendaItemList({
        scenes: [scene({ ville: null, pays: null })],
        url: BASE,
        nom: "x",
      }),
    );
    expect(item.eventAttendanceMode).toBe("https://schema.org/OnlineEventAttendanceMode");
    expect((item.location as Record<string, unknown>)["@type"]).toBe("VirtualLocation");
  });

  it("ÉCARTE les annonces imprécises : une date approximative n'est pas un événement", () => {
    // « courant 2026 » et « novembre 2026 » sont honnêtes à l'écran, mais un
    // moteur qui les reprendrait afficherait une date inventée. On préfère
    // publier moins que publier faux.
    const ld = agendaItemList({
      scenes: [
        scene({ occurrenceId: 1, date: "2026" }),
        scene({ occurrenceId: 2, date: "2026-11" }),
        scene({ occurrenceId: 3, date: "2026-11-19", talkTitre: "Exacte" }),
      ],
      url: BASE,
      nom: "x",
    });
    const items = extraire(ld);
    expect(items).toHaveLength(1);
    expect(items[0].item.name).toBe("Exacte");
  });

  it("aucune intervention exacte : AUCUN bloc, plutôt qu'une liste vide", () => {
    // Une `ItemList` vide est du bruit pour un moteur, et un mensonge poli.
    expect(agendaItemList({ scenes: [scene({ date: "2026" })], url: BASE, nom: "x" })).toBeNull();
  });

  it("ne publie que ce que la page affiche : aucun champ interne ne fuit", () => {
    // Le DTO porte `profileId` et `occurrenceId`, utiles au rendu. Rien de tout
    // ça n'a à partir vers les moteurs.
    const ld = agendaItemList({ scenes: [scene()], url: BASE, nom: "x" });
    const brut = JSON.stringify(ld);
    expect(brut).not.toContain("profileId");
    expect(brut).not.toContain("occurrenceId");
    expect(brut).not.toContain("conferenceCle");
  });
});

/** Raccourci de lecture : les `Event` d'une liste. */
function extraire(
  ld: ReturnType<typeof agendaItemList>,
): Array<{ item: Record<string, unknown> }> {
  const liste = ld?.mainEntity as { itemListElement: Array<{ item: Record<string, unknown> }> };
  return liste.itemListElement;
}
