/**
 * LE radio dessiné de la plateforme, en un seul exemplaire.
 *
 * Le radio natif, sur notre fond sombre, affiche les options NON cochées en
 * disque clair : plus voyant que l'option réellement choisie, qui se lit donc à
 * l'envers. On le remplace par un anneau vide, puis un disque cyan quand c'est
 * coché — et l'anneau de focus reste dessiné, le clavier devant voir où il est.
 *
 * Une CONSTANTE partagée parce que le piège a déjà été payé deux fois : la
 * chaîne vivait à l'identique dans `ChoixAudience` et `SettingChoice`, si bien
 * qu'un correctif de contraste appliqué à l'un laissait l'autre en arrière.
 * `mt-1` (alignement sur la première ligne d'un libellé à deux lignes) reste au
 * point d'appel : c'est de la mise en page, pas de l'apparence de contrôle.
 */
export const RADIO_DESSINE =
  "h-[18px] w-[18px] shrink-0 appearance-none rounded-full border-2 border-gray-light bg-transparent checked:border-cyan checked:bg-cyan checked:shadow-[inset_0_0_0_3px_var(--color-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-navy";
