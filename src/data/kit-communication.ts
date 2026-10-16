import { tailleZip } from "@/lib/zip";

/**
 * Le kit de communication (`/kit-de-communication`) : ce que les partenaires
 * nous demandent pour parler de nous — logos, couleurs, typographies, règles.
 *
 * SOURCES, aucune valeur inventée :
 * - fichiers : copiés tels quels depuis le Drive de l'association
 *   (`03_COMMUNICATION/Identité de marque` et le kit Tremplin), jamais
 *   régénérés ni recompressés ;
 * - couleurs : les tokens de `src/app/globals.css` (le test
 *   `kit-communication-data.test.ts` compare chaque code au token) ;
 * - typographies, zone de protection, taille minimale, règles : la charte de
 *   marque (mai 2026) et `public/brand/tokens.json`.
 *
 * Un format absent reste un EMPLACEMENT VIDE (format sans `fichier`) : la page
 * l'affiche « à venir ». Le jour où le fichier arrive, on le dépose dans
 * `public/kit/` et on renseigne ici son nom, ses dimensions et son poids — le
 * test refuse un fichier déposé sans être annoncé, et l'inverse.
 */

export type FichierKit = {
  format: "PNG" | "SVG";
  /** Ce qui distingue ce format sur la carte (« PNG », « PNG à fond transparent »). */
  libelle: string;
  fichier: string;
  largeur: number;
  hauteur: number;
  octets: number;
};

export type FormatLogo = FichierKit | { format: "PNG" | "SVG"; libelle: string; fichier?: undefined };

export type DeclinaisonLogo = {
  id: string;
  titre: string;
  /** Complément du verbe « Télécharger » : le lien se lit seul, hors de sa carte. */
  objet: string;
  fond: "sombre" | "clair";
  usage: string;
  /** Décrit le FICHIER (forme, couleurs, fond), pas seulement « logo ». */
  alt: string;
  formats: FormatLogo[];
};

export const DOSSIER_KIT = "/kit";
export const NOM_ZIP = "tech-speakher-kit-communication.zip";
export const URL_ZIP = `/kit-de-communication/${NOM_ZIP}`;

const SVG_A_VENIR: FormatLogo = { format: "SVG", libelle: "SVG (vectoriel)" };
const TRANSPARENT_A_VENIR: FormatLogo = { format: "PNG", libelle: "PNG à fond transparent" };

export const declinaisonsLogo: DeclinaisonLogo[] = [
  {
    id: "logo-complet-fond-sombre",
    titre: "Logo complet, fond sombre",
    objet: "le logo complet sur fond sombre",
    fond: "sombre",
    usage: "La version de référence : écrans, réseaux sociaux, présentations, kakémonos.",
    alt: "Logo complet Tech Speak'Her sur fond violet nuit : une bulle de dialogue au tracé néon, du cyan au violet, parcourue de circuits colorés, au-dessus du nom TECH SPEAK'HER en capitales cyan.",
    formats: [
      {
        format: "PNG",
        libelle: "PNG",
        fichier: "tech-speakher-logo-complet-fond-sombre.png",
        largeur: 500,
        hauteur: 500,
        octets: 122_167,
      },
      TRANSPARENT_A_VENIR,
      SVG_A_VENIR,
    ],
  },
  {
    id: "logo-complet-fond-clair",
    titre: "Logo complet, fond clair",
    objet: "le logo complet sur fond clair",
    fond: "clair",
    usage: "Réservée à l'impression, et à elle seule.",
    alt: "Logo complet Tech Speak'Her sur fond blanc : la bulle de dialogue au tracé néon, du cyan au violet, parcourue de circuits colorés, au-dessus du nom TECH SPEAK'HER en capitales violet nuit.",
    formats: [
      {
        format: "PNG",
        libelle: "PNG",
        fichier: "tech-speakher-logo-complet-fond-clair.png",
        largeur: 971,
        hauteur: 480,
        octets: 74_747,
      },
      SVG_A_VENIR,
    ],
  },
  {
    id: "icone-fond-sombre",
    titre: "Icône, fond sombre",
    objet: "l'icône sur fond sombre",
    fond: "sombre",
    usage: "Quand la place manque : avatar, coin d'un visuel, favicon.",
    alt: "Icône Tech Speak'Her sur fond violet nuit : la bulle de dialogue seule, sans le nom, au tracé néon du cyan au violet, parcourue de circuits colorés.",
    formats: [
      {
        format: "PNG",
        libelle: "PNG",
        fichier: "tech-speakher-icone-fond-sombre.png",
        largeur: 500,
        hauteur: 500,
        octets: 117_685,
      },
      TRANSPARENT_A_VENIR,
      SVG_A_VENIR,
    ],
  },
];

/** Les fichiers réellement téléchargeables, dans l'ordre de la page. */
export const fichiersKit: FichierKit[] = declinaisonsLogo.flatMap((d) =>
  d.formats.filter((f): f is FichierKit => f.fichier !== undefined),
);

export type ModeleKit = {
  id: string;
  titre: string;
  /** Complément du verbe « Télécharger », comme pour les logos. */
  objet: string;
  description: string;
  fichier: string;
  octets: number;
  diapositives: number;
};

