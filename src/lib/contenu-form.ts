import { z } from "zod";
import { CATEGORIES, TAGS } from "@/data/categories-contenus";
import { estSlugReserve } from "@/data/slugs-reserves";
import { isSafeInternalPath } from "@/components/ExternalLink";
import { firstErrors, formString, optionalText, optionalUrl } from "@/lib/profile-form";
import { slugify } from "@/lib/slug";
import { youtubeId } from "@/lib/youtube";

const TITRE_MAX = 160;
const CHAPO_MAX = 300;
const CORPS_MAX = 50_000;

// Le vocabulaire vit dans `src/data/categories-contenus.ts` : un module SANS
// dépendance, que l'index de recherche peut lire sans tirer Zod dans le bundle
// client. Réexporté ici, où tout le code le cherche déjà.
export { CATEGORIES, TAGS } from "@/data/categories-contenus";

/**
 * Une dimension d'image en pixels, MESURÉE PAR LE NAVIGATEUR de l'orga au choix
 * du fichier (migration 065) : c'est là que vit un décodeur pour les quatre
 * formats acceptés. Elle sert à réserver la place de la photo en tête d'article.
 *
 * Donc une valeur non fiable, et traitée comme telle — mais l'enjeu est la mise
 * en page, pas la sécurité : au pire un article du site s'affiche de travers, et
 * seule une orga peut écrire ici. On borne à un entier plausible ; TOUT le reste
 * (vide, texte, zéro, négatif, décimal, démesuré) devient « taille inconnue »,
 * un état normal que l'affichage sait traiter. Jamais une erreur de formulaire :
 * ce n'est pas une saisie, et rien ne serait actionnable pour la personne.
 */
const DIMENSION_MAX = 20_000; // au-delà, aucun format que nous acceptons ne va
const dimensionImage = z.preprocess((v) => {
  const n = Number(v);
  return typeof v === "string" && v !== "" && Number.isInteger(n) && n > 0 && n <= DIMENSION_MAX
    ? n
    : null;
}, z.number().int().positive().nullable());

/**
 * Le titre produit le slug (clé de navigation ET d'unicité) : un titre de 2+
 * caractères tous non-alphanumériques passerait `min(2)` mais donnerait un slug
 * vide → contenu inatteignable. On le refuse ici (même garde que les conférences).
 */
const titreField = z
  .string()
  .trim()
  .min(2, "Titre requis")
  .max(TITRE_MAX, "Titre trop long")
  .refine((v) => slugify(v).length > 0, {
    message: "Le titre doit contenir des lettres ou des chiffres.",
  });

/**
 * Validation d'un contenu éditorial (publication ou page). Entrées non fiables :
 * le `type` et les enums sont contraints, l'alt d'image est obligatoire dès
 * qu'une image est fournie (a11y, doublé par une contrainte en base).
 */
