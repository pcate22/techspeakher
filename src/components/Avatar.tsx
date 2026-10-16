/* eslint-disable @next/next/no-img-element -- photo de compte externe (Google/LinkedIn), pas d'optimisation next/image (host/CSP). */
"use client";

import { useState } from "react";
import { initials } from "@/lib/initiales";

const SIZES = {
  // Onglet-photo de la barre basse : la plus petite pastille du site.
  xxs: "w-6 h-6 text-[10px]",
  xs: "w-8 h-8 text-xs",
  md: "w-14 h-14 text-lg",
  lg: "w-20 h-20 text-2xl",
  // Portrait de fiche : grand format (responsive) pour donner de la présence à
  // la speakeuse. ~160 px sur mobile, ~192 px à partir de sm.
  xl: "w-40 h-40 sm:w-48 sm:h-48 text-4xl",
} as const;

/** Avatar réutilisable : photo du compte, sinon initiales sur pastille. */
export default function Avatar({
  name,
  image,
  size = "md",
}: {
  name: string;
  image: string | null;
  size?: keyof typeof SIZES;
}) {
  const dim =
    size === "xl" ? 192 : size === "lg" ? 80 : size === "xs" ? 32 : size === "xxs" ? 24 : 56;
  // N'affiche une photo que si l'URL est http(s) : défense anti-XSS pour les
  // photo_url venant de la BDD (rendues sur des pages publiques cachées).
  const safeImage = image && /^https?:\/\//i.test(image.trim()) ? image : null;
  // Les URLs de photo des comptes externes (Google/LinkedIn) peuvent expirer ou
  // être bloquées : sans repli, on se retrouve avec un cercle vide. On retombe
  // alors sur les initiales, comme pour un profil sans photo.
  const [failed, setFailed] = useState(false);
  // Une image qui CHANGE (nouvelle photo déposée juste après un échec) doit
  // pouvoir retenter le chargement : sans ce repli, l'échec de l'ANCIENNE URL
  // restait figé sur la nouvelle, jamais essayée (ajustement pendant le rendu,
  // pattern React officiel — pas un `useEffect`, qui laisserait un rendu
  // intermédiaire aux initiales).
  const [imagePrecedente, setImagePrecedente] = useState(safeImage);
  if (safeImage !== imagePrecedente) {
    setImagePrecedente(safeImage);
    setFailed(false);
  }
  if (safeImage && !failed) {
    return (
      <img
        src={safeImage}
        alt=""
        aria-hidden="true"
        width={dim}
        height={dim}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`${SIZES[size]} rounded-full object-cover shrink-0 border border-navy-lighter`}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      // `magenta-light` et pas `magenta` : sur ce fond (magenta/20 sur navy),
      // le magenta plein tombe à 3,63:1 — sous le seuil AA (4,5:1) que l'audit
      // axe fait respecter. La variante claire monte à 4,9:1, et c'est déjà le
      // jeton que `TagBadge` emploie sur exactement ce fond.
      className={`${SIZES[size]} rounded-full shrink-0 bg-magenta/20 border border-magenta/40 flex items-center justify-center text-magenta-light font-bold`}
    >
      {initials(name)}
    </div>
  );
}
