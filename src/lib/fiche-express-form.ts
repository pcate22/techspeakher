import { z } from "zod";
import { filterSujets } from "@/data/domaines";
import { normaliserNomCompte } from "@/lib/format";

/**
 * Le formulaire express ne lit que le nom et les thèmes. Tout autre champ
 * (un statut glissé dans le POST, par exemple) est ignoré : la décision de
 * publication se prend côté serveur.
 */
const schema = z.object({
  nom: z
    .string()
    .transform(normaliserNomCompte)
    .pipe(z.string().min(1, "Indique ton prénom et ton nom.")),
  sujets: z.array(z.string()).min(1, "Choisis au moins un thème."),
});

export type FicheExpressResult =
  | { ok: true; data: { nom: string; sujets: string[] } }
  | { ok: false; errors: Record<string, string> };

export function parseFicheExpress(fd: FormData): FicheExpressResult {
  const res = schema.safeParse({
    nom: (fd.get("nom") ?? "").toString(),
    // Seuls les thèmes de la liste comptent : une valeur inconnue ne vaut pas
    // « au moins un thème ».
    sujets: filterSujets(fd.getAll("sujets").map(String)),
  });
  if (res.success) return { ok: true, data: res.data };
  const errors: Record<string, string> = {};
  for (const issue of res.error.issues) {
    const champ = String(issue.path[0] ?? "form");
    errors[champ] ??= issue.message;
  }
  return { ok: false, errors };
}
