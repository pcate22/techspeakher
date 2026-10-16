/* eslint-disable @next/next/no-img-element -- icône locale de 44 px (public/conferences),
   parfois en SVG : l'optimiseur next/image n'apporte rien ici et bloque les SVG. */
import { logoConference } from "@/data/logos-conferences";
import { initials } from "@/lib/initiales";

const TAILLES = {
  sm: { classe: "w-8 h-8 text-[11px]", px: 32 },
  md: { classe: "w-11 h-11 text-xs", px: 44 },
  lg: { classe: "w-14 h-14 text-sm", px: 56 },
} as const;

/**
 * Icône d'une conférence : son logo s'il est déposé (`public/conferences`,
 * déclaré dans `src/data/logos-conferences.ts`), sinon un **monogramme** (ses
 * initiales sur une pastille). Repère visuel qui rend lisible d'un coup d'œil
 * qu'un même talk a été donné à plusieurs endroits.
 *
 * L'icône est **décorative** (`alt=""`, `aria-hidden`) : le nom de la conférence
 * est toujours écrit juste à côté, l'annoncer deux fois n'apporte rien (RGAA 1.2).
 *
 * Fond blanc sous le logo : les logos sont dessinés pour un fond clair et
 * disparaîtraient sur le navy du site.
 */
export default function ConferenceLogo({
  nom,
  slug,
  taille = "md",
}: {
  nom: string;
  slug: string | null;
  taille?: keyof typeof TAILLES;
}) {
  const { classe, px } = TAILLES[taille];
  const logo = logoConference(slug);

  if (logo) {
    return (
      <img
        src={logo}
        alt=""
        aria-hidden="true"
        width={px}
        height={px}
        loading="lazy"
        decoding="async"
        className={`${classe} shrink-0 rounded-lg border border-field-border/60 bg-white object-contain p-1`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${classe} shrink-0 rounded-lg border border-field-border/60 bg-navy-lighter flex items-center justify-center font-bold text-cyan`}
    >
      {monogramme(nom)}
    </span>
  );
}

/**
 * Initiales de la MARQUE : le libellé figé d'une occurrence porte souvent
 * l'année (« Sunny Tech 2026 »), qui donnerait un monogramme « S2 ». On retire
 * l'année finale avant de calculer les initiales — « ST ».
 */
function monogramme(nom: string): string {
  return initials(nom.replace(/\s+(?:19|20)\d{2}$/, "").trim() || nom);
}
