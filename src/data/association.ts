/**
 * Identité juridique de Tech Speak'Her, source unique.
 *
 * Ces valeurs sont recopiées mot pour mot des statuts et du procès-verbal de
 * l'assemblée générale constitutive du 13 juin 2026. Elles vivent ici, et non
 * dans les pages, parce qu'un organisme qui instruit un dossier (Google pour
 * les associations, une subvention) les compare à celles de son dossier : deux
 * copies dans deux pages, c'est deux vérités possibles à la prochaine AG
 * modificative. Contexte : docs/google-ad-grants.md.
 *
 * Attention aux deux dates, qui ne désignent pas la même chose : l'assemblée
 * constitutive s'est tenue le 13 juin 2026, la déclaration en préfecture (celle
 * qui porte le numéro RNA) le 23 juin 2026.
 */
export const ASSOCIATION = {
  nom: "Tech Speak'Her",
  formeJuridique: "association loi du 1er juillet 1901",
  butNonLucratif: true,
  /** Déclaration en préfecture, la date qui accompagne le numéro RNA. */
  dateDeclaration: "23 juin 2026",
  /** Assemblée générale constitutive (statuts, PV). */
  dateConstitution: "13 juin 2026",
  rna: "W313042349",
  siren: "108095993",
  siret: "10809599300011",
  siege: {
    voie: "136 chemin de Lanusse",
    codePostal: "31200",
    commune: "Toulouse",
    pays: "France",
    departement: "Haute-Garonne",
  },
  /** Objet social, article 5 des statuts. À citer sans le reformuler. */
  objet:
    "Promouvoir la prise de parole publique et la représentativité des femmes dans les événements et métiers du numérique, soutenir leur développement professionnel et leur visibilité, organiser ou contribuer à toute action favorisant l'égalité dans le secteur tech.",
  /** Gouvernance collégiale : ni présidente, ni secrétaire, ni trésorière. */
  collegeDirigeant: 5,
  /**
   * Directrice de la publication, co-représentante légale (statuts adoptés par
   * l'AGE du 29 septembre 2026). Texte « mentions légales » du 13 octobre 2026.
   */
  directricePublication: "Cateline Puccetti",
  /** Désignation de la déléguée à la protection des données auprès de la CNIL. */
  dpoCnil: "DPO-176240",
} as const;

/**
 * Immatriculation mise en forme comme l'usage français l'écrit : le SIREN par
 * tranches de trois, le SIRET en SIREN + NIC de cinq chiffres. Un groupement
 * naïf par trois découperait le SIRET en « 108 095 993 000 11 », qui ne
 * correspond à aucune convention.
 *
 * Les pages affichent cette forme, le JSON-LD garde la forme canonique
 * (`ASSOCIATION.siren`) pour qu'un outil la retrouve telle quelle.
 */
export function formaterImmatriculation(numero: string): string {
  const siren = numero.slice(0, 9).replace(/\d{3}(?=\d)/g, "$& ");
  const nic = numero.slice(9);
  return nic ? `${siren} ${nic}` : siren;
}

/** Siège sur une ligne, pour la prose. */
export const SIEGE_UNE_LIGNE = `${ASSOCIATION.siege.voie}, ${ASSOCIATION.siege.codePostal} ${ASSOCIATION.siege.commune}`;

