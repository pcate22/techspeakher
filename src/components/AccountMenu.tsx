"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { signOut } from "next-auth/react";
import Avatar from "@/components/Avatar";

type AccountUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

const itemClass =
  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white cursor-pointer outline-none data-[highlighted]:bg-navy-lighter focus-visible:bg-navy-lighter";

/**
 * Menu de compte (header, desktop) — le pendant de l'onglet-photo de la barre
 * basse (conception N1, Q1 tranchée) : Ma fiche, Mon espace, Mon profil,
 * Réglages, Se déconnecter. « Ma fiche » en tête depuis le 2026-10-15 (refonte
 * de la navigation connectée) : c'est LE geste du produit, et l'onglet-photo y
 * mène désormais. Dans l'espace, le rail porte la navigation complète ; ce
 * menu reste la porte vers l'app depuis le site public. Les portes de rôle
 * (coachées, tableau de bord orga…) vivent sur « Mon profil » et dans le rail.
 *
 * Comportement accessible délégué à Radix (aria-haspopup/expanded, role
 * menu/menuitem, clavier, focus, Échap + clic extérieur).
 */
export default function AccountMenu({ user }: { user: AccountUser }) {
  const nom = user.name ?? user.email ?? "Mon compte";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Mon compte, ${nom}`}
          className="flex items-center gap-2 bg-navy-light border border-navy-lighter rounded-full pl-1 pr-3 py-1 hover:border-cyan/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan transition-colors"
        >
          <Avatar name={nom} image={user.image ?? null} size="xs" />
          <span className="text-sm font-medium text-white max-w-28 truncate">
            {user.name?.split(" ")[0] ?? "Compte"}
          </span>
          <span aria-hidden="true" className="text-xs text-gray-light">
            ▾
          </span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="w-60 bg-navy-light border border-navy-lighter rounded-xl p-1.5 shadow-sticky z-50"
        >
          <DropdownMenu.Label className="px-3 pt-2 pb-2 border-b border-navy-lighter mb-1.5">
            <span className="block text-sm font-bold text-white truncate">{nom}</span>
            {user.email && (
              <span className="block text-xs text-gray-light truncate">
                {user.email}
              </span>
            )}
          </DropdownMenu.Label>

          <DropdownMenu.Item asChild>
            <Link href="/mon-espace/fiche" className={itemClass}>
              Ma fiche
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link href="/mon-espace" className={itemClass}>
              Mon espace
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link href="/mon-espace/profil" className={itemClass}>
              Mon profil
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link href="/mon-espace/reglages" className={itemClass}>
              Réglages
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="h-px bg-navy-lighter my-1.5 mx-1" />

          <DropdownMenu.Item
            onSelect={() => signOut({ callbackUrl: "/" })}
            className={`${itemClass} text-gray-light`}
          >
            Se déconnecter
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
