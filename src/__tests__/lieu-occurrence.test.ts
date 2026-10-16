import { describe, it, expect } from "vitest";
import {
  REGION_A_DISTANCE,
  REGION_INTERNATIONAL,
  REGIONS_LIEU,
  REGIONS_OCCURRENCE,
  regionAffichee,
  regionDepuisSlug,
  slugRegion,
  villeAffichee,
} from "@/lib/lieu-occurrence";
import { REGIONS, REGION_TOUTE_LA_FRANCE } from "@/data/domaines";

/**
 * OÙ SE TIENT UNE INTERVENTION — la géographie d'une occurrence, une fois pour
 * toutes (docs/audit-ux-agenda-2026-08.md §4.2).
 *
 * Le constat qui impose ce lot : une FICHE saisit sa commune via la Base
 * Adresse Nationale et stocke `codeInsee` + région dérivée ; une OCCURRENCE
 * stockait un `ville` en texte libre, sans code, sans région. Filtrer l'agenda
 * sur « Toulouse » était possible, sur « Occitanie » non — et taper
 * « Occitanie » n'aurait rien remonté, en silence.
 *
 * La règle tient en trois cas, et elle réutilise le vocabulaire de l'annuaire
 * (`REGIONS`) plutôt que d'en inventer un second : sans ça, les deux pages
 * répondraient différemment à « Occitanie ».
 *
 * SÉPARATION QUI COMPTE : ce qui est STOCKÉ est un fait (la BAN a dit
 * « Occitanie »). Ce qui est CLASSÉ ici est une règle d'affichage — « hors
 * France » et « en visio » n'ont pas de région administrative, on décide
 * comment les ranger. La règle peut changer sans migration.
 */

describe("regionAffichee — trois situations, trois réponses", () => {
  it("ville française reconnue : sa région, telle que la BAN l'a donnée", () => {
    expect(
      regionAffichee({ ville: "Toulouse", region: "Occitanie" }),
    ).toBe("Occitanie");
  });

  it("ville hors France : « International »", () => {
    // Aucun code INSEE, donc aucune région administrative française. Inventer
    // une subdivision belge serait une précision que personne ne cherche.
    expect(regionAffichee({ ville: "Bruxelles", region: null })).toBe(
      REGION_INTERNATIONAL,
    );
  });

  it("aucune ville : « À distance (visio) »", () => {
    expect(regionAffichee({ ville: null, region: null })).toBe(REGION_A_DISTANCE);
    expect(regionAffichee({ ville: "   ", region: null })).toBe(REGION_A_DISTANCE);
  });

  it("les deux catégories de repli existent DANS le vocabulaire de l'annuaire", () => {
    // Le cliquet qui empêche d'inventer un second vocabulaire : si quelqu'un
    // renomme « International » d'un côté, ce test tombe avant que les deux
    // pages ne répondent différemment à la même question.
    expect(REGIONS).toContain(REGION_INTERNATIONAL);
    expect(REGIONS).toContain(REGION_A_DISTANCE);
  });

  it("une date EN SALLE reste en salle, quoi que dise la colonne région", () => {
    // LE défaut trouvé en revue (18/08), et il n'est pas cosmétique : depuis le
    // lot 1 de l'agenda, « À distance » veut dire « traverse TOUS les filtres
    // géographiques ». Une occurrence toulousaine dont la colonne portait
    // « À distance (visio) » — une valeur que `REGIONS` autorisait, postée par un
    // champ caché — se serait affichée sous CHAQUE ville de l'agenda, tout en
    // étant déclarée en présentiel dans les données structurées (qui décident,
    // elles, sur l'absence de ville). C'est la VILLE qui tranche, une fois.
    expect(regionAffichee({ ville: "Toulouse", region: REGION_A_DISTANCE })).toBe(
      REGION_INTERNATIONAL,
    );
    // Et le symétrique, qui est ce que l'ORDRE des cas garantit : sans lieu, on
    // est à distance, même si la colonne porte une vraie région. Une région sans
    // ville est un fantôme — et laisser passer ce cas ferait diverger cette
    // règle de celle des données structurées, qui décident sur l'absence de
    // ville. `estEnLigne` (agenda-filtres) s'appuie sur cette équivalence.
    expect(regionAffichee({ ville: null, region: "Occitanie" })).toBe(
      REGION_A_DISTANCE,
    );
  });

  it("« Toute la France » n'est pas un lieu : c'est une case de l'annuaire", () => {
    // Une zone où une speakeuse se DÉPLACE, jamais un endroit où une date se
    // tient. Sans ce cas, la facette proposait « en Toute la France ».
    expect(
      regionAffichee({ ville: "Toulouse", region: REGION_TOUTE_LA_FRANCE }),
    ).toBe(REGION_INTERNATIONAL);
    expect(regionDepuisSlug(slugRegion(REGION_TOUTE_LA_FRANCE))).toBeNull();
    expect(REGIONS_LIEU).not.toContain(REGION_TOUTE_LA_FRANCE);
    expect(REGIONS_OCCURRENCE).not.toContain(REGION_TOUTE_LA_FRANCE);
  });

  it("un slug de lieu se relit sans ambiguïté", () => {
    // `slugRegion` est l'aller, `regionDepuisSlug` le retour : deux régions qui
    // se replieraient sur le même slug (« Grand Est » et un futur
    // « Grand-Est ») feraient silencieusement filtrer sur l'autre.
    const slugs = REGIONS_LIEU.map(slugRegion);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const region of REGIONS_LIEU) {
      expect(regionDepuisSlug(slugRegion(region))).toBe(region);
    }
  });

  it("une région stockée hors du vocabulaire est ignorée", () => {
    // La BAN peut évoluer, une saisie ancienne peut porter n'importe quoi. Une
    // facette ne doit jamais afficher une région que l'annuaire ne connaît pas.
    expect(regionAffichee({ ville: "Genève", region: "Canton de Genève" })).toBe(
      REGION_INTERNATIONAL,
    );
  });
});

describe("villeAffichee — ce qu'on montre quand il n'y a pas de ville", () => {
  it("rend la ville telle qu'elle a été saisie", () => {
    expect(villeAffichee("Toulouse")).toBe("Toulouse");
  });

  it("sans ville, dit « En ligne » plutôt que de laisser un trou", () => {
    // Forme POSITIVE : on dit ce qui EST. « Lieu non renseigné » dirait ce qui
    // manque, et laisserait croire à un oubli de la speakeuse.
    expect(villeAffichee(null)).toBe("En ligne");
    expect(villeAffichee("  ")).toBe("En ligne");
  });
});
