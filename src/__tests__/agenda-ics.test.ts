import { describe, it, expect } from "vitest";
import { agendaIcs } from "@/lib/agenda-ics";
import type { ScenePublique } from "@/lib/agenda-public";

/**
 * LE FLUX iCALENDAR DE L'HORIZON (lot 4 de `docs/audit-ux-agenda-2026-08.md`).
 *
 * Ce qui se juge ici n'est PAS « le texte ressemble à du .ics » : un flux mal
 * formé s'affiche quand même dans la moitié des clients et disparaît dans
 * l'autre, sans erreur. Les tests portent donc sur les contraintes que la
 * RFC 5545 impose ET que les implémentations naïves ratent : les fins de ligne
 * CRLF, le pliage à 75 octets, l'échappement des textes, un `UID` STABLE, et un
 * `DTEND` exclusif pour une journée entière.
 *
 * Règle de contenu reprise du JSON-LD, sans la réécrire : seules les dates
 * EXACTES entrent. Un calendrier ne sait pas placer « courant 2026 », et
 * inventer un jour serait publier du faux — c'est la même décision qu'au lot 3.
 */

const scene = (o: Partial<ScenePublique> & { date: string }): ScenePublique => ({
  occurrenceId: 1,
  conference: "DevFest Toulouse",
  conferenceCle: "devfest-toulouse",
  conferenceLibelle: "DevFest Toulouse",
  ville: "Toulouse",
  region: "Occitanie",
  pays: "France",
  lienConf: null,
  talkTitre: "Accessibilité sans excuse",
  talkType: "Conférence",
  speakeuseNom: "Léa Dubois",
  image: null,
  speakeuseHref: "/speakeuses/lea-dubois",
  profileId: 5,
  ...o,
});

const OPTS = { horodatage: "2026-08-21T12:00:00.000Z" };

/** Déplie un flux (RFC 5545 § 3.1) : une ligne suivante commençant par une
 *  espace est la suite de la précédente. C'est ce qu'un client fait AVANT de
 *  lire quoi que ce soit — donc ce que nos assertions doivent faire aussi. */
function deplier(ics: string): string[] {
  const lignes: string[] = [];
  for (const brute of ics.split("\r\n")) {
    if (brute.startsWith(" ") && lignes.length > 0) {
      lignes[lignes.length - 1] += brute.slice(1);
    } else {
      lignes.push(brute);
    }
  }
  return lignes;
}

