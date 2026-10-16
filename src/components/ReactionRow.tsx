"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IDLE, type ActionState } from "@/lib/action-state";
import { estControleNext } from "@/lib/next-errors";
import { reactionAction } from "@/app/mon-espace/actions";
import { libelleReactions, MOTS } from "@/lib/reaction-libelle";
import type { ReactionsCarte, CibleReaction } from "@/lib/reactions";

/**
 * Ce que l'action serveur ne PEUT pas attraper : l'appel qui ne l'atteint
 * jamais — réseau coupé, ou nouvelle version livrée pendant qu'on lisait le
 * fil (l'identifiant de Server Action de la page ouverte n'existe plus dans
 * le déploiement courant). La promesse rejette alors CÔTÉ CLIENT, React
 * relance l'erreur au rendu, et elle remontait jusqu'à `app/error.tsx` : tout
 * le fil remplacé par « Oups », pour un bouton.
 *
 * On l'attrape ICI, à l'endroit exact où elle naît, plutôt que sous une
 * limite d'erreur qui aurait démonté la rangée (focus perdu, compteur perdu,
 * et rien pour revenir sans recharger). Le geste redevient un simple échec :
 * le bouton revient en arrière, l'alerte déjà montée le dit, et re-taper
 * réessaie. Le message donne les DEUX réparations, dans l'ordre où on les
 * tente — sans prétendre savoir laquelle des deux pannes c'était.
 *
 * Une redirection (session expirée) traverse (`estControleNext`) : elle n'est
 * pas un échec — React la rejette EXPRÈS côté client pour que
 * `RedirectBoundary` navigue.
 *
 * PRIX ASSUMÉ : `useActionState` reçoit du coup une fonction CLIENTE, donc
 * le formulaire perd sa cible de POST native (`$$FORM_ACTION`) — le geste
 * demande JS. Le tap d'avant hydratation, lui, reste rejoué par React.
 * Arbitrage tracé dans docs/conception-lot-n4-reactions.md §5.
 */
const PANNE_TRANSPORT =
  "Ta réaction s'est perdue en route\u00a0: retape-la, ou recharge la page.";

export async function reagir(
  precedent: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    return await reactionAction(precedent, formData);
  } catch (e) {
    if (estControleNext(e)) throw e;
    return { status: "error", error: PANNE_TRANSPORT, values: {} };
  }
}

/**
 * La rangée de RÉACTION d'UNE carte du fil (lot N4, maquette une-ligne
 * validée) : `[👏 Bravo ✓] Toi, Salomé D. et 3 autres` — le bouton dit le
 * geste, le compteur dit qui, l'ellipse coupe plutôt que de passer à la ligne.
 *
 * LE MOT SE DÉRIVE DE LA CARTE (retour de Cateline, « objectif : se
 * motiver ») : « Bravo » pour un accomplissement (une scène, un article de
 * membre), « Bienvenue » pour une arrivée dans l'annuaire — un mot faux
 * démotive, et trop de mots font se demander pourquoi on a CE bouton-là.
 *
 * RGAA :
 * - libellé visible STABLE pour une carte donnée ; l'état pressé = `aria-pressed` +
 *   coche ✓ + graisse, et il se LIT dans le compteur (« Toi, … ») — jamais
 *   la couleur seule (3.2) ;
 * - le nom accessible COMMENCE par le libellé visible et nomme la carte
 *   (« Bravo, Léa Marchand, sur scène », WCAG 2.5.3) ; emoji et coche
 *   décoratifs (`aria-hidden`) ;
 * - compteur en `role="status"` (il s'annonce, y compris sur SA carte — le
 *   canal de réception, sans bouton) ; échec en `role="alert"`, et le bouton
 *   optimiste REVIENT en le disant (jamais un rollback muet) ;
 * - pattern résultat (`useActionState` + `router.refresh()`, principes §4),
 *   `aria-disabled` pendant l'aller-retour (le focus reste sur le bouton).
 *
 * La rangée vit HORS du lien-carte (même patron que « Modifier » sur
 * `CarteActualite`) : aucun contrôle imbriqué dans un lien.
 */
