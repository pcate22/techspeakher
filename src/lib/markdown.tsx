import Link from "next/link";
import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Components } from "react-markdown";
import { isSafeHttpUrl, isSafeInternalPath } from "@/components/ExternalLink";
import { LIEN_TEXTE } from "@/components/LienTexte";

/**
 * Rendu Markdown des contenus éditoriaux — config UNIQUE partagée par le rendu
 * public (pages) et l'aperçu de l'éditeur (admin). Sécurité :
 *
 * - `react-markdown` NE rend PAS le HTML brut (pas de `rehype-raw`) : un
 *   `<script>`/`<iframe>` collé dans le corps est traité comme du texte, jamais
 *   exécuté. `rehype-sanitize` est la défense en profondeur (allow-list stricte).
 * - Allow-list volontairement pauvre : pas de `h1` (réservé au titre de page,
 *   un seul par page — a11y + SEO), pas de `script`/`style`/`iframe`/`svg`, pas
 *   d'attributs `on*`. Les protocoles d'URL sûrs de `defaultSchema` (http,
 *   https, mailto) bloquent `javascript:`.
 * - Les liens externes s'ouvrent dans un nouvel onglet avec `rel="noopener"` et
 *   une mention `sr-only` (RGAA « nouvelle fenêtre »).
 *
 * Rappel éditeur : « Titre 1 » insère `##` (→ h2), « Titre 2 » `###` (→ h3).
 */
const schema = {
  ...defaultSchema,
  // On restreint aux seules balises éditoriales sûres (h1 EXCLU volontairement).
  tagNames: ["p", "h2", "h3", "strong", "em", "a", "ul", "ol", "li", "blockquote", "img", "br"],
};

// Lien du corps : la forme canonique vit dans LienTexte, d'où tout le site la
// tire. Elle était définie ici sans être exportée, et les pages la retapaient.
const lienCls = LIEN_TEXTE;

const components: Components = {
  // Titres : « Titre 1 » (##) → h2, « Titre 2 » (###) → h3. Bien démarqués du
  // corps (taille + graisse + blanc), sinon ils se confondent avec le texte.
  h2: ({ children }) => (
    <h2 className="text-xl sm:text-2xl font-bold text-white mt-8 mb-3">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg sm:text-xl font-bold text-white mt-6 mb-2">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-4">{children}</p>,
  ul: ({ children }) => <ul className="mb-4 list-disc pl-6 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 list-decimal pl-6 space-y-1">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="mb-4 border-l-4 border-cyan/40 pl-4 italic text-gray-light">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
  a({ href, children, ...rest }) {
    const h = typeof href === "string" ? href : "";
    if (isSafeHttpUrl(h)) {
      return (
        <a href={h} target="_blank" rel="noopener noreferrer" className={lienCls} {...rest}>
          {children}
          <span className="sr-only"> (nouvelle fenêtre)</span>
        </a>
      );
    }
    // Lien interne (chemin du site, ex. « /tremplin ») : navigation client via
    // next/link (pas de rechargement). Les autres schémas (mailto:, tel:, ancre
    // #) restent un <a> simple.
    if (isSafeInternalPath(h)) {
      return (
        <Link href={h} className={lienCls}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} className={lienCls} {...rest}>
        {children}
      </a>
    );
  },
  img({ src, alt }) {
    if (typeof src !== "string" || src === "") return null;
    // Image de corps : <img> simple (les domaines autorisés sont gérés par la
    // CSP, lot image). next/image est réservé à la couverture (dimensions connues).
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt ?? ""} className="my-4 max-w-full h-auto rounded-lg" />;
  },
};

/**
 * ATX indulgent : accepte un titre saisi SANS espace après les `#`
 * (`###Titre`), erreur de saisie fréquente que CommonMark rendrait en texte
 * brut « ###Titre ». On insère l'espace manquant devant `##`/`###` en tête de
 * ligne → h2/h3 (les seuls niveaux rendus, et ceux qu'insère la barre d'outils).
 *
 * Volontairement borné à 2–3 `#` : un `#` seul en tête de ligne (une énumération
 * « #1 priorité », un mot-dièse « #TechSpeakHer ») deviendrait un h1 — retiré
 * par l'assainissement — donc du texte AMPUTÉ de son `#`. On le laisse tel quel.
 * Uniquement en tête de ligne (`m`) : un `#` en milieu de phrase n'est jamais
 * touché ; un `#` déjà suivi d'une espace non plus.
 */
function normaliserTitres(corps: string): string {
  return corps.replace(/^(#{2,3})([^#\s])/gm, "$1 $2");
}

/**
 * Rend un corps Markdown assaini. `null` si le corps est vide (une publication
 * peut n'être qu'une annonce-lien, cf. conception §2). Le corps est en `cream`
 * (lisible sur fond sombre, cf. principes-conception-ui §9), les titres/liens
 * démarqués par les composants ci-dessus.
 */
export function MarkdownContenu({ corps }: { corps: string }) {
  if (!corps.trim()) return null;
  return (
    <div className="text-cream leading-relaxed [&>*:first-child]:mt-0">
      <ReactMarkdown rehypePlugins={[[rehypeSanitize, schema]]} components={components}>
        {normaliserTitres(corps)}
      </ReactMarkdown>
    </div>
  );
}
