import type { Verbatim, VerbatimRecueilli } from "@/types";
import { jury } from "@/data/tremplin";

/**
 * ┌─ LES VERBATIMS DE LA HOME ──────────────────────────────────────────────┐
 * Ce sont les personnes concernées qui parlent le mieux de ce qu'on fait :
 * la home leur donne la parole avant nos propres arguments.
 *
 * Source : formulaires de satisfaction post-Tremplin (juin 2026), un pour les
 * candidates et participantes au parcours, un pour les jurées.
 *
 * TROIS RÈGLES POUR AJOUTER UNE PAROLE (dans cet ordre) :
 *
 * 1. L'ACCORD D'ABORD. Seul `consentement: "libre"` se publie. Un « oui, mais
 *    validez avec moi avant chaque publication » n'entre PAS ici : la phrase
 *    reste hors du dépôt jusqu'à ce que la personne ait revu le texte exact
 *    (une candidate de 2026 est dans ce cas — sa parole attend son feu vert).
 * 2. L'ATTRIBUTION CONSENTIE, ET RIEN DE PLUS. Le formulaire des jurées disait
 *    « avec votre nom », celui des participantes « avec votre prénom » : on
 *    publie donc le nom complet des unes et le prénom seul des autres.
 * 3. LES MOTS DE LA PERSONNE. On corrige l'orthographe, la typographie et la
 *    ponctuation (ce que ferait n'importe quelle relecture avant impression),
 *    jamais le propos ni le vocabulaire. Chaque écart au texte reçu est noté
 *    en commentaire sous la citation, pour qu'il reste vérifiable.
 *
 * La fonction d'une jurée ne se recopie pas ici : elle vient de `jury`
 * (`src/data/tremplin.ts`), source unique. `src/__tests__/verbatims.test.ts`
 * tient ces règles.
 * └─────────────────────────────────────────────────────────────────────────┘
 */
export const verbatimsRecueillis: VerbatimRecueilli[] = [
  {
    auteur: "Sandrine",
    qualite: "Candidate du Tremplin 2026",
    // Reçu : « C'était vraiment gênait ! » — coquille de dictée pour « génial »,
    // corrigée avec l'accord de l'orga (2026-08-01).
    citation:
      "C'était vraiment génial\u00A0! Merci pour tout\u00A0! Le bon challenge au bon moment pour moi\u00A0!",
    consentement: "libre",
  },
  {
    auteur: "Aurélie Vache",
    qualite: "Jurée du Tremplin 2026",
    // Reçu : « tremplin » (minuscule), « rendez vous », « la qualité et la
    // diversité était », « elles ont tenues bon », suivis d'un emoji 💪.
    citation:
      "J'ai vraiment adoré être jury du premier Tremplin Tech Speak'Her. La qualité et la diversité des pitchs étaient au rendez-vous et malgré le stress elles ont tenu bon.",
    consentement: "libre",
  },
  {
    auteur: "Ophélie",
    qualite: "Participante au parcours 2026",
    citation:
      "Tout le monde était sympa et ultra bienveillant, les ateliers étaient formateurs (souvent trop courts même, on aurait bien gratté des minutes en plus tant on était bien\u00A0!).",
    consentement: "libre",
  },
  {
    auteur: "Magali Germond",
    qualite: "Jurée du Tremplin 2026",
    // Reçu : sans virgule après « projets », et « bravo !! ».
    citation:
      "La preuve que lorsque les femmes osent prendre la parole et défendre leurs projets, le résultat est pertinent, diversifié, original et de grande qualité. Bravo\u00A0!",
    consentement: "libre",
  },
  {
    auteur: "Geraldine",
    qualite: "Candidate du Tremplin 2026",
    // Reçu : « BRAVO ! » en capitales (un lecteur d'écran peut l'épeler).
    citation: "Bravo\u00A0! C'était une expérience super enrichissante personnellement.",
    consentement: "libre",
  },
  {
    auteur: "Céline Chantry-Darmon",
    qualite: "Jurée du Tremplin 2026",
    // Reçu : « la Tech » (capitale), aligné sur la typographie du site.
    citation:
      "Une expérience inspirante qui rappelle qu'en donnant une voix aux femmes de la tech, on enrichit l'innovation et on construit un futur plus inclusif.",
    consentement: "libre",
  },
  {
    auteur: "Morgane",
    qualite: "Candidate du Tremplin 2026",
    // Reçu : « j'aimerai » (futur), et une phrase centrale sur un projet
    // personnel nommé, retirée — la home n'est pas sa vitrine, et la citer sans
    // contexte l'aurait mal servie.
    citation:
      "Une belle révélation pour moi, une communauté naissante à laquelle j'aimerais participer activement\u00A0! De belles rencontres.",
    consentement: "libre",
  },
  {
    auteur: "Sophie Lagarde",
    qualite: "Jurée du Tremplin 2026",
    // Reçu : se terminait sur « Bravo » sans ponctuation.
    citation:
      "Superbes organisation et dynamique de l'événement dans une ambiance bienveillante avec des pitchs bluffants des candidates\u00A0! Bravo\u00A0!",
    consentement: "libre",
  },
];

/**
 * Les paroles PUBLIABLES, dans l'ordre d'affichage : jurées et participantes
 * alternent, pour que le bloc croise les regards au lieu d'aligner huit
 * recommandations du même côté.
 *
 * La fonction affichée sous un nom vient de `jury` : figurer dans le jury EST
 * ce qui donne une fonction à afficher — pas besoin d'un drapeau à maintenir en
 * plus dans la donnée.
 */
export const verbatims: Verbatim[] = verbatimsRecueillis
  .filter((v) => v.consentement === "libre")
  .map(({ consentement: _consentement, ...v }) => {
    const role = jury.find((membre) => membre.name === v.auteur)?.role;
    return role ? { ...v, role } : v;
  });
