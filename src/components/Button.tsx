import Link from "next/link";
import { relSortant } from "@/components/ExternalLink";

const base =
  "inline-flex items-center justify-center font-semibold rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60 disabled:cursor-not-allowed";

const variants = {
  primary:
    "bg-magenta hover:bg-magenta-light text-navy focus-visible:ring-white",
  secondary:
    "border-2 border-cyan text-cyan hover:bg-cyan hover:text-navy focus-visible:ring-cyan",
  ghost:
    "text-cyan hover:text-cyan-light focus-visible:ring-cyan",
  danger:
    "border-2 border-orange text-orange hover:bg-orange hover:text-navy focus-visible:ring-orange",
} as const;

const sizes = {
  md: "px-8 py-3",
  lg: "px-10 py-4 text-lg font-bold",
  // min-h 44px : LA cible tactile minimale du projet (checklist COGA) — posée
  // ici pour couvrir tous les boutons sm, y compris les ghost-liens « Voir tout… ».
  sm: "px-4 py-2 text-sm min-h-[44px]",
} as const;

type CommonProps = {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
  children: React.ReactNode;
  /**
   * Intitulé accessible explicite (ex. une action répétée dans une liste :
   * « Modifier » ×N pour N destinations). COMMUN aux deux branches — déclaré
   * du seul côté bouton, il était accepté par le type sur un lien et jeté au
   * rendu, donc l'appelante croyait avoir nommé son lien.
   */
  "aria-label"?: string;
};

type LinkProps = CommonProps & {
  href: string;
  external?: boolean;
  /** Lien saisi par une utilisatrice : `rel="ugc nofollow"`. Voir `ExternalLink`. */
  ugc?: boolean;
  /**
   * Lien vers un FICHIER à enregistrer (kit de communication). `next/link`
   * naviguerait vers lui et le préchargerait comme une page : on rend un
   * `<a download>` nu. L'intitulé annonce format et poids (RGAA 6.1).
   */
  download?: boolean;
};

type ButtonElProps = CommonProps & {
  href?: undefined;
  type?: "button" | "submit";
  disabled?: boolean;
  /** Reçoit l'évènement : un bouton bloqué par `aria-disabled` doit pouvoir
   * `preventDefault()` la soumission (cf. ConfirmSubmitButton). */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Couple name/value soumis quand CE bouton déclenche le form (multi-CTA). */
  name?: string;
  value?: string;
  /** Server Action ciblée par CE bouton (multi-soumission d'un même form). */
  formAction?: (formData: FormData) => void | Promise<void>;
  /** Requis quand le bouton sert de déclencheur Radix (`asChild`) : sans ref,
   * l'autofocus à l'ouverture et la restitution du focus à la fermeture
   * tombent à l'eau (refs internes de Radix restées null). */
  ref?: React.Ref<HTMLButtonElement>;
  /** Divulgation accessible (ex. bouton qui ouvre une zone). */
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
  "aria-haspopup"?: React.AriaAttributes["aria-haspopup"];
  /** Bloqué SANS sortir du parcours clavier (un `disabled` matériel rendrait le
   * bouton introuvable au lecteur d'écran). À coupler à un `preventDefault`. */
  "aria-disabled"?: boolean;
  /** Ce qu'on attend du bouton, quand le libellé seul ne suffit pas. */
  "aria-describedby"?: string;
};

type ButtonProps = LinkProps | ButtonElProps;

export default function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    className = "",
    children,
  } = props;
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`;

  // Bouton de formulaire (pas de href) : <button type="submit" | "button">
  if (props.href === undefined) {
    // Destructuré pour que la règle react-hooks/refs voie une TRANSMISSION de
    // ref (React 19, ref-en-prop), pas une lecture de .current en rendu.
    const {
      ref,
      type,
      disabled,
      onClick,
      name,
      value,
      formAction,
      "aria-expanded": ariaExpanded,
      "aria-controls": ariaControls,
      "aria-haspopup": ariaHaspopup,
      "aria-label": ariaLabel,
      "aria-disabled": ariaDisabled,
      "aria-describedby": ariaDescribedBy,
    } = props;
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        disabled={disabled}
        onClick={onClick}
        name={name}
        value={value}
        formAction={formAction}
        aria-expanded={ariaExpanded}
        aria-controls={ariaControls}
        aria-haspopup={ariaHaspopup}
        aria-label={ariaLabel}
        aria-disabled={ariaDisabled}
        aria-describedby={ariaDescribedBy}
        className={cls}
      >
        {children}
      </button>
    );
  }

  // `aria-label` vaut pour un LIEN autant que pour un bouton : sans lui ici, un
  // « Modifier » répété d'une carte à l'autre restait « Modifier » pour la
  // synthèse, et le nom fourni par l'appelante disparaissait en silence — aucun
  // type ne s'en plaignait, la prop étant déclarée pour les deux branches.
  const ariaLabelLien = props["aria-label"];

  if (props.external) {
    return (
      <a
        href={props.href}
        target="_blank"
        rel={relSortant({ ugc: props.ugc })}
        // Le lien sortant ANNONCE déjà la nouvelle fenêtre par un `sr-only` ;
        // un `aria-label` la remplacerait, donc on l'y intègre (même règle que
        // `ExternalLink`).
        aria-label={ariaLabelLien ? `${ariaLabelLien} (s'ouvre dans un nouvel onglet)` : undefined}
        className={cls}
      >
        {children}
        <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
      </a>
    );
  }

  if (props.download) {
    return (
      <a href={props.href} download className={cls} aria-label={ariaLabelLien}>
        {children}
      </a>
    );
  }

  return (
    <Link href={props.href} className={cls} aria-label={ariaLabelLien}>
      {children}
    </Link>
  );
}
