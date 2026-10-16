// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { textesAffichables, fichiersSources } from "./copie-affichee";

/**
 * Cliquet anti-repousse sur la TYPOGRAPHIE DE L'ÉCRAN.
 *
 * `segment-label.test.tsx` garde un COMPOSANT ; la règle, elle, parle d'un
 * ÉCRAN. C'est le défaut qu'a relevé la revue d'accessibilité cognitive du
 * 2026-08-16 : `SegmentLabel` a bien été corrigé (casse gardée, `text-sm`,
 * `font-bold`, `cream`), mais il n'est appelé que sept fois, et la forme
 * condamnée survivait plus de quatre-vingts fois ailleurs — dont une bonne
 * moitié sur des `h2`/`h3`, c'est-à-dire sur le plan de lecture lui-même.
 * Rien n'empêchait la quatre-vingt-troisième.
 *
 * Deux formes sont condamnées, pour les raisons déjà écrites dans
 * `docs/principes-conception-ui.md` (checklist COGA) :
 *
 * - **le tout-capitale** : on reconnaît la SILHOUETTE d'un mot avant d'en lire
 *   les lettres, et les capitales l'effacent ; certains lecteurs d'écran
 *   épellent en prime le texte mis en capitales par CSS ;
 * - **les tailles sous 12 px** : `text-xs` (12 px) est le plancher, et une
 *   taille arbitraire en dessous (`text-[10px]`, `text-[0.6875rem]`) sort de
 *   l'échelle typographique — donc du contrôle.
 *
 * Le jugement porte sur les CHAÎNES du fichier, extraites par l'AST : une
 * classe Tailwind vit dans un littéral, un commentaire n'habille rien. Sans
 * cela, ce fichier-ci — qui doit bien écrire le mot « uppercase » quelque part
 * pour l'interdire — se condamnait lui-même, et le mot dans un commentaire
 * faisait échouer la CI (relecture du 2026-08-16). Même AST, même corpus et
 * même discipline que `mots-entiers.test.ts`, y compris les `.ts` : les
 * classes partagées (`onglet-barre.ts`) n'ont pas d'extension `.tsx`.
 *
 * Ce cliquet ne demande PAS de tout migrer d'un coup : la liste ci-dessous
 * gèle l'existant, et la CI échoue dès qu'un fichier HORS liste écrit une de
 * ces formes. Quand un fichier est repris, retirer sa ligne d'ici : le second
 * test garantit que la liste ne peut que RACCOURCIR — une entrée périmée
 * desserrerait le cliquet en silence.
 */

/** Tout-capitale posé par CSS. */
const CAPITALES = /\buppercase\b/;
/**
 * Taille arbitraire sous le plancher de 12 px. Les deux unités que Tailwind
 * accepte entre crochets : `text-[11px]` et `text-[0.6875rem]` (= 11 px) —
 * la seconde avait été oubliée, et `NavRow` la portait.
 */
const SOUS_LE_PLANCHER = /text-\[(?:(?:\d|1[01])(?:[.,]\d+)?px|0(?:[.,]\d+)?rem)\]/;

/**
 * Fichiers portant encore une de ces formes. À vider au fil de l'eau ;
 * la coquille d'app (profil, espace organisatrices, barre d'onglets, rangées,
 * pied) en est déjà sortie.
 *
 * Les deux entrées marquées « gabarit » ne portent pas de la copie mais la
 * taille d'un GLYPHE dans une pastille ronde (initiales d'un avatar, d'un
 * logo) : la règle du plancher de lecture ne s'y applique pas, elles restent
 * ici pour que le motif n'ait pas d'exception à connaître.
 */
