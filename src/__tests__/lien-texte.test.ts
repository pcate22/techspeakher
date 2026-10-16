// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Cliquet anti-repousse sur la classe du lien texte.
 *
 * La forme canonique du lien en ligne vit dans `src/components/LienTexte.tsx`
 * (`LIEN_TEXTE`, et le composant `LienTexte` pour les destinations internes ;
 * `SiteLink` tient les externes). Elle a longtemps été définie sans être
 * exportée, et les pages la retapaient : 82 occurrences en 12 variantes, qui
 * divergeaient sur le soulignement, la transition et surtout l'anneau de focus,
 * redéclaré à la main à chaque fois. Deux liens voisins pouvaient donc réagir
 * différemment au clavier.
 *
 * Ce test ne demande pas de tout migrer d'un coup : certains fichiers de la
 * liste ci-dessous utilisent la couleur pour autre chose qu'un lien de prose
 * (`Button` en variante ghost, `Breadcrumb`, `LienRetour`, `ClearableInput`).
 * Il interdit seulement d'en AJOUTER : tout fichier hors liste qui écrit la
 * classe à la main fait échouer la CI.
 *
 * Quand un fichier passe à `LienTexte` / `LIEN_TEXTE`, retirer sa ligne d'ici.
 * La liste ne doit que raccourcir.
 */

const MOTIF = /text-cyan hover:text-cyan-light/;

/** Fichiers portant encore la classe à la main. À vider au fil de l'eau. */
const RESTANTS = new Set([
  "src/app/actualites/page.tsx",
  "src/app/admin/contenus/[type]/[slug]/page.tsx",
  "src/app/admin/reglages/[cle]/page.tsx",
  "src/app/admin/tremplins/[edition]/ateliers/[atelier]/documents/page.tsx",
  "src/app/admin/tremplins/[edition]/ateliers/[atelier]/presences/page.tsx",
  "src/app/admin/tremplins/[edition]/ateliers/[atelier]/sous-groupes/page.tsx",
  "src/app/admin/tremplins/[edition]/finale/page.tsx",
  "src/app/admin/tremplins/[edition]/infos/page.tsx",
  "src/app/admin/tremplins/[edition]/participantes/[registration]/ateliers/page.tsx",
  "src/app/admin/tremplins/[edition]/participantes/[registration]/classement/page.tsx",
  "src/app/admin/tremplins/[edition]/participantes/[registration]/coaching/page.tsx",
  "src/app/admin/tremplins/[edition]/participantes/[registration]/compte/page.tsx",
  "src/app/admin/tremplins/[edition]/participantes/[registration]/documents/page.tsx",
  "src/app/admin/tremplins/[edition]/participantes/[registration]/page.tsx",
  "src/app/admin/tremplins/[edition]/participantes/[registration]/parcours/page.tsx",
  "src/app/admin/tremplins/[edition]/participantes/[registration]/recompenses/page.tsx",
  "src/app/admin/tremplins/[edition]/participantes/[registration]/retrait/page.tsx",
  "src/app/admin/tremplins/[edition]/participantes/[registration]/talk/[talkId]/page.tsx",
  "src/app/admin/tremplins/[edition]/participantes/[registration]/talk/nouveau/page.tsx",
  "src/app/admin/tremplins/[edition]/participantes/[registration]/talk/page.tsx",
  "src/app/admin/tremplins/[edition]/participantes/[registration]/visibilite/page.tsx",
  "src/app/admin/tremplins/[edition]/photos/[photo]/page.tsx",
  "src/app/admin/tremplins/[edition]/recompenses/[recompense]/beneficiaire/page.tsx",
  "src/app/admin/tremplins/[edition]/recompenses/[recompense]/intitule/page.tsx",
  "src/app/admin/tremplins/[edition]/recompenses/[recompense]/retrait/page.tsx",
  "src/app/admin/tremplins/[edition]/recompenses/[recompense]/suivi/page.tsx",
  "src/app/admin/tremplins/[edition]/retrait/page.tsx",
  "src/app/admin/tremplins/[edition]/statut/page.tsx",
  "src/app/contact/page.tsx",
  "src/app/devfest-toulouse/page.tsx",
  "src/app/mon-espace/fiche/page.tsx",
  "src/app/mon-espace/tremplin/[edition]/page.tsx",
  "src/app/partenaires/page.tsx",
  "src/app/speakeuses/SpeakeusesFilter.tsx",
  "src/app/tremplin/[conf]/[annee]/page.tsx",
  "src/app/tremplin/page.tsx",
  "src/components/Accompagnantes.tsx",
  "src/components/Breadcrumb.tsx",
  "src/components/Button.tsx",
  "src/components/ClearableInput.tsx",
  "src/components/ConsentJournal.tsx",
  "src/components/DocList.tsx",
  "src/components/LienRetour.tsx",
  "src/components/PersonPicker.tsx",
  "src/components/RecitConference.tsx",
  "src/components/SiteLink.tsx",
]);

function fichiersTsx(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...fichiersTsx(p));
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("lien texte — une seule forme canonique", () => {
  it("aucun NOUVEAU fichier ne réécrit la classe à la main", () => {
    const nouveaux: string[] = [];
    for (const f of fichiersTsx(resolve(process.cwd(), "src"))) {
      const rel = f.slice(f.indexOf("src/"));
      if (RESTANTS.has(rel)) continue;
      const src = readFileSync(f, "utf8");
      src.split("\n").forEach((ligne, i) => {
        if (MOTIF.test(ligne)) nouveaux.push(`${rel}:${i + 1}`);
      });
    }
    expect(
      nouveaux,
      "Classe de lien réécrite à la main. Utiliser `LienTexte` (interne), " +
        "`SiteLink` (externe) ou `LIEN_TEXTE` :\n" +
        nouveaux.join("\n"),
    ).toEqual([]);
  });

  it("la liste des fichiers restants reste juste (aucune ligne périmée)", () => {
    // Une entrée qui ne porte plus la classe doit sortir de la liste, sinon le
    // cliquet se desserre en silence et un fichier migré redevient permissif.
    const perimes = [...RESTANTS].filter((rel) => {
      try {
        return !MOTIF.test(readFileSync(resolve(process.cwd(), rel), "utf8"));
      } catch {
        return true; // fichier supprimé ou renommé
      }
    });
    expect(
      perimes,
      `Entrées à retirer de RESTANTS (migrées ou disparues) :\n${perimes.join("\n")}`,
    ).toEqual([]);
  });
});
