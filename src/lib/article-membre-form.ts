import { z } from "zod";
import { CATEGORIES, CATEGORIE_CONSEIL } from "@/data/categories-contenus";
import { firstErrors, formString, optionalText } from "@/lib/profile-form";
import type { ArticleMembreInput } from "@/lib/articles-membres";

/**
 * Validation du formulaire d'article d'une MEMBRE (lot N3) : un éditeur
 * SIMPLE — titre, texte, chapo optionnel, catégorie au choix (« Conseils de
 * speakeuse » proposée par défaut). Les mêmes bornes que l'éditeur orga
 * (`contenu-form`) pour ce qui est partagé ; le reste (image, liens, vidéo)
 * reste l'affaire de l'orga.
 */
export const ARTICLE_TITRE_MAX = 160;
export const ARTICLE_CHAPO_MAX = 300;
export const ARTICLE_CORPS_MAX = 50_000;
/** Borne du motif de renvoi (geste orga) : un motif se lit d'un trait. */
export const MOTIF_MAX = 1_000;
export const CATEGORIE_MEMBRE_DEFAUT = CATEGORIE_CONSEIL;

const schema = z.object({
  titre: z
    .string()
    .trim()
    .min(1, "Donne un titre à ton article.")
    .max(ARTICLE_TITRE_MAX, "Titre trop long"),
  corps: z
    .string()
    .trim()
    .min(1, "Un article a un texte : écris-le ici.")
    .max(ARTICLE_CORPS_MAX, "Texte trop long"),
  chapo: optionalText(ARTICLE_CHAPO_MAX),
  categorie: z.enum(CATEGORIES),
});

export function parseArticleMembre(
  formData: FormData,
):
  | { ok: true; data: ArticleMembreInput }
  | { ok: false; errors: Record<string, string> } {
  const parsed = schema.safeParse({
    titre: formString(formData, "titre"),
    corps: formString(formData, "corps"),
    chapo: formString(formData, "chapo"),
    categorie: formString(formData, "categorie"),
  });
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error.issues) };
  return {
    ok: true,
    data: {
      titre: parsed.data.titre,
      corps: parsed.data.corps,
      chapo: parsed.data.chapo,
      categorie: parsed.data.categorie,
    },
  };
}
