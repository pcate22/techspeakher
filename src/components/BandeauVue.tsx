import Link from "next/link";

/**
 * Bandeau d'une liste en VUE FILTRÉE (cf. `src/lib/vue-liste.ts`) : il dit ce
 * qu'on regarde, combien, et laisse revenir à tout d'un tap. Sans lui, une liste
 * réduite par une URL passerait pour la liste entière.
 */
export default function BandeauVue({
  titre,
  resume,
  hrefTout,
  libelleTout,
}: {
  titre: string;
  /** Ce que la vue retient (« 3 ateliers sur 15 »), ou ce qui EST vrai si elle
   * ne retient rien (« Tous les ateliers ont une date. »). */
  resume: string;
  hrefTout: string;
  libelleTout: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl border border-cyan/30 bg-cyan/8 px-4 py-2.5">
      <p className="text-sm font-medium text-white">
        Vue&nbsp;: {titre}{" "}
        <span className="font-normal text-gray-light">· {resume}</span>
      </p>
      <Link
        href={hrefTout}
        // Cible tactile ≥ 44 px (checklist COGA) sans pousser la mise en page.
        className="inline-flex min-h-[44px] items-center py-3 -my-3 text-sm text-cyan underline underline-offset-2 hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
      >
        {libelleTout}
      </Link>
    </div>
  );
}
