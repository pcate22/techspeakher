"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { IDLE, type ActionState } from "@/lib/action-state";
import { RADIO_DESSINE } from "@/components/radio-dessine";
import {
  AUDIENCES_ATELIER,
  libelleAudience,
  aideAudience,
  type AudienceAtelier,
} from "@/lib/atelier-audience";
import type { PhaseAtelier } from "@/lib/tremplin-ateliers";

/**
 * QUI voit cet atelier — une question, une réponse.
 *
 * Remplace l'interrupteur « ouvert à toutes » qui cohabitait avec une liste
 * nominative : deux réglages indépendants dont le plus permissif gagnait en
 * silence. Ici les trois réponses s'excluent, et chacune dit sa conséquence à
 * côté d'elle — on choisit en lisant, sans avoir à essayer.
 *
 * Boutons RADIO plutôt qu'un `<select>` : les trois options tiennent à l'écran
 * avec leur explication, et on compare avant de choisir. Un select les cacherait
 * derrière un geste, et n'aurait pas la place d'expliquer.
 *
 * Enregistrement À LA VOLÉE (même doctrine que `SettingToggle`, et même page) :
 * un clic soumet, le succès rafraîchit depuis le serveur. L'affichage est
 * optimiste le temps de l'aller-retour ; une erreur revient à l'état réel.
 */
export default function ChoixAudience<S extends object>({
  action,
  hidden,
  audience,
  phase,
  successMessage = "Audience mise à jour.",
}: {
  action: (state: ActionState<S>, formData: FormData) => Promise<ActionState<S>>;
  hidden: Record<string, string | number>;
  audience: AudienceAtelier;
  /** Phase de l'atelier : l'option « sa phase » la NOMME. */
  phase: PhaseAtelier;
  successMessage?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState<S>, FormData>(
    action as (s: Awaited<ActionState<S>>, fd: FormData) => Promise<ActionState<S>>,
    IDLE as Awaited<ActionState<S>>,
  );
  const router = useRouter();
  const [optimiste, setOptimiste] = useState(audience);
  const groupeId = useId();

  // L'état réel vient du serveur : on se recale dessus à chaque rendu qui
  // apporte une nouvelle valeur (succès rafraîchi, ou erreur qui l'a laissée).
  const [vueServeur, setVueServeur] = useState(audience);
  if (vueServeur !== audience) {
    setVueServeur(audience);
    setOptimiste(audience);
  }

  const statut = state as { status?: string; error?: string };
  // Le succès rafraîchit depuis le serveur (l'état réel gagne toujours).
  useEffect(() => {
    if (statut.status === "success") router.refresh();
  }, [statut.status, router]);
  // Sur ERREUR, on affiche l'état réel plutôt que l'optimiste : une DÉRIVATION,
  // pas un état de plus — sinon le retour au réel dépendrait d'un effet, et le
  // contrôle mentirait le temps d'un rendu.
  const affiche = statut.status === "error" ? audience : optimiste;

  return (
    <form action={formAction}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {/* `aria-busy` plutôt que `disabled` : un `<fieldset disabled>` sort les
          TROIS radios du parcours clavier le temps de l'aller-retour, et le
          focus retombe en haut de page. Re-cliquer pendant l'envoi ne casse
          rien — c'est un choix explicite de plus, le dernier gagne. */}
      <fieldset aria-busy={pending}>
        <legend className="text-sm font-bold text-white py-2">
          Qui voit cet atelier&nbsp;?
        </legend>
        <div className="flex flex-col gap-2">
          {AUDIENCES_ATELIER.map((a) => {
            const id = `${groupeId}-${a.cle}`;
            const aideId = `${id}-aide`;
            return (
              <label
                key={a.cle}
                htmlFor={id}
                className={`flex min-h-[44px] items-start gap-3 rounded-lg border px-3 py-2 cursor-pointer ${
                  affiche === a.cle
                    ? "border-cyan bg-cyan/5"
                    : "border-field-border bg-navy hover:border-cyan"
                }`}
              >
                <input
                  type="radio"
                  id={id}
                  name="audience"
                  value={a.cle}
                  checked={affiche === a.cle}
                  aria-describedby={aideId}
                  onChange={(e) => {
                    setOptimiste(a.cle);
                    // Soumission immédiate : le formulaire porte déjà la valeur
                    // cochée, `requestSubmit` la poste telle quelle.
                    e.currentTarget.form?.requestSubmit();
                  }}
                  // Radio DESSINÉ plutôt que natif (cf. `radio-dessine.ts` : le
                  // rendu du navigateur se lit à l'envers sur fond sombre).
                  // `mt-1` aligne le contrôle sur la première ligne du libellé,
                  // qui porte ici une aide en dessous.
                  className={`mt-1 ${RADIO_DESSINE}`}
                />
                <span className="text-sm text-white">
                  {libelleAudience(a.cle, phase)}
                  <span id={aideId} className="block text-xs text-gray-light mt-0.5">
                    {aideAudience(a.cle, phase)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <p role="status" aria-live="polite" className="text-sm text-cyan mt-2 empty:hidden">
          {statut.status === "success" ? successMessage : ""}
        </p>
        <p role="alert" className="text-sm text-orange mt-2 empty:hidden">
          {statut.status === "error" ? (statut.error ?? "") : ""}
        </p>
      </fieldset>
    </form>
  );
}
