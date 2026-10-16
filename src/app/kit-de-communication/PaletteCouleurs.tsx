"use client";

import { useRef, useState } from "react";
import Button from "@/components/Button";
import type { GroupeCouleurs } from "@/data/kit-communication";

/**
 * La palette du kit, codes hexadécimaux copiables d'un geste.
 *
 * Le bouton PORTE le code (« #5FECDE », copié sans son « # », voir `copier`), et
 * dix boutons « Copier » indistincts sont proscrits
 * (`docs/principes-conception-ui.md` §6). Le nom de la couleur est ajouté pour
 * la synthèse vocale, devant le code visible (WCAG 2.5.3, l'étiquette visible
 * reste dans le nom).
 *
 * Le résultat est DIT dans une seule région vivante pour toute la palette :
 * une copie silencieuse ressemble à une panne (même motif que
 * `PartagerFiche`). Si le presse-papiers refuse (contexte non sécurisé,
 * permission), on sélectionne le code à l'écran : la copie manuelle reste à un
 * raccourci.
 */
export default function PaletteCouleurs({ groupes }: { groupes: GroupeCouleurs[] }) {
  const [message, setMessage] = useState("");
  /** La couleur qui vient d'être copiée : son bouton le montre à l'œil (« Copié », ou « Sélectionné » si le presse-papiers refuse), la
   *  région vivante le dit à l'oreille. */
  const [etat, setEtat] = useState<{ hex: string; libelle: string } | null>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout>>(null);

  const dire = (texte: string, hex: string, libelle: string) => {
    // Une région vivante n'annonce que ce qui CHANGE : deux copies du même
    // code de suite laissaient la seconde muette. On vide, puis on écrit,
    // 60 ms plus tard : un `requestAnimationFrame` ne part pas quand la page
    // ne se peint pas (onglet en arrière-plan, certains navigateurs
    // embarqués), et le message restait vide ; un délai court laisse aussi
    // à NVDA et JAWS le temps de voir le changement.
    setMessage("");
    setTimeout(() => setMessage(texte), 60);
    setEtat({ hex, libelle });
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => {
      setMessage("");
      setEtat(null);
    }, 4000);
  };

  // On copie le code SANS « # » : Canva, Figma et la plupart des champs
  // couleur l'ajoutent eux-mêmes, et un « # » collé en double bloque la
  // saisie. L'écran garde « #5FECDE », la forme qu'on lit.
  const copier = async (hex: string, nom: string, code: HTMLElement | null) => {
    const valeur = hex.replace(/^#/, "");
    try {
      await navigator.clipboard.writeText(valeur);
      dire(`Code ${valeur} copié (${nom}).`, hex, "Copié");
    } catch {
      const texte = code?.firstChild;
      if (texte) {
        const plage = document.createRange();
        plage.setStart(texte, hex.length - valeur.length);
        plage.setEnd(texte, hex.length);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(plage);
      }
      dire(`Le code ${valeur} est sélectionné\u00A0: il reste à le copier avec le clavier.`, hex, "Sélectionné");
    }
  };

  return (
    <>
      {groupes.map((g) => {
        const idGroupe = `couleurs-${g.titre.toLowerCase()}`;
        return (
          <div key={g.titre} className="mb-10 last:mb-0">
            <h3 id={idGroupe} className="text-lg font-bold text-white mb-4">
              {g.titre}
            </h3>
            <ul
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none"
              role="list"
              aria-labelledby={idGroupe}
            >
              {g.couleurs.map((c) => (
                <li
                  key={c.token}
                  className="bg-navy border border-navy-lighter rounded-xl p-4 flex gap-4"
                >
                  {/* Pastille décorative : le nom et le code disent la couleur.
                      Contour `field-border` pour que le violet nuit se
                      détache de la carte. */}
                  <span
                    aria-hidden="true"
                    className="w-14 h-14 shrink-0 rounded-lg border border-field-border"
                    style={{ backgroundColor: c.hex }}
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-white">{c.nom}</p>
                    {/* Bouton fantôme du design système ; le retrait
                        aligne le code sur le nom, malgré la marge de la
                        cible tactile (44 px). */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-4 gap-2"
                      onClick={(e) =>
                        copier(c.hex, c.nom, e.currentTarget.querySelector("code"))
                      }
                    >
                      <span className="sr-only">Copier le code de la couleur {c.nom}</span>{" "}
                      <code className="font-mono font-semibold">{c.hex}</code>
                      <span aria-hidden="true" className="text-sm">
                        {etat?.hex === c.hex ? etat.libelle : "Copier"}
                      </span>
                    </Button>
                    <p className="text-sm text-gray-light">{c.usage}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <p role="status" aria-live="polite" className="mt-4 text-sm text-cyan min-h-5">
        {message}
      </p>
    </>
  );
}
