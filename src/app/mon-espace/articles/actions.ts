"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth-guards";
import { parseArticleMembre } from "@/lib/article-membre-form";
import {
  creerArticle,
  majMonArticle,
  soumettreMonArticle,
} from "@/lib/articles-membres";

/**
 * Actions des articles de MEMBRE (lot N3). Sécurité : l'identité vient de la
 * session (`requireUserId`), et chaque écriture est re-bornée en SQL par
 * `auteur_user_id = uid` + le statut (un brouillon se modifie, un article
 * soumis est chez l'orga) — cf. `articles-membres.ts`. La validation (Zod)
 * vit dans `article-membre-form.ts`.
 */

export type ArticleFormState = {
  ok?: boolean;
  errors?: Record<string, string>;
  /** La saisie REFUSÉE, réaffichée telle quelle (WCAG 3.3.1 : une erreur de
   * validation CONSERVE la saisie). */
  valeurs?: Record<string, string>;
};

const TITRE_PRIS =
  "Ce titre est déjà pris par une autre actualité : ajuste-le d'un mot.";

function valeursDe(formData: FormData): Record<string, string> {
  return {
    titre: String(formData.get("titre") ?? ""),
    corps: String(formData.get("corps") ?? ""),
    chapo: String(formData.get("chapo") ?? ""),
    categorie: String(formData.get("categorie") ?? ""),
  };
}

export async function creerArticleAction(
  _prev: ArticleFormState,
  formData: FormData,
): Promise<ArticleFormState> {
  const uid = await requireUserId();
  const parsed = parseArticleMembre(formData);
  if (!parsed.ok) return { ok: false, errors: parsed.errors, valeurs: valeursDe(formData) };

  const res = await creerArticle(uid, parsed.data);
  if (!res.ok)
    return {
      ok: false,
      errors: {
        titre:
          res.reason === "plafond"
            ? "Tu as déjà vingt articles en cours : soumets-les ou finis-les avant d'en commencer un nouveau."
            : TITRE_PRIS,
      },
      valeurs: valeursDe(formData),
    };
  redirect(`/mon-espace/articles/${res.id}?ok=cree`);
}

export async function majArticleAction(
  _prev: ArticleFormState,
  formData: FormData,
): Promise<ArticleFormState> {
  const uid = await requireUserId();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { ok: false, errors: { titre: "Article inconnu." } };

  const parsed = parseArticleMembre(formData);
  if (!parsed.ok) return { ok: false, errors: parsed.errors, valeurs: valeursDe(formData) };

  const fait = await majMonArticle(id, uid, parsed.data);
  if (!fait)
    return {
      ok: false,
      // Slug recalculé du titre : la collision retombe ici aussi — mais le cas
      // dominant est un article déjà soumis (plus un brouillon).
      errors: { titre: "Cet article est en relecture ou son titre est déjà pris." },
      valeurs: valeursDe(formData),
    };
  redirect(`/mon-espace/articles/${id}?ok=enregistre`);
}

export async function soumettreArticleAction(formData: FormData): Promise<void> {
  const uid = await requireUserId();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) redirect("/mon-espace/articles");

  await soumettreMonArticle(id, uid);
  // La tâche « Relire l'article de … » apparaît chez l'orga (dérivée) ; les
  // écrans du membre re-lisent leur statut.
  revalidatePath("/mon-espace/articles");
  redirect(`/mon-espace/articles?ok=soumis`);
}
