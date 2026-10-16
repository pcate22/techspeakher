"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Button from "@/components/Button";
import { ChampsDeSection } from "../../ChampsSection";
import { libelleChamp, messageRefus } from "../../champs-profil";
import { useGardeSortie, DialogueSortie } from "../../GardeSortie";
import { useChampDegage, useBarreCollante } from "@/components/barre-action";
import { saveProfileSection, type SaveState } from "../../actions";
import { appliquerSaisieRefusee } from "@/lib/profil-saisie";
import { sectionParCle } from "@/lib/profil-sections";
import type { SpeakerProfile } from "@/lib/profiles";

/**
 * UNE section de la fiche, et rien d'autre : ses champs, un « Enregistrer ».
 * C'est la règle d'or du projet appliquée au profil — une page, un rôle, un CTA
 * principal — là où l'assistant de six étapes obligeait à re-parcourir tout le
 * formulaire pour corriger un mot.
 *
 * La section est LIÉE côté serveur (`bind`) : le formulaire ne la transporte
 * pas, et l'action la revalide de toute façon pour borner les colonnes écrites
 * (cf. `saveProfileSection`).
 *
 * Le retour se fait par le fil d'Ariane, comme partout ailleurs — la garde de
 * sortie l'intercepte, donc une saisie en cours ne part jamais en silence.
 */
export default function SectionForm({
  cle,
  initial,
  nom,
  linkedinLie = false,
}: {
  cle: string;
  initial: SpeakerProfile | null;
  nom: string;
  /** LinkedIn rattaché : ouvre la reprise de photo dans la section identité. */
  linkedinLie?: boolean;
}) {
  const enregistrerSection = saveProfileSection.bind(null, cle);
  const [state, action, pending] = useActionState<SaveState, FormData>(
    enregistrerSection,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const recapRef = useRef<HTMLDivElement>(null);

  // Refus de saisie côté navigateur, rendu VISIBLE dans le même canal que les
  // erreurs serveur (champ → message) : un message ne peut donc pas s'afficher
  // sous un autre champ que le sien.
  const [refus, setRefus] = useState<{ champ: string; message: string } | null>(null);
  const erreurs = state.errors ?? (refus ? { [refus.champ]: refus.message } : undefined);

  const [modifie, setModifie] = useState(false);
  const { sortieVoulue, setSortieVoulue, rendreLeFocus } = useGardeSortie(modifie);
  // La barre ne doit jamais masquer le champ qu'on vient d'atteindre, et elle ne
  // colle que si le formulaire dépasse l'écran.
  useChampDegage(formRef);
  const collante = useBarreCollante(formRef);

  // La saisie REFUSÉE revient à l'écran : le formulaire se ré-affichait sinon
  // depuis la base, donc le message « essaies-en une autre » se lisait à côté
  // d'un champ qui avait repris l'ancienne valeur. La fusion se fait en amont,
  // dans le profil rendu, pour ne pas la recopier sur chaque champ.
  const champsSection = sectionParCle(cle)?.champs ?? [];
  const aAfficher = appliquerSaisieRefusee(initial, state.valeurs, champsSection);

  // Et le focus va au premier champ en cause. Le refus NAVIGATEUR le faisait
  // déjà (`invalide.focus()`), le refus SERVEUR laissait le focus sur `body` :
  // deux chemins pour la même erreur, deux comportements (WCAG 2.4.3, 3.3.1).
  useEffect(() => {
    const premier = state.errors && Object.keys(state.errors)[0];
    if (!premier) return;
    const champ = formRef.current?.querySelector<HTMLElement>(
      `[name="${CSS.escape(premier)}"]`,
    );
    // Un champ peut être en erreur SANS être rendu par la section (une adresse
    // déjà prise refusée depuis une autre page) : le récapitulatif en tête tient
    // alors le rôle, et il porte déjà `role="alert"`.
    (champ ?? recapRef.current)?.focus();
  }, [state]);

  function enregistrer() {
    const form = formRef.current;
    if (!form) return;
    // `:invalid` sur les CONTRÔLES : un `querySelector(":invalid")` nu matcherait
    // aussi les <fieldset> qui en contiennent un.
    const invalide = form.querySelector<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("input:invalid, textarea:invalid, select:invalid");
    if (invalide) {
      setRefus({ champ: invalide.name, message: messageRefus(invalide) });
      invalide.focus();
      return;
    }
    setRefus(null);
    setModifie(false);
    form.requestSubmit();
  }

  return (
    <>
      <form
        ref={formRef}
        action={action}
        onSubmit={() => setModifie(false)}
        onChange={(e) => {
          setModifie(true);
          const champ =
            e.target instanceof HTMLElement ? e.target.getAttribute("name") : null;
          setRefus((r) => (r && r.champ === champ ? null : r));
        }}
        className="flex flex-col gap-4"
      >
        {/* Récapitulatif d'erreurs en tête (WCAG 3.3.1) avec les MESSAGES, pas
            seulement les intitulés : sur une page d'une seule section, une
            erreur peut porter sur un champ que la section ne rend pas (une
            adresse déjà prise, par exemple) — n'afficher que l'intitulé la
            rendrait muette. Chaque champ garde son message en place. */}
        {erreurs && (
          <div
            ref={recapRef}
            role="alert"
            tabIndex={-1}
            className="text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          >
            <p className="font-semibold">À corriger&nbsp;:</p>
            <ul className="mt-1 list-disc pl-5">
              {Object.entries(erreurs).map(([champ, message]) => (
                <li key={champ}>
                  {libelleChamp(champ)}&nbsp;— {message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <ChampsDeSection
          cle={cle}
          initial={aAfficher}
          nom={nom}
          linkedinLie={linkedinLie}
          erreurs={erreurs}
        />

        {/* Barre d'action ancrée QUAND il le faut : sur une liste de quinze
            cases, le CTA sortait de l'écran dès la troisième — mais sur une
            section qui tient à l'écran (l'attestation, une case), elle se pose
            simplement en fin de formulaire.

            SANS contour : bordée, arrondie et ombrée, elle se lisait comme une
            carte de plus, une boîte vide autour d'un bouton, juste sous des
            cases à cocher qui, elles, sont bel et bien encadrées. Le fond
            OPAQUE suffit à séparer le CTA du texte qui défile derrière — à
            95 %, sans bordure pour la délimiter, on devinait la case du
            dessous. Le `px-4` part avec la carte : le bouton s'aligne enfin sur
            les champs. */}
        <div
          className={`${collante ? "barre-action-collante " : ""}flex flex-wrap items-center gap-3 bg-navy py-3`}
        >
          {/* type="button" : l'enregistrement est déclenché explicitement, ce qui
              neutralise une soumission accidentelle à la touche Entrée. */}
          <Button type="button" size="sm" disabled={pending} onClick={enregistrer}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </form>

      <DialogueSortie
        rendreLeFocus={rendreLeFocus}
        sortieVoulue={sortieVoulue}
        setSortieVoulue={setSortieVoulue}
        onQuitter={() => setModifie(false)}
      />
    </>
  );
}
