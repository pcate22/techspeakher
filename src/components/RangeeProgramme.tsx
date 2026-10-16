import NavRow from "@/components/NavRow";
import InlineActionForm from "@/components/InlineActionForm";
import type { ActionState } from "@/lib/action-state";

/**
 * Une séance dans le PROGRAMME : sa rangée, et deux boutons pour la monter ou la
 * descendre d'un rang dans sa phase.
 *
 * Les boutons sont À CÔTÉ du lien, jamais dedans : imbriquer un bouton dans un
 * lien donne un composant que ni le clavier ni les lecteurs d'écran ne savent
 * décrire.
 *
 * Deux flèches plutôt qu'un glisser-déposer : au doigt, un drag sur une liste
 * qui défile est un pari, et au clavier c'est une fonctionnalité qu'on n'a pas.
 * Chaque bouton NOMME sa séance (RGAA 11.1 : quinze boutons « Monter » côte à
 * côte ne s'annoncent pas), et disparaît en bout de phase — il n'y a alors rien
 * à échanger, et un bouton inerte se cliquerait sans rien produire.
 */
export default function RangeeProgramme<S extends object>({
  href,
  titre,
  sousTitre,
  pastilles,
  badgesLabel,
  trailing,
  action,
  hidden,
  rang,
  total,
}: {
  href: string;
  titre: string;
  sousTitre?: string;
  pastilles?: string[];
  badgesLabel?: string;
  trailing?: React.ReactNode;
  action: (state: ActionState<S>, formData: FormData) => Promise<ActionState<S>>;
  hidden: Record<string, string | number>;
  /** Rang dans la phase, à partir de 1 : annoncé, et il borne les flèches. */
  rang: number;
  total: number;
}) {
  const fleche = (sens: "haut" | "bas", signe: string, verbe: string) => (
    <InlineActionForm
      action={action}
      hidden={{ ...hidden, sens }}
      submitLabel={signe}
      ariaLabel={`${verbe}\u00a0: ${titre} (rang ${rang} sur ${total})`}
      pendingLabel="…"
      variant="ghost"
      // Une flèche BORDÉE : un « ↓ » nu sur fond sombre passe pour un ornement,
      // pas pour une commande. Cible tactile 44 px (checklist COGA), sans le
      // rembourrage horizontal d'un bouton à libellé.
      boutonClassName="min-w-[44px] justify-center !px-0 border border-field-border hover:border-cyan"
      successMessage={`${titre} déplacée.`}
    />
  );

  return (
    <li className="flex items-center gap-1">
      <div className="min-w-0 flex-1">
        <NavRow
          href={href}
          title={`${rang}. ${titre}`}
          titleClamp={2}
          subtitle={sousTitre}
          pastilles={pastilles}
          badgesLabel={badgesLabel}
          trailing={trailing}
        />
      </div>
      {/* Colonne de rang : les deux flèches, alignées sur la rangée. */}
      {/* Les flèches BORDÉES : un « ↓ » nu sur fond sombre passe pour un
          ornement, pas pour une commande. */}
      <div className="flex shrink-0 flex-col gap-1">
        {/* Une flèche absente en bout de phase plutôt qu'inerte : il n'y a rien
            à échanger, et un bouton qui ne produit rien se clique quand même.
            La place reste réservée pour que les rangées gardent leur gabarit. */}
        {rang > 1 ? fleche("haut", "↑", "Monter") : <span className="block h-[44px] w-[44px]" />}
        {rang < total ? fleche("bas", "↓", "Descendre") : <span className="block h-[44px] w-[44px]" />}
      </div>
    </li>
  );
}