export default function ReactionRow({
  cible,
  carteNom,
  reactions,
  mienne,
}: {
  cible: CibleReaction;
  /** Qui/quoi le bouton applaudit (complément sr-only du nom accessible). */
  carteNom: string;
  reactions?: ReactionsCarte;
  /** SA propre carte : le compteur s'affiche (elle reçoit), le bouton s'efface. */
  mienne: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    reagir,
    IDLE,
  );
  const router = useRouter();
  const base = reactions ?? { nb: 0, premiere: null, moi: false };
  const [optimiste, setOptimiste] = useState(base.moi);
  const alertRef = useRef<HTMLParagraphElement>(null);

  // Resynchronisation sur la vérité serveur pendant le rendu (motif « état
  // dérivé », comme SettingToggle) : le rafraîchissement post-succès réaligne.
  const [moiVu, setMoiVu] = useState(base.moi);
  if (base.moi !== moiVu && !pending) {
    // Jamais pendant un aller-retour local : un refresh PÉRIMÉ (calculé avant
    // le tap en vol) re-verrouillerait l'état que l'utilisatrice vient de
    // défaire. Les refresh sont sérialisés : le dernier réaligne toujours.
    setMoiVu(base.moi);
    setOptimiste(base.moi);
  }

  useEffect(() => {
    if (state.status === "success") router.refresh();
    else if (state.status === "error") setOptimiste(base.moi); // retour au réel, DIT par l'alerte
    // base.moi est la vérité serveur au moment du retour ; state déclenche.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, router]);

  // Région d'alerte vider-puis-remplir (annonce fiable, même message répété).
  useEffect(() => {
    const alert = alertRef.current;
    if (!alert) return;
    alert.textContent = "";
    if (state.status === "error") alert.textContent = state.error;
  }, [state]);

  // Compteur AFFICHÉ : la vérité serveur ajustée de l'optimiste (le tap se
  // voit tout de suite, le refresh confirme).
  const nbAffiche =
    base.nb + (optimiste && !base.moi ? 1 : 0) - (!optimiste && base.moi ? 1 : 0);
  const mot = MOTS[cible.type];
  const libelle = libelleReactions({
    nb: nbAffiche,
    premiere: base.premiere,
    moi: optimiste,
    type: cible.type,
  });

  return (
    <div className="relative z-10 mt-1 flex min-w-0 items-center gap-2">
      {!mienne && (
        <form
          action={formAction}
          className="shrink-0"
          onSubmit={(e) => {
            // Une seule garde : le submit couvre le clic comme le clavier.
            if (pending) return e.preventDefault();
            setOptimiste(!optimiste);
          }}
        >
          <input type="hidden" name="type" value={cible.type} />
          <input type="hidden" name="id" value={cible.id} />
          {/* L'intention AFFICHÉE au moment du tap : un double-submit rejoue
              la même intention (idempotent), jamais un bravo qui s'annule. */}
          <input type="hidden" name="intention" value={optimiste ? "retirer" : "applaudir"} />
          <button
            type="submit"
            aria-pressed={optimiste}
            aria-disabled={pending || undefined}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan aria-disabled:opacity-40 ${
              optimiste
                ? "border-magenta font-bold text-magenta"
                : "border-navy-lighter text-white hover:border-magenta/60"
            }`}
          >
            <span aria-hidden="true">{mot.emoji}</span>
            {mot.bouton}
            {optimiste && <span aria-hidden="true">✓</span>}
            <span className="sr-only">, {carteNom}</span>
          </button>
        </form>
      )}
      {/* Le compteur : du TEXTE, annoncé (role=status) — sur SA carte, c'est
          LE canal de réception de l'encouragement. */}
      <p
        role="status"
        aria-live="polite"
        className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-gray-light empty:hidden"
      >
        {libelle && (
          <>
            {libelle.visible}
            <span className="sr-only">{libelle.srOnly}</span>
          </>
        )}
      </p>
      <p ref={alertRef} role="alert" className="min-w-0 text-xs text-orange empty:hidden" />
    </div>
  );
}
