"use client";

import { useActionState } from "react";
import Button from "@/components/Button";
import { CATEGORIES } from "@/data/categories-contenus";
import {
  ARTICLE_TITRE_MAX,
  ARTICLE_CHAPO_MAX,
  CATEGORIE_MEMBRE_DEFAUT,
} from "@/lib/article-membre-form";
import type { ArticleMembre } from "@/lib/articles-membres";
import type { ArticleFormState } from "./actions";

const champCls =
  "w-full rounded-lg border border-field-border bg-navy px-3 py-2.5 text-sm text-white placeholder:text-gray-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan";

/** Champ + label + erreur : le trio RGAA (erreur reliée, saisie conservée). */
function Erreur({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-orange">
      {message}
    </p>
  );
}

/**
 * L'éditeur d'article d'une MEMBRE (lot N3, maquette validée) : titre, texte,
 * chapo optionnel, catégorie au choix (« Conseils de speakeuse » par défaut).
 * Une erreur de validation CONSERVE la saisie (`valeurs`) et se dit en
 * `role="alert"` relié au champ (WCAG 3.3.1).
 */
export default function ArticleForm({
  action,
  initial,
}: {
  action: (prev: ArticleFormState, formData: FormData) => Promise<ArticleFormState>;
  initial: ArticleMembre | null;
}) {
  const [state, formAction, pending] = useActionState<ArticleFormState, FormData>(
    action,
    {},
  );
  const v = (cle: string, defaut: string) => state.valeurs?.[cle] ?? defaut;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div>
        <label htmlFor="article-titre" className="block text-sm font-medium mb-1">
          Titre
          <span className="text-orange" aria-hidden="true">
            {" "}
            *
          </span>
          <span className="sr-only"> (obligatoire)</span>
        </label>
        <input
          id="article-titre"
          name="titre"
          type="text"
          required
          maxLength={ARTICLE_TITRE_MAX}
          defaultValue={v("titre", initial?.titre ?? "")}
          aria-describedby={state.errors?.titre ? "err-titre" : undefined}
          className={champCls}
        />
        <Erreur id="err-titre" message={state.errors?.titre} />
      </div>

      <div>
        <label htmlFor="article-corps" className="block text-sm font-medium mb-1">
          Ton texte
          <span className="text-orange" aria-hidden="true">
            {" "}
            *
          </span>
          <span className="sr-only"> (obligatoire)</span>
        </label>
        <p className="text-xs text-gray-light mb-1">
          Markdown simple&nbsp;: titres, gras, listes, liens.
        </p>
        <textarea
          id="article-corps"
          name="corps"
          required
          rows={14}
          defaultValue={v("corps", initial?.corps ?? "")}
          aria-describedby={state.errors?.corps ? "err-corps" : undefined}
          className={champCls}
        />
        <Erreur id="err-corps" message={state.errors?.corps} />
      </div>

      <div>
        <label htmlFor="article-chapo" className="block text-sm font-medium mb-1">
          Chapo (optionnel)
        </label>
        <p className="text-xs text-gray-light mb-1">
          L&apos;accroche de la carte, une phrase ou deux.
        </p>
        <textarea
          id="article-chapo"
          name="chapo"
          rows={2}
          maxLength={ARTICLE_CHAPO_MAX}
          defaultValue={v("chapo", initial?.chapo ?? "")}
          aria-describedby={state.errors?.chapo ? "err-chapo" : undefined}
          className={champCls}
        />
        <Erreur id="err-chapo" message={state.errors?.chapo} />
      </div>

      <div>
        <label htmlFor="article-categorie" className="block text-sm font-medium mb-1">
          Catégorie
        </label>
        <select
          id="article-categorie"
          name="categorie"
          defaultValue={v("categorie", initial?.categorie ?? CATEGORIE_MEMBRE_DEFAUT)}
          className={champCls}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Erreur id="err-categorie" message={state.errors?.categorie} />
      </div>

      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer le brouillon"}
        </Button>
      </div>
    </form>
  );
}
