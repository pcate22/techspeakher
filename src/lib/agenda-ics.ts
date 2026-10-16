import { BASE_URL } from "@/constants/site";
import { ASSOCIATION } from "@/data/association";
import { isExactTalkDate } from "@/lib/talk-date";
import { REGION_A_DISTANCE } from "@/lib/lieu-occurrence";
import type { ScenePublique } from "@/lib/agenda-public";

/**
 * LE FLUX iCALENDAR DE L'AGENDA PUBLIC (lot 4 de
 * `docs/audit-ux-agenda-2026-08.md`) : on s'abonne à des dates, on ne les
 * recopie pas.
 *
 * MÊME RÈGLE DE CONTENU QUE LE JSON-LD, et elle n'est pas réécrite ici : seules
 * les dates EXACTES entrent (`isExactTalkDate`). Un calendrier ne sait pas
 * placer « courant 2026 », et lui donner un jour serait publier du faux — c'est
 * la décision du lot 3, appliquée telle quelle. Une annonce imprécise reste
 * visible sur `/agenda`, qui sait dire « courant 2026 » ; un fichier .ics, non.
 *
 * CE QUE LE FORMAT EXIGE, et que les implémentations naïves ratent — d'où un
 * test par point (`src/__tests__/agenda-ics.test.ts`) :
 * - **CRLF** partout (RFC 5545 § 3.1). Un flux en `\n` s'ouvre dans la moitié
 *   des clients et échoue dans l'autre, sans message ;
 * - **pliage à 75 octets**, jamais au milieu d'un caractère multi-octets : nos
 *   titres sont accentués, donc plus lourds que leur longueur ;
 * - **échappement** de `\`, `;`, `,` et des retours à la ligne dans les textes ;
 * - **`UID` stable** : un identifiant qui bouge fait réapparaître l'évènement
 *   comme un nouveau à chaque rafraîchissement, et l'abonnée collectionne les
 *   doublons. Il vient donc de l'occurrence, jamais du rang dans la liste ;
 * - **`DTEND` exclusif** pour une journée entière : au lendemain, sinon
 *   l'évènement occupe deux jours.
 *
 * L'heure n'y est pas parce que le DTO n'en porte pas : une journée entière est
 * la seule affirmation vraie qu'on puisse faire.
 */

/** Un octet de plus que 75 et un client strict refuse la ligne. */
const LARGEUR = 75;

/**
 * Échappement des valeurs TEXT (RFC 5545 § 3.3.11). L'antislash d'abord, sinon
 * on échapperait les antislashs qu'on vient d'ajouter.
 */
function echapper(valeur: string): string {
  return valeur
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Pliage d'une ligne à 75 OCTETS, la suite préfixée d'une espace. On avance
 * caractère par caractère en comptant les octets : découper sur les octets
 * couperait un caractère accentué en deux, et le client afficherait un losange
 * là où nos titres ont un « é ».
 */
function plier(ligne: string): string[] {
  const morceaux: string[] = [];
  let courant = "";
  let octets = 0;
  for (const caractere of ligne) {
    const poids = Buffer.byteLength(caractere, "utf8");
    // La continuation coûte une espace : on garde une marge d'un octet.
    const plafond = morceaux.length === 0 ? LARGEUR : LARGEUR - 1;
    if (octets + poids > plafond) {
      morceaux.push(courant);
      courant = caractere;
      octets = poids;
    } else {
      courant += caractere;
      octets += poids;
    }
  }
  morceaux.push(courant);
  return morceaux.map((m, i) => (i === 0 ? m : ` ${m}`));
}

/** « 2026-11-19 » → « 20261119 ». */
function jourIcs(date: string): string {
  return date.replace(/-/g, "");
}

/**
 * Le lendemain, calculé par le calendrier et non à la main : un « +1 » sur le
 * texte donne « 20240230 » au 29 février, et « 20261131 » au 30 novembre.
 */
function lendemainIcs(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** « 2026-08-21T12:00:00.000Z » → « 20260821T120000Z ». */
function horodatageIcs(iso: string): string {
  return `${iso.slice(0, 19).replace(/[-:]/g, "")}Z`;
}

/** Où ça se passe, dit comme la carte le dit — ou « à distance » si nulle part. */
function lieu(s: ScenePublique): string {
  const parties = [s.ville, s.pays].filter((p): p is string => Boolean(p));
  return parties.length > 0 ? parties.join(", ") : REGION_A_DISTANCE;
}

/** Ce qu'on ouvre depuis l'évènement : la conférence si elle a un lien, la
 *  fiche de la speakeuse sinon — jamais rien, un évènement sans porte de
 *  sortie oblige à revenir chercher à la main. */
function adresse(s: ScenePublique): string {
  return s.lienConf ?? `${BASE_URL}${s.speakeuseHref}`;
}

function evenement(s: ScenePublique, dtstamp: string): string[] {
  const description = [
    s.conferenceLibelle,
    `Par ${s.speakeuseNom}`,
    `${BASE_URL}${s.speakeuseHref}`,
  ]
    .filter((p): p is string => Boolean(p))
    .join("\n");

  return [
    "BEGIN:VEVENT",
    // Stable, et propre à l'occurrence : c'est ce qui évite les doublons.
    `UID:occurrence-${s.occurrenceId}@techspeakher.fr`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${jourIcs(s.date)}`,
    `DTEND;VALUE=DATE:${lendemainIcs(s.date)}`,
    `SUMMARY:${echapper(`${s.talkTitre}, par ${s.speakeuseNom}`)}`,
    `LOCATION:${echapper(lieu(s))}`,
    `DESCRIPTION:${echapper(description)}`,
    `URL:${adresse(s)}`,
    "END:VEVENT",
  ];
}

/**
 * Le flux complet. `horodatage` est passé par l'appelante (jamais lu de
 * l'horloge ici) : une lib pure se teste sans horloge, et le `DTSTAMP` reste
 * celui du moment où la réponse est construite.
 *
 * Un horizon sans aucune date exacte rend un calendrier **vide mais valide** :
 * renvoyer une erreur désabonnerait des clients d'un flux qui reviendra dès la
 * prochaine annonce.
 */
export function agendaIcs(
  scenes: readonly ScenePublique[],
  { horodatage }: { horodatage: string },
): string {
  const dtstamp = horodatageIcs(horodatage);
  const publiables = scenes
    .filter((s) => isExactTalkDate(s.date))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.occurrenceId - b.occurrenceId);

  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${ASSOCIATION.nom}//Agenda des speakeuses//FR`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${echapper(`Agenda des speakeuses de ${ASSOCIATION.nom}`)}`,
    "X-WR-TIMEZONE:Europe/Paris",
    ...publiables.flatMap((s) => evenement(s, dtstamp)),
    "END:VCALENDAR",
  ];

  return lignes.flatMap(plier).join("\r\n") + "\r\n";
}