/**
 * LE NOM TEL QU'ON L'AFFICHE. `ASSOCIATION.nom` est la graphie des STATUTS,
 * et c'est elle qu'un organisme instructeur compare à son dossier : elle reste
 * en espace ordinaire, intouchable.
 *
 * La mise en page, elle, a besoin d'une insécable pour que le nom ne se coupe
 * pas en fin de ligne. Une DÉRIVATION, donc, jamais une seconde copie : les deux
 * chaînes ne peuvent pas diverger à la prochaine AG modificative.
 *
 * CE QU'ELLE NE REMPLACE PAS. Le nom apparaît dans ~180 phrases du site, et il y
 * reste écrit en toutes lettres : « ce que fait {NOM_AFFICHE} » se relit moins
 * bien que la phrase elle-même, et une prose truffée d'interpolations se corrige
 * mal. Cette constante sert là où le nom est CITÉ comme identité — la mention
 * légale, l'encadré « qui sommes-nous » — et les données structurées (JSON-LD)
 * s'appuient sur `ASSOCIATION.nom` pour la même raison.
 *
 * Ce qui tient la typographie des ~180 autres n'est donc pas une constante mais
 * un garde-fou : `e2e/mots-colles.spec.ts` relit le nom SERVI sur chaque page
 * publique et refuse toute espace sécable entre « Tech » et « Speak'Her ». Il
 * attrape ce qu'une constante ne verrait pas — un retour à la ligne en JSX, une
 * ligne venue de la base — et n'oblige personne à écrire son texte en code.
 */
// Caractère pour caractère, et TOUTES les espaces : `replace` d'une chaîne ne
// prendrait que la première, et `\\s+` écraserait une suite d'espaces — le nom
// affiché différerait alors de celui des statuts, que la dérivation existe
// justement pour suivre.
export const NOM_AFFICHE = ASSOCIATION.nom.replace(/[ \t]/g, "\u00A0");

/**
 * LE NOM DANS LE TEXTE DE QUELQU'UN D'AUTRE.
 *
 * Le dépôt écrit son propre nom avec une insécable ; les membres, elles, tapent
 * au clavier. Une speakeuse qui renseigne où elle a donné son talk écrit
 * « Meetup Tech Speak'Her » avec une espace ordinaire, et cette phrase s'affiche
 * telle quelle sur `/agenda` : le nom s'y coupe en fin de ligne, exactement le
 * défaut corrigé partout ailleurs.
 *
 * LE REPLI SE FAIT À L'AFFICHAGE. Une insécable est une décision de mise en
 * page, pas une correction du texte de quelqu'un : ce qu'une membre a saisi lui
 * appartient, et le jour où elle relit sa saisie elle doit y retrouver ce
 * qu'elle a tapé. En prime, la règle vaut tout de suite pour les lignes déjà en
 * base, sans migration.
 *
 * Une exception, et une seule : la migration 062 a normalisé les contenus
 * éditoriaux (`contenus`) une fois, pour rattraper des textes écrits AVANT que
 * cette règle existe. C'était un rattrapage borné, pas une politique — rien
 * n'est réécrit en base depuis.
 *
 * CE QU'ON RECONNAÎT. La même définition que le garde-fou `e2e/mots-colles` :
 * toute suite de blancs SÉCABLES entre les deux mots, quelle que soit la casse
 * et quelle que soit l'apostrophe. Sans cela, une saisie à deux espaces ferait
 * rougir la CI sans que ce repli sache la corriger — la garde et le correctif
 * se doivent de parler du même défaut.
 *
 * Seuls ces blancs-là changent : la casse, l'apostrophe et le reste de la
 * phrase sortent tels qu'ils sont entrés.
 */
// Un blanc où le navigateur PEUT couper : tout sauf ceux qui l'interdisent
// (insécable, fine insécable, espace chiffre, liant sans chasse).
export const BLANC_SECABLE = "[^\\S\\u00A0\\u202F\\u2007\\uFEFF]+";

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Le nom des statuts, en motif tolérant : blancs sécables et apostrophes. */
const NOM_MOTIF = new RegExp(
  ASSOCIATION.nom
    .split(/\s+/)
    .map((mot) => mot.split(/['\u2019]/).map(echapper).join("['\\u2019\\u02BC]"))
    .join(BLANC_SECABLE),
  "gi",
);

const BLANCS = new RegExp(BLANC_SECABLE, "g");

export function nomInsecable(texte: string): string {
  // Seuls les blancs du nom sont remplacés : le reste du fragment trouvé
  // ressort mot pour mot, casse et apostrophe comprises.
  return texte.replace(NOM_MOTIF, (trouve) => trouve.replace(BLANCS, "\u00A0"));
}