const RESTANTS = new Set([
  "src/app/admin/contenus/[type]/[slug]/Editeur.tsx",
  "src/app/admin/contenus/[type]/[slug]/page.tsx",
  "src/app/admin/diffusion/page.tsx",
  "src/app/admin/messages/page.tsx",
  "src/app/admin/speakeuses/RosterFilter.tsx",
  "src/app/admin/speakeuses/page.tsx",
  "src/app/admin/speakeuses/relances/page.tsx",
  "src/app/admin/tremplins/[edition]/SujetEntete.tsx",
  "src/app/admin/tremplins/[edition]/ateliers/[atelier]/page.tsx",
  "src/app/admin/tremplins/[edition]/ateliers/[atelier]/sous-groupes/page.tsx",
  "src/app/admin/tremplins/[edition]/ateliers/page.tsx",
  "src/app/admin/tremplins/[edition]/page.tsx",
  "src/app/admin/tremplins/[edition]/participantes/[registration]/ateliers/page.tsx",
  "src/app/admin/tremplins/[edition]/participantes/[registration]/page.tsx",
  "src/app/admin/tremplins/[edition]/photos/[photo]/page.tsx",
  "src/app/admin/tremplins/page.tsx",
  "src/app/devfest-toulouse/page.tsx",
  "src/app/mon-espace/TalkSuggestions.tsx",
  "src/app/mon-espace/connexions/page.tsx",
  "src/app/mon-espace/documents/page.tsx",
  "src/app/mon-espace/fiche/page.tsx",
  "src/app/mon-espace/supprimer/page.tsx",
  "src/app/mon-espace/talks/page.tsx",
  "src/app/mon-espace/tremplin/[edition]/TremplinEspace.tsx",
  "src/app/mon-espace/tremplin/[edition]/page.tsx",
  "src/app/speakeuses/SpeakeusesFilter.tsx",
  "src/app/speakeuses/[id]/ModerationPanel.tsx",
  "src/app/speakeuses/[id]/page.tsx",
  "src/app/tremplin/[conf]/[annee]/montee-sur-scene/page.tsx",
  "src/app/tremplin/[conf]/[annee]/page.tsx",
  "src/app/tremplin/[conf]/page.tsx",
  "src/app/tremplin/page.tsx",
  "src/components/Avatar.tsx", // gabarit : initiales dans une pastille ronde
  "src/components/ChipGroup.tsx",
  "src/components/ConferenceLogo.tsx", // gabarit : initiales dans une pastille ronde
  "src/components/ContactStatusChip.tsx",
  "src/components/EcheanceCard.tsx",
  "src/components/EnTetePeriode.tsx",
  "src/components/FaitsAtelier.tsx",
  "src/components/Header.tsx",
  "src/components/ListeSection.tsx",
  "src/components/MotifBadge.tsx",
  "src/components/PitchedTalkPicker.tsx",
  "src/components/SceneCard.tsx",
  "src/components/SpeakeuseCard.tsx",
  "src/components/StickyNote.tsx",
  "src/components/TalkCard.tsx",
]);

const classesDe = (rel: string) =>
  textesAffichables(rel, readFileSync(resolve(process.cwd(), rel), "utf8"));

const formesCondamnees = (textes: string[]): string[] =>
  textes.flatMap((t) => [
    ...(CAPITALES.test(t) ? ["capitales"] : []),
    ...(SOUS_LE_PLANCHER.test(t) ? ["sous le plancher de 12 px"] : []),
  ]);

describe("typographie — l'écran reste lisible", () => {
  it("aucun NOUVEAU fichier ne met en capitales ni ne passe sous 12 px", () => {
    const nouveaux: string[] = [];
    for (const rel of fichiersSources()) {
      if (RESTANTS.has(rel)) continue;
      for (const forme of formesCondamnees(classesDe(rel))) {
        nouveaux.push(`${rel} — ${forme}`);
      }
    }
    expect(
      nouveaux,
      "Typographie condamnée (accessibilité cognitive : silhouette du mot, " +
        "plancher de lecture). Garder la casse du texte, rester dans " +
        "l'échelle (`text-xs` au plus petit) :\n" + nouveaux.join("\n"),
    ).toEqual([]);
  });

  it("la liste des fichiers restants reste juste (aucune ligne périmée)", () => {
    const perimes = [...RESTANTS].filter((rel) => {
      try {
        return formesCondamnees(classesDe(rel)).length === 0;
      } catch {
        return true; // fichier supprimé ou renommé
      }
    });
    expect(
      perimes,
      `Entrées à retirer de RESTANTS (reprises ou disparues) :\n${perimes.join("\n")}`,
    ).toEqual([]);
  });
});