const contenuSchema = z
  .object({
    type: z.enum(["publication", "page"]),
    titre: titreField,
    chapo: optionalText(CHAPO_MAX),
    corps: z.string().max(CORPS_MAX, `Corps trop long (max ${CORPS_MAX} caractères)`),
    imageUrl: optionalUrl,
    imageAlt: optionalText(200),
    imageWidth: dimensionImage,
    imageHeight: dimensionImage,
    // Vidéo de l'article : une URL YouTube, dont la vignette sera dérivée. On
    // refuse ici tout ce dont on ne saurait rien tirer (autre hébergeur, page
    // de chaîne, lien mal collé) plutôt que d'afficher un bloc vidéo muet.
    videoUrl: optionalUrl.refine((v) => v == null || youtubeId(v) != null, {
      message: "Colle le lien d'une vidéo YouTube (ex. https://youtu.be/…).",
    }),
    categorie: z.enum(CATEGORIES).nullable(),
    tag: z.enum(TAGS).nullable(),
    // Lien INTERNE : un chemin absolu du site. Le « / » de tête est exigé, sinon
    // `${BASE_URL}${lien}` produirait une URL cassée (ex. « techspeakher.frtremplin »).
    // La règle vient d'`isSafeInternalPath`, la MÊME que la lecture applique :
    // écrite à la main ici, elle avait divergé (« /\evil.test », que le
    // navigateur lit comme un hôte, passait à l'écriture et rien ne le voyait).
    lien: optionalText(300).refine((v) => v == null || isSafeInternalPath(v), {
      message: "Le lien interne doit commencer par « / » (ex. /tremplin).",
    }),
    lienExterne: optionalUrl,
    lienLabel: optionalText(120),
    // Édition de conférence rattachée (répertoire) : "" → null, sinon un id
    // entier positif. Un id inexistant est rejeté par la FK côté base.
    conferenceEditionId: z.preprocess(
      (v) => (v === "" || v == null ? null : Number(v)),
      z.number().int().positive().nullable(),
    ),
  })
  .refine((d) => !d.imageUrl || (d.imageAlt != null && d.imageAlt.length > 0), {
    message: "Un texte alternatif est requis avec une image.",
    path: ["imageAlt"],
  })
  // Une taille n'a de sens que COMPLÈTE et rattachée à une image : une largeur
  // sans hauteur ne dit aucune proportion, et une taille sans image ne décrit
  // rien. Les deux cas retombent sur « inconnue », plutôt que de laisser en base
  // une demi-mesure dont l'affichage ne saurait quoi faire.
  .transform((d) =>
    d.imageUrl && d.imageWidth != null && d.imageHeight != null
      ? d
      : { ...d, imageWidth: null, imageHeight: null },
  )
  // Une PAGE vit à la racine (`/mon-slug`), là où les routes du code ont la
  // priorité : un titre qui produit « à-propos » donnerait une page publiée que
  // personne ne verrait jamais. On le dit ici, sur le titre — c'est lui qu'on
  // saisit, le slug n'étant qu'une conséquence. Les publications vivent sous
  // `/articles/…` : aucune collision possible, donc aucune contrainte.
  //
  // Le message NOMME l'adresse : le slug est un champ caché, jamais affiché.
  // Sans elle, l'orga part chercher une page homonyme dans la liste des
  // contenus, où elle ne trouvera rien — la collision est avec une route du
  // code, invisible depuis l'admin. D'où un `superRefine`, seul capable
  // d'interpoler la valeur dans le message.
  .superRefine((d, ctx) => {
    const slug = slugify(d.titre);
    if (d.type !== "page" || !estSlugReserve(slug)) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["titre"],
      message: `Ce titre donne l'adresse /${slug}, déjà prise par une page du site. Choisis un autre titre.`,
    });
  });

export type ContenuFormData = z.infer<typeof contenuSchema>;

export type ContenuFormResult =
  | { ok: true; data: ContenuFormData }
  | { ok: false; errors: Record<string, string> };

/** Parse et valide le formulaire d'un contenu. `data` est prêt pour `contenus.ts`. */
export function parseContenuForm(formData: FormData): ContenuFormResult {
  const parsed = contenuSchema.safeParse({
    type: formString(formData, "type") || "publication",
    titre: formString(formData, "titre"),
    chapo: formString(formData, "chapo"),
    corps: formString(formData, "corps"),
    imageUrl: formString(formData, "imageUrl"),
    imageAlt: formString(formData, "imageAlt"),
    imageWidth: formString(formData, "imageWidth"),
    imageHeight: formString(formData, "imageHeight"),
    videoUrl: formString(formData, "videoUrl"),
    categorie: formString(formData, "categorie") || null,
    tag: formString(formData, "tag") || null,
    lien: formString(formData, "lien"),
    lienExterne: formString(formData, "lienExterne"),
    lienLabel: formString(formData, "lienLabel"),
    conferenceEditionId: formString(formData, "conferenceEditionId"),
  });
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error.issues) };
  return { ok: true, data: parsed.data };
}
