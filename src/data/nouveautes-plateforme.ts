import { YOUTUBE_URL } from "@/constants/site";

/**
 * Les NOUVEAUTÉS annoncées par e-mail à la communauté (campagne d'août 2026).
 *
 * Contenu statique : la source unique de la copie, importée par
 * `src/lib/nouveautes-email.ts`. Relue par `french-spelling.test.ts` comme le
 * reste de `src/data`.
 *
 * Rangées en DEUX blocs, parce que le public l'est aussi : ce qui vit sur le
 * site concerne tout le monde, l'espace de préparation ne parle qu'aux
 * participantes du Tremplin. Sans ce partage, chaque lectrice devrait trier
 * elle-même ce qui la concerne.
 *
 * Une nouveauté = un titre, une phrase, un lien pour aller voir, et parfois une
 * capture d'écran servie par NOTRE domaine (`public/emails/…`) : rien n'est
 * chargé depuis un tiers, donc l'ouverture de l'e-mail ne fuite l'adresse IP de
 * personne vers un service extérieur. `image: null` affiche la nouveauté sans
 * capture (les clients e-mail bloquent souvent les images : le texte se suffit).
 */

/**
 * Clé de la campagne, mémorisée par destinataire dans `email_campagnes` :
 * c'est elle qui rend l'envoi rejouable sans écrire deux fois à la même
 * personne. La prochaine annonce prendra une NOUVELLE clé (et donc une
 * nouvelle liste de nouveautés).
 */
export const CAMPAGNE_NOUVEAUTES = "nouveautes-2026-08";

export interface NouveautePlateforme {
  /** Ce que la personne y gagne, pas le nom technique de la fonctionnalité. */
  titre: string;
  /** Une phrase, deux au maximum : l'e-mail est un aperçu, le site fait le reste. */
  texte: string;
  /** Chemin interne, ou URL absolue pour une destination hors du site. */
  lien: string;
  /** Libellé du lien, à la forme positive. */
  lienLabel: string;
  /** Capture d'écran (chemin sous `public/`), ou null pour une nouveauté sans image. */
  image: string | null;
  /** Alternative textuelle : ce qu'on voit sur la capture (RGAA). Vide sans image. */
  alt: string;
}

export interface BlocNouveautes {
  /** Ce que le bloc rassemble, dit à qui le lit. */
  titre: string;
  /** À qui ça s'adresse, quand ce n'est pas tout le monde. */
  intro: string | null;
  nouveautes: readonly NouveautePlateforme[];
}

export const BLOCS_NOUVEAUTES: readonly BlocNouveautes[] = [
  {
    titre: "Sur le site",
    intro: null,
    nouveautes: [
      {
        titre: "L'agenda des speakeuses",
        texte:
          "Une page publique rassemble les prochaines dates de la communauté, toutes fiches confondues. Tes talks à venir y apparaissent dès que tu les ajoutes.",
        lien: "/agenda",
        lienLabel: "Voir l'agenda",
        image: "/emails/nouveautes-2026-08/agenda.png",
        alt: "L'agenda public : les interventions à venir des speakeuses, groupées par mois, avec la conférence, la date et la ville.",
      },
      {
        titre: "La chaîne YouTube, et les verbatims sur la page d'accueil",
        texte:
          "Le replay de la soirée Tremplin est en ligne sur notre chaîne. Et la page d'accueil affiche les verbatims des participantes et des jurées qui ont donné leur accord, dans leurs propres mots.",
        lien: YOUTUBE_URL,
        lienLabel: "Voir la chaîne",
        image: null,
        alt: "",
      },
      {
        titre: "Ta fiche s'édite section par section",
        texte:
          "Un crayon par section : tu corriges ta bio, tes sujets ou tes liens en restant sur cette seule partie. Et tu vois ta fiche telle que les organisatrices la lisent, au même endroit.",
        // La fiche vit sur /mon-espace/fiche depuis le lot N1 (« Mon
        // profil » a pris l'ancienne adresse) : le lien suit.
        lien: "/mon-espace/fiche",
        lienLabel: "Voir ma fiche",
        image: "/emails/nouveautes-2026-08/ma-fiche.png",
        alt: "La page « Ma fiche » : la fiche telle qu'elle est lue, avec un crayon en tête de chaque section pour la modifier.",
      },
    ],
  },
  {
    titre: "Si tu prépares ta montée sur scène",
    intro:
      "Ces trois-là s'adressent aux participantes du Tremplin, phase montée sur scène.",
    nouveautes: [
      {
        titre: "Ta page de préparation, atelier par atelier",
        texte:
          "Le programme de ton édition s'affiche en clair, et chaque atelier a sa page : sa date, son lieu ou son lien de visio, et ce qu'on y fait.",
        lien: "/mon-espace",
        lienLabel: "Ouvrir mon espace",
        image: "/emails/nouveautes-2026-08/tremplin-programme.png",
        alt: "L'espace Tremplin d'une participante : le programme des ateliers de la montée sur scène, une ligne par séance, avec les dates et les lieux.",
      },
      {
        titre: "Les slides des ateliers, à portée de main",
        texte:
          "Les supports partagés par les coachs se retrouvent au même endroit, atelier par atelier, à côté de tes retours personnels.",
        lien: "/mon-espace/documents",
        lienLabel: "Voir mes documents",
        image: null,
        alt: "",
      },
      {
        titre: "Tes rendez-vous dans ton agenda",
        texte:
          "Tes prochaines séances s'affichent avec tes talks à venir, dans un seul agenda. La prochaine échéance apparaît dès l'entrée de ton espace.",
        lien: "/mon-espace/agenda",
        lienLabel: "Voir mon agenda",
        image: null,
        alt: "",
      },
    ],
  },
];

/** Toutes les nouveautés, tous blocs confondus (compte de l'objet, tests). */
export const NOUVEAUTES_PLATEFORME: readonly NouveautePlateforme[] =
  BLOCS_NOUVEAUTES.flatMap((b) => b.nouveautes);

/**
 * CE QUI ARRIVE — annoncé parce que c'est décidé, jamais parce que c'est
 * probable. Une brève sans lien tant que la page n'existe pas : promettre un
 * clic qui mène à une erreur coûte plus cher que de faire patienter.
 */
export interface AVenir {
  texte: string;
  lien: string | null;
}

export const A_VENIR: readonly AVenir[] = [
  {
    texte:
      "Les interviews Behind the Scenes arrivent en vidéo sur la chaîne. En attendant, elles se lisent dans les actualités.",
    lien: "/actualites",
  },
];

/** Le reste, en une ligne chacun : de quoi aller voir, sans allonger l'e-mail. */
export interface EtAussi {
  texte: string;
  /** Chemin interne, ou URL absolue pour une destination hors du site. */
  lien: string;
}

export const ET_AUSSI: readonly EtAussi[] = [
  {
    texte: "Un talk donné plusieurs fois montre toutes ses scènes, avec le logo de chaque conférence.",
    lien: "/mon-espace/talks",
  },
  {
    texte: "La page d'accueil met en avant les speakeuses qui viennent d'arriver dans l'annuaire.",
    lien: "/",
  },
  {
    texte: "Un index public rassemble les conférences et les associations partenaires.",
    lien: "/conferences",
  },
];
