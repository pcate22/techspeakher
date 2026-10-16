"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IDLE, type ActionState } from "@/lib/action-state";

/** Insécable : les guillemets français ne se détachent pas de ce qu'ils citent. */
const NBSP = " ";

/**
 * Option sérialisable (aucune fonction passée du serveur au client, cf. le crash
 * « oups » évité). `editHref` est le lien « Modifier » PROPRE à cette option
 * (route admin côté orga, `/mon-espace/talks/[id]` côté speakeuse) : c'est ce qui
 * rend le composant mutualisable sans qu'il connaisse le rôle de l'appelante.
 */
export interface TalkOption {
  id: number;
  titre: string;
  meta: string;
  editHref: string;
  /** Talk encore à l'état de « Sujet proposé » (proposition, pas encore donné). */
  proposition?: boolean;
}

/**
 * Choix du talk pitché au Tremplin : un GROUPE RADIO (un seul talk pitché à la
 * fois), enregistré à la volée (pattern résultat, sans rechargement). C'est un
 * contrôle de sélection, pas une pile de CTA : la page garde UN seul CTA
 * principal (« Ajouter un talk »). L'option « Aucun » retire le talk pitché
 * (forme positive, cf. docs/principes-conception-ui.md §5).
 *
 * MUTUALISÉ orga ↔ speakeuse par capacités (guide §3) : l'action, les libellés
 * (`legend`, `pitchedBadge`, `noneLabel`) et le lien « Modifier » (`editHref`
 * par option) sont injectés ; le composant ne décide d'aucune autorisation.
 * `registrationId` n'est posé que côté orga (l'action speakeuse scope par
 * session et l'ignore : anti-IDOR).
 */
export default function PitchedTalkPicker({
  action,
  editionId,
  registrationId,
  options,
  pitchedId,
  legend,
  pitchedBadge = "★ Talk pitché au Tremplin",
  noneLabel = "Aucun pour l'instant",
  autoSaveHint = "Le choix s'enregistre automatiquement.",
}: {
  action: (state: ActionState<object>, formData: FormData) => Promise<ActionState<object>>;
  editionId: number;
  /** Posé en champ caché seulement s'il est fourni (chemin orga). */
  registrationId?: number;
  options: TalkOption[];
  pitchedId: number | null;
  /** Question du groupe radio, à la voix de l'appelante (orga / speakeuse). */
  legend: string;
  /** Badge du talk sélectionné (défaut neutre, surchargeable). */
  pitchedBadge?: string;
  /** Libellé de l'option de retrait (forme positive). */
  noneLabel?: string;
  /** Indice d'enregistrement automatique (lu par les lecteurs d'écran). */
  autoSaveHint?: string;
}) {
  const [state, formAction] = useActionState<ActionState<object>, FormData>(action, IDLE);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  // Sélection contrôlée, resynchronisée sur la vérité serveur après refresh
  // (motif « état dérivé », cf. SettingToggle) : pas de flash, pas de ressaut.
  const value = pitchedId == null ? "" : String(pitchedId);
  const [sel, setSel] = useState(value);
  const [vu, setVu] = useState(value);
  if (value !== vu) {
    setVu(value);
    setSel(value);
  }
  // Erreur : rien enregistré → on revient à la vérité serveur (pas de
  // divergence silencieuse entre le radio affiché et le talk réel). Ajustement
  // PENDANT le rendu (motif React), pas dans un effet.
  const [statutVu, setStatutVu] = useState(state);
  if (state !== statutVu) {
    setStatutVu(state);
    if (state.status === "error") setSel(value);
  }

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  // Région vivante (vider-puis-remplir) : annonce fiable même message répété.
  useEffect(() => {
    const el = statusRef.current;
    if (!el) return;
    el.textContent = "";
    if (state.status === "success") {
      const t = options.find((o) => String(o.id) === sel);
      el.textContent = t ? `Talk pitché : « ${t.titre} ».` : "Aucun talk pitché.";
    } else if (state.status === "error") {
      el.textContent = state.error;
    }
  }, [state, options, sel]);

  const rowBase =
    "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors";

  return (
    <form
      ref={formRef}
      action={formAction}
      onChange={() => formRef.current?.requestSubmit()}
    >
      <input type="hidden" name="editionId" value={editionId} />
      {registrationId != null && (
        <input type="hidden" name="registrationId" value={registrationId} />
      )}
      <fieldset className="m-0 p-0 border-0">
        <legend className="text-xs font-bold uppercase tracking-wide text-gray-light mb-2">
          {legend}
        </legend>
        <p className="sr-only">{autoSaveHint}</p>

        <div className="flex flex-col gap-2">
          {options.map((o) => {
            const v = String(o.id);
            const checked = sel === v;
            return (
              <div
                key={o.id}
                className={`${rowBase} ${
                  checked ? "border-cyan bg-navy-light" : "border-navy-lighter bg-navy"
                }`}
              >
                <label className="flex min-h-[44px] flex-1 items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="talkId"
                    value={v}
                    checked={checked}
                    onChange={() => setSel(v)}
                    className="mt-1 h-4 w-4 shrink-0 accent-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                  />
                  <span className="min-w-0">
                    {checked && (
                      <span className="block text-xs font-bold uppercase tracking-wide text-gold">
                        {pitchedBadge}
                      </span>
                    )}
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{o.titre}</span>
                      {o.proposition && (
                        <span className="shrink-0 rounded-full border border-navy-lighter px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-light">
                          Proposition
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-gray-light mt-0.5">{o.meta}</span>
                  </span>
                </label>
                <Link
                  href={o.editHref}
                  className="inline-flex min-h-[44px] shrink-0 items-center rounded px-2 text-sm text-gray-light hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                  // Le titre complète l'intitulé : la liste donnait N liens dont
                  // le nom accessible entier était « Modifier », pour N talks
                  // différents (RGAA 6.1 / WCAG 2.4.4). Par `aria-label` et non
                  // par un `sr-only` accolé : le calcul du nom accessible recolle
                  // les nœuds sans séparateur, et « Modifier » + « le talk… »
                  // s'énonçait « Modifierle talk ». Le libellé visible reste
                  // contenu dans le nom (WCAG 2.5.3).
                  aria-label={`Modifier le talk «${NBSP}${o.titre}${NBSP}»`}
                >
                  Modifier
                </Link>
              </div>
            );
          })}

          {/* Option « Aucun » : retire le talk pitché, en forme positive. */}
          <div
            className={`${rowBase} ${
              sel === "" ? "border-cyan bg-navy-light" : "border-navy-lighter bg-navy"
            }`}
          >
            <label className="flex min-h-[44px] flex-1 items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="talkId"
                value=""
                checked={sel === ""}
                onChange={() => setSel("")}
                className="h-4 w-4 shrink-0 accent-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
              />
              <span className="text-gray-light">{noneLabel}</span>
            </label>
          </div>
        </div>

        <p
          ref={statusRef}
          role="status"
          aria-live="polite"
          className="text-sm text-cyan mt-2 empty:hidden"
        />
      </fieldset>
    </form>
  );
}
