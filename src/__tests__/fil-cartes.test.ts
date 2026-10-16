import { describe, it, expect } from "vitest";
import {
  FIL_MAX,
  carteScene,
  carteVenue,
  carteAsso,
  fusionnerFil,
  jourFilFr,
  type CarteFil,
} from "@/lib/fil-cartes";
import type { ScenePublique } from "@/lib/agenda-public";
import type { NouvelleVenue } from "@/lib/fil-communaute";
import type { Contenu } from "@/lib/contenus";
import { NOM_AFFICHE } from "@/data/association";

/**
 * Le fil de l'Accueil (conception v2 §4, lot N2) : un seul flux
 * antichronologique de FAITS incarnés, fusion de trois sources publiques.
 * L'ordre est STABLE (jour desc, puis scène > venue > asso, puis id desc) et
 * le plafond ferme le fil — pas d'archive, « Tu es à jour ✓ ».
 */

const scene = (o: Partial<ScenePublique> = {}): ScenePublique => ({
  occurrenceId: 1,
  date: "2026-08-05",
  conference: "DevFest",
  conferenceCle: "texte:devfest",
  conferenceLibelle: "DevFest",
  ville: "Toulouse",
  region: "Occitanie",
  pays: null,
  lienConf: null,
  talkTitre: "Debugger sans pleurer",
  talkType: "Conférence",
  speakeuseNom: "Léa Marchand",
  speakeuseHref: "/speakeuses/lea",
  profileId: 5,
  image: null,
  ...o,
});

const venue = (o: Partial<NouvelleVenue> = {}): NouvelleVenue => ({
  profileId: 7,
  nom: "Salomé D.",
  href: "/speakeuses/salome",
  titreProfil: "Dev backend",
  image: null,
  date: "2026-08-06",
  ...o,
});

const contenu = (o: Partial<Contenu> = {}): Contenu =>
  ({
    id: 40,
    type: "publication",
    slug: "tremplin-2026",
    titre: "Le Tremplin 2026 est lancé",
    chapo: "Les candidatures sont ouvertes.",
    corps: "x",
    lien: null,
    lienExterne: null,
    lienLabel: null,
    statut: "publie",
    publieLe: "2026-08-04",
    ...o,
  }) as Contenu;

