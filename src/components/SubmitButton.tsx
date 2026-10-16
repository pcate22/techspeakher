"use client";

import { useFormStatus } from "react-dom";
import Button from "@/components/Button";

/**
 * Bouton de soumission d'un formulaire Server Action : se désactive et affiche
 * un libellé d'attente pendant l'aller-retour (évite le double-clic et donne un
 * retour visible/audible). À utiliser DANS un <form action={...}>.
 */
export default function SubmitButton({
  children,
  pendingLabel,
  variant,
  size,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg" | "sm";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
