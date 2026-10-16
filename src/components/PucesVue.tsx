import Link from "next/link";

/**
 * Rangée de PUCES de filtre d'une liste à familles (« Tout · Pour moi · Pour
 * l'association… ») — le composant neuf de la conception D4. Ni `ChipGroup`
 * (des `<span>` décoratifs, sans lien) ni `BandeauVue` (un retour, pas un
 * choix) : ici chaque puce est une NAVIGATION complète, parce que le filtre
 * vit dans l'URL — il se partage, se recharge, revient avec le bouton Retour,
 * et la liste reste filtrable sans JS.
 *
 * - `aria-current="page"` sur la puce active : `page` et non `true`, parce que
 *   le `href` d'une puce active EST l'URL affichée, requête comprise. « Tout »
 *   pointe la page SANS paramètre, sinon cette identité ne colle plus.
 * - Un `<ul aria-label="Filtrer">`, jamais un `<nav>` : un second repère de
 *   navigation encombrerait la liste des repères qui sert à sauter (R8).
 * - L'état actif est doublé par la FORME — aplat plein contre contour — jamais
 *   par la seule teinte (WCAG 1.4.1). Le contour au repos est à `cyan/50`
 *   (3,81:1) : `cyan/30` donne 2,13:1, la moitié du seuil 1.4.11 (R3).
 * - Cible ≥ 44 px SANS le `-my-3` de `BandeauVue` : sur un lien nu, le
 *   débordement de la cible est invisible ; sur une puce bordée, la boîte
 *   entière se peint — la marge négative la ferait chevaucher la méta et la
 *   liste voisines. La rangée assume donc sa hauteur.
 */
export default function PucesVue<K extends string>({
  base,
  vues,
  active,
}: {
  /** L'URL de la page sans paramètre — le href de « Tout ». */
  base: string;
  /** Les vues offertes, dans l'ordre d'affichage (déjà intersectées par la
   * page avec les familles réellement chargées — jamais l'inverse). */
  vues: { cle: K; titre: string }[];
  /** La clé active, ou `null` quand la liste est entière (« Tout »).
   * Générique : un `active` étranger aux `vues` est une erreur de
   * compilation, pas un état silencieusement sans puce allumée. */
  active: K | null;
}) {
  const puces = [
    { cle: null as K | null, titre: "Tout", href: base },
    ...vues.map((v) => ({ cle: v.cle as K | null, titre: v.titre, href: `${base}?vue=${v.cle}` })),
  ];

  return (
    <ul aria-label="Filtrer" className="flex flex-wrap gap-2 list-none">
      {puces.map((p) => {
        const estActive = p.cle === active;
        return (
          <li key={p.cle ?? "tout"}>
            <Link
              href={p.href}
              aria-current={estActive ? "page" : undefined}
              className={`inline-flex min-h-[44px] items-center rounded-full px-4 text-sm focus-visible:outline-none focus-visible:ring-2 ${
                estActive
                  ? // Anneau BLANC sur l'aplat : un anneau cyan collé à un fond
                    // cyan se lirait comme « la puce a grossi », pas comme un
                    // focus (WCAG 2.4.7) — même choix que Button `primary`.
                    "bg-cyan font-medium text-navy focus-visible:ring-white"
                  : "border border-cyan/50 text-cyan hover:border-cyan focus-visible:ring-cyan"
              }`}
            >
              {p.titre}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