describe("les cartes : un fait, incarné, une seule destination", () => {
  it("carteScene : nom + « sur scène », talk et conférence, vers sa fiche", () => {
    const c = carteScene(scene());
    expect(c.type).toBe("scene");
    expect(c.nom).toBe("Léa Marchand");
    expect(c.fait).toMatch(/sur scène/i);
    expect(c.titre).toContain("Debugger sans pleurer");
    expect(c.detail).toContain("DevFest");
    expect(c.href).toBe("/speakeuses/lea");
    expect(c.date).toBe("2026-08-05");
  });

  it("carteVenue : « a rejoint l'annuaire », le titre du profil en détail", () => {
    const c = carteVenue(venue());
    expect(c.fait).toMatch(/a rejoint l'annuaire/i);
    expect(c.detail).toBe("Dev backend");
    expect(c.href).toBe("/speakeuses/salome");
  });

  it("carteAsso : signée du nom de l'asso (insécable, il ne se coupe pas), mène à la destination du contenu (article = actualité)", () => {
    const c = carteAsso(contenu());
    expect(c?.nom).toBe(NOM_AFFICHE);
    expect(c?.titre).toBe("Le Tremplin 2026 est lancé");
    expect(c?.detail).toBe("Les candidatures sont ouvertes.");
    expect(c?.href).toBe("/articles/tremplin-2026");
    expect(c?.externe).toBe(false);
  });

  it("carteAsso : un article de MEMBRE est incarné — son nom, sa photo, « a publié un article »", () => {
    const c = carteAsso(
      contenu({
        auteurNom: "Nawel B.",
        auteurImage: "https://example.org/nawel.jpg",
      } as never),
    );
    expect(c?.nom).toBe("Nawel B.");
    expect(c?.image).toBe("https://example.org/nawel.jpg");
    expect(c?.fait).toMatch(/a publié un article/i);
    expect(c?.type).toBe("asso");
    // La destination reste celle du contenu : l'article.
    expect(c?.href).toBe("/articles/tremplin-2026");
  });

  it("carteAsso : reporte le visuel de l'article (retour de Cateline — il manquait au fil)", () => {
    const c = carteAsso(contenu({ imageUrl: "https://x.example/visuel.png" } as never));
    expect(c?.visuelUrl).toBe("https://x.example/visuel.png");
  });

  it("une scène et une arrivée n'ont pas de visuel (seule une actualité en porte un)", () => {
    expect(carteScene(scene()).visuelUrl).toBeNull();
    expect(carteVenue(venue()).visuelUrl).toBeNull();
  });

  it("carteAsso : un contenu sans destination ou sans date est écarté (sûreté, le SQL filtre déjà)", () => {
    expect(carteAsso(contenu({ corps: "", lien: null, lienExterne: null }))).toBeNull();
    expect(carteAsso(contenu({ publieLe: null }))).toBeNull();
  });

  it("chaque carte DIT où elle mène (une flèche nue ne le dit pas)", () => {
    expect(carteScene(scene()).hrefLabel).toBe("Voir sa fiche");
    expect(carteVenue(venue()).hrefLabel).toBe("Voir sa fiche");
    expect(carteAsso(contenu())?.hrefLabel).toBe("Lire l'article");
    // Un conseil de speakeuse le DIT (retour de Cateline).
    expect(
      carteAsso(contenu({ categorie: "Conseils de speakeuse" }))?.hrefLabel,
    ).toBe("Lire le conseil");
    // Une annonce-lien (sans corps) garde l'intitulé de sa destination.
    expect(
      carteAsso(contenu({ corps: "", lienExterne: "https://meetup.com/x" }))?.hrefLabel,
    ).toBeTruthy();
  });

  it("chaque carte porte sa propriétaire (lot N4 : jamais de bouton sur SA carte)", () => {
    const s = carteScene(scene({ profileId: 12 } as never));
    expect(s.proprioProfileId).toBe(12);
    expect(s.proprioUserId).toBeNull();
    const v = carteVenue(venue({ profileId: 7 }));
    expect(v.proprioProfileId).toBe(7);
    const a = carteAsso(contenu({ auteurUserId: 33 } as never));
    expect(a?.proprioUserId).toBe(33);
    expect(a?.proprioProfileId).toBeNull();
    // L'actu de l'asso : personne en propre — applaudissable par toutes.
    expect(carteAsso(contenu())?.proprioUserId).toBeNull();
  });

  it("les clés sont uniques toutes sources confondues (même id numérique)", () => {
    const cles = [
      carteScene(scene({ occurrenceId: 5 })).cle,
      carteVenue(venue({ profileId: 5 })).cle,
      carteAsso(contenu({ id: 5 }))!.cle,
    ];
    expect(new Set(cles).size).toBe(3);
  });
});

describe("fusionnerFil : antichronologique, ordre stable, plafonné", () => {
  it("trie par jour décroissant toutes sources confondues", () => {
    const fil = fusionnerFil([
      carteAsso(contenu({ publieLe: "2026-08-04" }))!,
      carteScene(scene({ date: "2026-08-05" })),
      carteVenue(venue({ date: "2026-08-06" })),
    ]);
    expect(fil.map((c) => c.type)).toEqual(["venue", "scene", "asso"]);
  });

  it("à jour égal : scène, puis venue, puis asso — un ordre dit, pas un aléa", () => {
    const jour = "2026-08-05";
    const fil = fusionnerFil([
      carteAsso(contenu({ publieLe: jour }))!,
      carteVenue(venue({ date: jour })),
      carteScene(scene({ date: jour })),
    ]);
    expect(fil.map((c) => c.type)).toEqual(["scene", "venue", "asso"]);
  });

  it("à jour et type égaux : id décroissant (le plus récent d'abord)", () => {
    const fil = fusionnerFil([
      carteScene(scene({ occurrenceId: 2 })),
      carteScene(scene({ occurrenceId: 9 })),
    ]);
    expect(fil.map((c) => c.id)).toEqual([9, 2]);
  });

  it(`ferme le fil à ${FIL_MAX} cartes : pas d'archive, les listes complètes restent publiques`, () => {
    const beaucoup: CarteFil[] = Array.from({ length: FIL_MAX + 10 }, (_, i) =>
      carteScene(scene({ occurrenceId: i })),
    );
    expect(fusionnerFil(beaucoup)).toHaveLength(FIL_MAX);
  });
});

describe("jourFilFr : la date d'une carte, en toutes lettres", () => {
  const AUJOURDHUI = "2026-08-07";
  it("aujourd'hui et hier se disent", () => {
    expect(jourFilFr("2026-08-07", AUJOURDHUI)).toBe("aujourd'hui");
    expect(jourFilFr("2026-08-06", AUJOURDHUI)).toBe("hier");
  });
  it("au-delà, la date longue française", () => {
    expect(jourFilFr("2026-08-01", AUJOURDHUI)).toBe("1er août 2026");
  });
});