describe("agendaIcs — l'enveloppe", () => {
  it("un calendrier valide, en CRLF, nommé et attribué", () => {
    const ics = agendaIcs([scene({ date: "2026-11-19" })], OPTS);
    const l = deplier(ics);
    expect(l[0]).toBe("BEGIN:VCALENDAR");
    expect(l).toContain("VERSION:2.0");
    expect(l).toContain("CALSCALE:GREGORIAN");
    expect(l.some((x) => x.startsWith("PRODID:"))).toBe(true);
    // Le nom affiché par les clients qui le lisent : sans lui, l'abonnement
    // s'appelle « agenda.ics » dans la liste des calendriers.
    expect(l.some((x) => x.startsWith("X-WR-CALNAME:"))).toBe(true);
    expect(l[l.length - 2]).toBe("END:VCALENDAR");
  });

  it("des fins de ligne CRLF, jamais LF seul", () => {
    // La RFC l'exige, et c'est le défaut qui casse le plus silencieusement.
    const ics = agendaIcs([scene({ date: "2026-11-19" })], OPTS);
    expect(ics.includes("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("se termine par une fin de ligne", () => {
    expect(agendaIcs([scene({ date: "2026-11-19" })], OPTS).endsWith("\r\n")).toBe(true);
  });

  it("un horizon sans aucune date exacte rend un calendrier VIDE, jamais rien", () => {
    // Un flux auquel on s'est abonné doit rester servable : renvoyer une chaîne
    // vide ou une erreur désabonne les clients, alors que le calendrier
    // reviendra dès la prochaine date annoncée.
    const l = deplier(agendaIcs([scene({ date: "2026" })], OPTS));
    expect(l[0]).toBe("BEGIN:VCALENDAR");
    expect(l.filter((x) => x === "BEGIN:VEVENT")).toHaveLength(0);
  });
});

describe("agendaIcs — ce qui entre, et ce qui reste dehors", () => {
  it("écarte les dates imprécises, garde les exactes", () => {
    const ics = agendaIcs(
      [
        scene({ occurrenceId: 1, date: "2026", talkTitre: "Année vague" }),
        scene({ occurrenceId: 2, date: "2026-11", talkTitre: "Mois vague" }),
        scene({ occurrenceId: 3, date: "2026-11-19", talkTitre: "Exacte" }),
      ],
      OPTS,
    );
    expect(ics).toContain("Exacte");
    expect(ics).not.toContain("Année vague");
    expect(ics).not.toContain("Mois vague");
  });

  it("un évènement porte tout ce qu'un calendrier sait afficher", () => {
    const l = deplier(agendaIcs([scene({ date: "2026-11-19" })], OPTS));
    expect(l).toContain("BEGIN:VEVENT");
    expect(l).toContain("SUMMARY:Accessibilité sans excuse\\, par Léa Dubois");
    expect(l).toContain("LOCATION:Toulouse\\, France");
    expect(l).toContain("DTSTAMP:20260821T120000Z");
    expect(l).toContain("END:VEVENT");
  });

  it("une journée ENTIÈRE, et son DTEND est exclusif", () => {
    // L'heure n'est pas connue (le DTO n'en porte pas). Une journée entière est
    // donc la seule affirmation vraie. Et `DTEND` exclusif : au 20, sinon
    // l'évènement mange deux jours dans tous les clients.
    const l = deplier(agendaIcs([scene({ date: "2026-11-19" })], OPTS));
    expect(l).toContain("DTSTART;VALUE=DATE:20261119");
    expect(l).toContain("DTEND;VALUE=DATE:20261120");
  });

  it("passe un mois et une année (le report de fin de mois n'est pas fait à la main)", () => {
    const dernier = deplier(agendaIcs([scene({ date: "2026-11-30" })], OPTS));
    expect(dernier).toContain("DTEND;VALUE=DATE:20261201");
    const reveillon = deplier(agendaIcs([scene({ date: "2026-12-31" })], OPTS));
    expect(reveillon).toContain("DTEND;VALUE=DATE:20270101");
    // Le 29 février d'une année bissextile : un +1 jour naïf sur le texte donne
    // « 20240230 », une date qui n'existe pas.
    const bissextile = deplier(agendaIcs([scene({ date: "2024-02-29" })], OPTS));
    expect(bissextile).toContain("DTEND;VALUE=DATE:20240301");
  });

  it("l'URL de l'évènement mène au lien de la conférence, sinon à la fiche", () => {
    const avec = deplier(agendaIcs([scene({ date: "2026-11-19", lienConf: "https://devfest.example/talk" })], OPTS));
    expect(avec).toContain("URL:https://devfest.example/talk");
    const sans = deplier(agendaIcs([scene({ date: "2026-11-19" })], OPTS));
    expect(sans.some((x) => x === "URL:https://techspeakher.fr/speakeuses/lea-dubois")).toBe(true);
  });

  it("une date SANS lieu se dit à distance, elle n'invente pas une ville", () => {
    const l = deplier(agendaIcs([scene({ date: "2026-11-19", ville: null, pays: null })], OPTS));
    expect(l).toContain("LOCATION:À distance (visio)");
  });
});

describe("agendaIcs — les pièges de format", () => {
  it("un UID stable, unique, et qui ne dépend PAS du rang dans la liste", () => {
    // Le piège : un UID qui bouge fait ré-apparaître l'évènement comme un
    // nouveau à chaque rafraîchissement, et l'abonnée collectionne les doublons.
    const seule = deplier(agendaIcs([scene({ occurrenceId: 42, date: "2026-11-19" })], OPTS));
    const accompagnee = deplier(
      agendaIcs(
        [
          scene({ occurrenceId: 7, date: "2026-09-01", talkTitre: "Avant" }),
          scene({ occurrenceId: 42, date: "2026-11-19" }),
        ],
        OPTS,
      ),
    );
    const uid = seule.find((x) => x.startsWith("UID:"));
    expect(uid).toBeDefined();
    expect(accompagnee).toContain(uid);
    // Et il change d'une occurrence à l'autre.
    expect(accompagnee.filter((x) => x.startsWith("UID:"))).toHaveLength(2);
    expect(new Set(accompagnee.filter((x) => x.startsWith("UID:"))).size).toBe(2);
  });

  it("échappe ce que la RFC réserve : virgule, point-virgule, antislash, retour", () => {
    const l = deplier(
      agendaIcs(
        [
          scene({
            date: "2026-11-19",
            talkTitre: "Tester, casser; puis \\ recommencer",
            conferenceLibelle: "DevFest\nToulouse",
          }),
        ],
        OPTS,
      ),
    );
    const resume = l.find((x) => x.startsWith("SUMMARY:")) ?? "";
    expect(resume).toContain("Tester\\, casser\\; puis \\\\ recommencer");
    const description = l.find((x) => x.startsWith("DESCRIPTION:")) ?? "";
    expect(description).toContain("DevFest\\nToulouse");
  });

  it("plie les lignes longues à 75 octets, et le dépliage rend le texte INTACT", () => {
    // Le pliage se compte en OCTETS, pas en caractères : un titre d'accents
    // pèse plus que sa longueur. Et il ne doit jamais couper au milieu d'un
    // caractère multi-octets, sinon le client affiche un losange.
    const titre = "Rendre l'accessibilité évidente pour toute équipe pressée, même très pressée, à Toulouse";
    const ics = agendaIcs([scene({ date: "2026-11-19", talkTitre: titre })], OPTS);
    for (const ligne of ics.split("\r\n")) {
      expect(Buffer.byteLength(ligne, "utf8")).toBeLessThanOrEqual(75);
    }
    // La propriété qui compte vraiment : ce qu'un client lit après dépliage est
    // le texte ENTIER, à l'échappement près (les virgules du titre sont
    // échappées, c'est la RFC — ce test juge le PLIAGE, pas l'échappement).
    const resume = deplier(ics).find((x) => x.startsWith("SUMMARY:")) ?? "";
    expect(resume.replace(/\\,/g, ",")).toBe(`SUMMARY:${titre}, par Léa Dubois`);
  });

  it("les scènes sortent dans l'ordre chronologique", () => {
    const l = deplier(
      agendaIcs(
        [
          scene({ occurrenceId: 2, date: "2026-11-19", talkTitre: "Après" }),
          scene({ occurrenceId: 1, date: "2026-09-10", talkTitre: "Avant" }),
        ],
        OPTS,
      ),
    );
    const resumes = l.filter((x) => x.startsWith("SUMMARY:"));
    expect(resumes[0]).toContain("Avant");
    expect(resumes[1]).toContain("Après");
  });
});