/**
 * Le modèle de présentation de la charte (Drive, `Identité de marque/
 * TSH_Modele_Presentation.pptx`). Repris tel quel, à une retouche près : le
 * texte alternatif de ses deux logos était un chemin Windows portant le nom
 * complet de l'autrice ; il décrit désormais le logo.
 */
export const modelesKit: ModeleKit[] = [
  {
    // Construite dans Canva (« Présentation Tech Speak'Her ») à partir des
    // diapositives de la finale du Tremplin, exportée en PPTX puis nettoyée :
    // métadonnées XMP/EXIF des images (nom de l'autrice, identifiants Canva)
    // et identifiant du design retirés.
    id: "presentation-tech-speakher",
    titre: "Présentation de Tech Speak'Her",
    objet: "la présentation de Tech Speak'Her",
    description:
      "Neuf diapositives pour nous présenter\u00A0: qui on est, nos réalisations 2025-2026, les interviews, la plateforme, notre charte et comment nous soutenir.",
    fichier: "tech-speakher-presentation.pptx",
    octets: 2_834_107,
    diapositives: 9,
  },
  {
    id: "modele-presentation",
    titre: "Modèle de présentation",
    objet: "le modèle de présentation",
    description:
      "Quatorze diapositives pour bâtir un talk\u00A0: couverture, accroche, sommaire, parties, chiffres, méthode, apprentissages, passage à l'action, ressources, remerciements. Il utilise Montserrat\u00A0: installez-la avant de l'ouvrir.",
    fichier: "tech-speakher-modele-presentation.pptx",
    octets: 513_334,
    diapositives: 14,
  },
];

/** Tout ce que contient l'archive « Télécharger tout le kit ». */
export const fichiersArchive: { fichier: string; octets: number }[] = [
  ...fichiersKit,
  ...modelesKit,
].map((f) => ({ fichier: f.fichier, octets: f.octets }));

/** Poids de l'archive groupée, connu sans la construire. */
export const octetsZip = tailleZip(fichiersArchive.map((f) => ({ nom: f.fichier, octets: f.octets })));

/** « 124 ko », « 1,2 Mo » : unités du SI, virgule décimale, insécable. */
export function poidsLisible(octets: number): string {
  if (octets < 1_000_000) return `${Math.round(octets / 1000)} ko`;
  return `${(octets / 1_000_000).toFixed(1).replace(".", ",")} Mo`;
}

export type CouleurKit = {
  nom: string;
  /** Nom du token dans `globals.css` (`--color-<token>`). */
  token: string;
  hex: string;
  usage: string;
};

export type GroupeCouleurs = { titre: string; couleurs: CouleurKit[] };

/** Usages repris de `public/brand/tokens.json` (theme.dark). */
export const groupesCouleurs: GroupeCouleurs[] = [
  {
    titre: "Fonds",
    couleurs: [
      { nom: "Violet nuit", token: "navy", hex: "#170E47", usage: "Le fond. Il couvre au moins 70 % de la surface." },
      { nom: "Violet carte", token: "navy-light", hex: "#1F1757", usage: "Surface des cartes." },
      { nom: "Violet relief", token: "navy-lighter", hex: "#2A2068", usage: "Survol, surfaces en relief." },
    ],
  },
  {
    titre: "Accents",
    couleurs: [
      { nom: "Cyan", token: "cyan", hex: "#5FECDE", usage: "Surtitres, accent principal, contour des boutons secondaires." },
      { nom: "Magenta", token: "magenta", hex: "#E631FB", usage: "Un à trois mots mis en avant, bouton principal." },
      { nom: "Corail", token: "coral", hex: "#F46F6F", usage: "Accent chaud." },
      { nom: "Pêche", token: "peach", hex: "#F6B17A", usage: "Sous-titres, dates, informations pratiques." },
    ],
  },
  {
    titre: "Neutres",
    couleurs: [
      { nom: "Crème", token: "cream", hex: "#FFF0DC", usage: "Fond des post-it." },
      { nom: "Blanc", token: "white", hex: "#FFFFFF", usage: "Texte principal sur fond sombre." },
      { nom: "Gris lavande", token: "gray-light", hex: "#B8B8D0", usage: "Texte secondaire, légendes." },
    ],
  },
];

export const couleursKit: CouleurKit[] = groupesCouleurs.flatMap((g) => g.couleurs);

/** Charte de marque (mai 2026) et `tokens.json` (font.family). */
export const typosKit = [
  { nom: "Montserrat", usage: "Titres et texte des visuels, présentations et documents." },
  { nom: "Big Shoulders Display", usage: "Titres de programme : Tremplin, Meet Up, Behind the Scenes." },
];

/** Charte de marque (mai 2026), diapositives « Le logo » et « Checklist on-brand ». */
export const reglesLogo = {
  aFaire: [
    "Laisser autour du logo un espace libre au moins égal à la hauteur d'un « T » du nom.",
    "Afficher le logo à 80 px minimum à l'écran, 24 mm à l'impression.",
    "Redimensionner en gardant les proportions d'origine.",
    "Utiliser la version fond sombre partout, la version fond clair uniquement à l'impression.",
  ],
  aEviter: [
    "Étirer, écraser, incliner ou faire pivoter le logo.",
    "Recolorer le logo, en tout ou en partie.",
    "Redessiner le logo, ou retaper le nom dans une autre police.",
  ],
};
