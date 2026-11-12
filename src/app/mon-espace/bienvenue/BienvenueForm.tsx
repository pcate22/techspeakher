"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { publierFicheExpressAction, type SaveState } from "../actions";
import ChoixThemes from "../ChoixThemes";
import Button from "@/components/Button";
import { inputClass, errorClass } from "@/components/ChampTexte";

/**
 * Deux écrans, un seul formulaire : l'étape 1 reste dans le DOM (`hidden`)
 * pour que le nom parte avec les thèmes. Une erreur sur le nom ramène à
 * l'étape 1, là où elle se corrige.
 */
export default function BienvenueForm({ nomInitial }: { nomInitial: string }) {
  const [etape, setEtape] = useState<1 | 2>(1);
  const [state, action, pending] = useActionState<SaveState, FormData>(
    async (prev, fd) => {
      const r = await publierFicheExpressAction(prev, fd);
      if (r.errors?.nom) setEtape(1);
      return r;
    },
    {},
  );
  const [nom, setNom] = useState(nomInitial);
  const titre2 = useRef<HTMLHeadingElement>(null);
  const champNom = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.errors?.nom) champNom.current?.focus();
  }, [state]);

  function continuer() {
    if (!nom.trim()) {
      champNom.current?.focus();
      return;
    }
    setEtape(2);
    setTimeout(() => titre2.current?.focus(), 0);
  }

  const erreurNom = state.errors?.nom;

  return (
    <form action={action} className="flex flex-col gap-6">
      <div hidden={etape !== 1}>
        <h2 className="text-2xl font-bold mb-4">
          <label htmlFor="bienvenue-nom">Comment t&apos;appelles-tu&nbsp;?</label>
        </h2>
        <input
          ref={champNom}
          id="bienvenue-nom"
          name="nom"
          type="text"
          autoComplete="name"
          required
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              continuer();
            }
          }}
          aria-invalid={erreurNom ? true : undefined}
          aria-describedby={erreurNom ? "err-bienvenue-nom" : undefined}
          className={inputClass}
        />
        {erreurNom && (
          <p id="err-bienvenue-nom" role="alert" className={errorClass}>
            {erreurNom}
          </p>
        )}
        <Button type="button" onClick={continuer} className="mt-4">
          Continuer
        </Button>
      </div>

      <div hidden={etape !== 2}>
        <fieldset>
          <legend className="sr-only" id="bienvenue-themes">
            Tes thèmes
          </legend>
          <h2 ref={titre2} tabIndex={-1} className="text-2xl font-bold mb-4 focus-visible:outline-none">
            De quoi parles-tu&nbsp;?
          </h2>
          <ChoixThemes
            name="sujets"
            initial={state.valeurs?.sujets ?? []}
            legendId="bienvenue-themes"
          />
        </fieldset>
        {state.errors?.sujets && (
          <p role="alert" className={errorClass}>
            {state.errors.sujets}
          </p>
        )}
        <Button type="submit" disabled={pending} className="mt-6">
          Publier ma fiche
        </Button>
        <p className="text-sm text-gray-light mt-3">
          En publiant, j&apos;atteste être une femme ou une personne non binaire.
        </p>
        <p className="text-sm text-gray-light mt-1">
          Les organisateurs pourront t&apos;écrire par le site, ton e-mail reste caché.
        </p>
      </div>
    </form>
  );
}
