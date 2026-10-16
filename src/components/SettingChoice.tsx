"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IDLE, type ActionState } from "@/lib/action-state";
import { RADIO_DESSINE } from "@/components/radio-dessine";

export type ChoixReglage = { value: string; label: string };

/**
 * Bloc de réglage à CHOIX MULTIPLE, jumeau de `SettingToggle` pour les cas où
 * la question est « à quelle fréquence ? » plutôt que « oui ou non ? ». Même
 * doctrine : enregistrement à la volée au changement, affichage optimiste le
 * temps de l'aller-retour, retour à l'état serveur en cas d'erreur.
 *
 * Groupe de champs de même nature = `<fieldset>` + `<legend>` (RGAA 11.5), et
 * RIEN de plus : le fieldset porte déjà le rôle `group`, un `role="radiogroup"`
 * sur un conteneur intérieur ajouterait un second groupe imbriqué et ferait
 * annoncer le regroupement deux fois. Les radios sont natifs, donc les flèches
 * naviguent et le lecteur annonce « 2 sur 5 » sans qu'on ait rien à écrire.
 *
 * L'état choisi est porté par la SÉMANTIQUE (`checked`), jamais par la seule
 * couleur (RGAA 3.1 / principes UI § 9) : la bordure cyan ne fait que doubler
 * une information déjà disponible au lecteur d'écran.
 */
export default function SettingChoice<S extends object>({
  action,
  name,
  value,
  options,
  label,
  description,
  successMessage = "Enregistré.",
}: {
  action: (state: ActionState<S>, formData: FormData) => Promise<ActionState<S>>;
  /** Nom du champ envoyé à l'action. */
  name: string;
  /** Valeur actuelle, côté SERVEUR (source de vérité). */
  value: string;
  options: ChoixReglage[];
  label: string;
  description?: string;
  successMessage?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState<S>, FormData>(
    action as (s: Awaited<ActionState<S>>, fd: FormData) => Promise<ActionState<S>>,
    IDLE as Awaited<ActionState<S>>,
  );
  const router = useRouter();
  const [optimiste, setOptimiste] = useState(value);
  const descId = useId();
  const noteId = useId();
  const statusRef = useRef<HTMLParagraphElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);

  // Resynchronisation sur la vérité serveur SANS effet (motif « état dérivé »
  // de SettingToggle : pas de flash au rafraîchissement post-succès).
  const [valueVue, setValueVue] = useState(value);
  if (value !== valueVue) {
    setValueVue(value);
    setOptimiste(value);
  }

  useEffect(() => {
    if (state.status === "success") router.refresh();
    else if (state.status === "error") setOptimiste(value); // rien enregistré
  }, [state, value, router]);

  // Régions vivantes vider-puis-remplir : l'annonce repart même si le message
  // est identique au précédent (deux enregistrements de suite).
  useEffect(() => {
    const status = statusRef.current;
    const alert = alertRef.current;
    if (!status || !alert) return;
    status.textContent = "";
    alert.textContent = "";
    if (state.status === "success") status.textContent = successMessage;
    else if (state.status === "error") alert.textContent = state.error;
    // successMessage est stable : state suffit comme déclencheur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="py-3">
      {/* `aria-busy` plutôt que `disabled` : un `<fieldset disabled>` sort les
          radios du parcours clavier le temps de l'aller-retour, le focus
          retombe sur `body`, et la personne au clavier perd le groupe après la
          première flèche. Même parade que `ChoixAudience` et `SettingToggle`.
          Re-choisir pendant l'envoi ne casse rien : le dernier gagne. */}
      <fieldset
        aria-busy={pending}
        // Description et note d'auto-enregistrement rattachées au GROUPE : une
        // annonce à l'entrée, au lieu d'être répétée sur chacune des options.
        aria-describedby={[description ? descId : null, noteId]
          .filter(Boolean)
          .join(" ")}
        className="min-w-0"
      >
        <legend className="text-sm font-medium">
          {label}
        </legend>
        {description && (
          <p id={descId} className="text-xs text-gray-light mt-0.5">
            {description}
          </p>
        )}
        <p id={noteId} className="sr-only">
          Chaque changement s&apos;enregistre automatiquement.
        </p>

        <div className="mt-3 flex flex-col gap-2">
          {options.map((o) => (
            <label
              key={o.value || "defaut"}
              className={`flex min-h-[44px] items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer ${
                optimiste === o.value
                  ? "border-cyan bg-cyan/5"
                  : "border-field-border bg-navy hover:border-cyan"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={optimiste === o.value}
                onChange={(e) => {
                  setOptimiste(o.value);
                  // Enregistrement à la volée : on soumet le formulaire qui
                  // porte déjà la valeur cochée (pas de bouton « Enregistrer »,
                  // même doctrine que l'interrupteur).
                  e.currentTarget.form?.requestSubmit();
                }}
                // Radio DESSINÉ plutôt que natif (cf. `radio-dessine.ts`), même
                // parade que `ChoixAudience` — et désormais la même chaîne.
                className={RADIO_DESSINE}
              />
              <span className="text-sm text-white">{o.label}</span>
            </label>
          ))}
        </div>

        <p
          ref={statusRef}
          role="status"
          aria-live="polite"
          className="text-xs text-cyan mt-1 empty:hidden"
        />
        <p ref={alertRef} role="alert" className="text-xs text-orange mt-1 empty:hidden" />
      </fieldset>
    </form>
  );
}
