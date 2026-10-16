"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgaId } from "@/lib/auth-guards";
import { renvoyerArticle } from "@/lib/articles-membres";
import { MOTIF_MAX } from "@/lib/article-membre-form";
import { parseContenuForm } from "@/lib/contenu-form";
import {
  createContenu,
  updateContenu,
  setStatut,
  deleteContenu,
} from "@/lib/contenus";
import { seedContenus } from "@/lib/contenus-seed";
import { slugify } from "@/lib/slug";
import { formValues, type ActionState } from "@/lib/action-state";

/** Premier message d'erreur de validation (InlineActionForm affiche UNE alerte). */
function premiereErreur(errors: Record<string, string>): string {
  return Object.values(errors)[0] ?? "Formulaire invalide.";
}

function erreur(formData: FormData, message: string): ActionState {
  return { status: "error", error: message, values: formValues(formData) };
}

/** Slug sûr pour une redirection (jamais un chemin arbitraire), sinon null. */
function slugSafe(formData: FormData): string | null {
  const slug = (formData.get("slug") ?? "").toString();
  return /^[a-z0-9-]+$/.test(slug) ? slug : null;
}

/**
 * Revalide l'admin ET les surfaces publiques qu'un contenu alimente : liste
 * articles, actualités, accueil, RSS, sitemap, et la page de l'article.
 */
function revalider(slug?: string) {
  revalidatePath("/admin/contenus", "layout");
  revalidatePath("/actualites");
  revalidatePath("/articles");
  revalidatePath("/");
  revalidatePath("/feed.xml");
  revalidatePath("/sitemap.xml");
  // Le récit d'une conférence alimente aussi la page de la conférence et celle
  // de l'édition du Tremplin (`contenus.conference_edition_id`). Sans ces deux
  // lignes, dépublier laissait le titre et le chapô jusqu'à 5 min en cache, avec
  // un lien vers un article devenu 404 — le pire moment pour un retrait de nom.
  revalidatePath("/devfest-toulouse");
  revalidatePath("/tremplin", "layout");
  if (slug) revalidatePath(`/articles/${slug}`);
}

/** Création (page /[type]/nouveau) : titre + chapô minimum → PRG vers l'éditeur. */
export async function createContenuAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOrgaId();
  const result = parseContenuForm(formData);
  if (!result.ok) return erreur(formData, premiereErreur(result.errors));
  const created = await createContenu(result.data);
  if (!created.ok) {
    return erreur(
      formData,
      "Un contenu porte déjà ce titre (même adresse). Ouvre-le depuis la liste ou change le titre.",
    );
  }
  revalider(created.slug);
  redirect(`/admin/contenus/${result.data.type}/${created.slug}?cree=1`);
}

/**
 * Correction (page /[type]/[slug]). Enregistre TOUJOURS les champs saisis, puis
 * applique l'intention du bouton qui a soumis le form (CTA du bas) :
 *  - « publier »   : enregistre + passe en publié (le geste principal d'un brouillon) ;
 *  - « depublier » : enregistre + repasse en brouillon (retire du public) ;
 *  - « enregistrer » (défaut) : enregistre seul, reste EN PLACE (confirmation
 *    focalisée) ; ne redirige QUE si le slug change (renommage → 404 de l'ancienne URL).
 * Publier/dépublier enregistrent d'abord : aucun risque de publier du contenu périmé.
 */
export async function updateContenuAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOrgaId();
  const id = Number(formData.get("contenuId"));
  if (!Number.isInteger(id) || id <= 0) return erreur(formData, "Contenu introuvable.");
  const result = parseContenuForm(formData);
  if (!result.ok) return erreur(formData, premiereErreur(result.errors));
  const saved = await updateContenu(id, result.data);
  if (!saved.ok) {
    return erreur(
      formData,
      saved.reason === "slug"
        ? "Un autre contenu porte déjà ce titre (même adresse)."
        : "Contenu introuvable.",
    );
  }

  const intention = (formData.get("intention") ?? "").toString();
  const nouveauSlug = slugify(result.data.titre);

  // Publier / dépublier : geste explicite du CTA, enregistrement d'abord.
  if (intention === "publier" || intention === "depublier") {
    await setStatut(id, intention === "publier" ? "publie" : "brouillon");
    revalider(saved.slug);
    const param = intention === "publier" ? "publie" : "brouillon";
    const slugRedir = /^[a-z0-9-]+$/.test(nouveauSlug) ? nouveauSlug : saved.slug;
    redirect(`/admin/contenus/${result.data.type}/${slugRedir}?${param}=1`);
  }

  revalider(saved.slug);
  const ancienSlug = (formData.get("slug") ?? "").toString();
  if (nouveauSlug !== ancienSlug && /^[a-z0-9-]+$/.test(nouveauSlug)) {
    redirect(`/admin/contenus/${result.data.type}/${nouveauSlug}?renomme=1`);
  }
  return { status: "success" };
}

/**
 * Renvoie un article de membre EN RELECTURE à son autrice, motif à l'appui
 * (lot N3, charte : la forme évidente se corrige, le fond se renvoie). Geste
 * orga ; la borne « statut = en_relecture » vit en SQL.
 */
export async function renvoyerArticleAction(formData: FormData): Promise<void> {
  await requireOrgaId();
  const id = Number(formData.get("contenuId"));
  // Slug de RETOUR seulement (jamais écrit) — validé comme les autres
  // redirections de ce fichier, une valeur libre sort vers la liste.
  const slugForm = (formData.get("slug") ?? "").toString();
  const retour = /^[a-z0-9-]+$/.test(slugForm) ? slugForm : null;
  const motif = (formData.get("motif") ?? "").toString().trim().slice(0, MOTIF_MAX);
  if (!Number.isInteger(id) || id <= 0 || !retour) redirect("/admin/contenus");
  if (!motif) {
    // Un renvoi SANS motif n'aide personne : la charte demande le pourquoi.
    redirect(`/admin/contenus/publication/${retour}?motif_requis=1`);
  }
  const slug = await renvoyerArticle(id, motif);
  if (!slug) {
    // Course perdue (une autre orga a publié ou renvoyé entre-temps) : le
    // dire, plutôt que confirmer un renvoi qui a écrit zéro ligne.
    redirect(`/admin/contenus/publication/${retour}?deja_traite=1`);
  }
  redirect(`/admin/contenus/publication/${slug}?renvoye=1`);
}

// Upload de l'image d'un contenu (lot 6) : voir `/api/admin/contenus/image`
// (route API, pas une Server Action — évite de relever la limite de taille
// GLOBALE des Server Actions pour cette seule fonctionnalité d'upload).

/** Importe les actualités historiques (hors flux RSS) → PRG vers la liste. */
export async function seedContenusAction(): Promise<void> {
  await requireOrgaId();
  const n = await seedContenus();
  revalider();
  redirect(`/actualites?importe=${n}`);
}

/** Suppression (page /[type]/[slug]/supprimer + ConfirmSubmitButton). */
export async function deleteContenuAction(formData: FormData): Promise<void> {
  await requireOrgaId();
  const id = Number(formData.get("contenuId"));
  if (Number.isInteger(id) && id > 0) {
    await deleteContenu(id);
    revalider(slugSafe(formData) ?? undefined);
  }
  redirect(`/actualites?supprime=1`);
}
