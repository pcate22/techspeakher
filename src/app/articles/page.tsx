import { redirect } from "next/navigation";

/**
 * La liste des articles a fusionné avec `/actualites` (liste unique « article =
 * actualité »). On garde `/articles/[slug]` pour lire un article ; `/articles`
 * (l'ancienne liste) redirige vers la liste unique.
 */
export default function ArticlesIndex() {
  redirect("/actualites");
}
