import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

import Button from "@/components/Button";
import ProgressBar from "@/components/ProgressBar";
import Breadcrumb from "@/components/Breadcrumb";
import SpeakeuseCard from "@/components/SpeakeuseCard";
import TalkCard from "@/components/TalkCard";
import VideoCard from "@/components/VideoCard";
import RecitConference from "@/components/RecitConference";
import type { Talk } from "@/lib/talks";
import { makeProfile, makeOccurrence } from "./test-helpers";

/**
 * Scan a11y AUTOMATISÉ (axe) des composants clés, en complément des tests
 * d'attributs manuels : axe attrape les violations RGAA génériques (rôles
 * incohérents, labels manquants, imbrications interdites…) qu'une assertion
 * ciblée ne voit pas. Chaque composant est rendu dans une landmark <main> pour
 * ne pas déclencher la règle « region » (bruit propre au rendu isolé).
 *
 * Note : axe ne peut pas évaluer le contraste des couleurs sous jsdom (pas de
 * moteur de rendu) ; cette dimension reste couverte par la revue visuelle.
 */

expect.extend(toHaveNoViolations);
afterEach(cleanup);

/** Rend un nœud dans une landmark + un titre, puis renvoie le container à scanner. */
function renderPage(node: React.ReactNode): HTMLElement {
  const { container } = render(
    <main>
      <h1>Page de test</h1>
      {node}
    </main>,
  );
  return container;
}

const talk: Talk = {
  id: 1,
  profileId: 2,
  titre: "L'IA à l'épreuve du monde physique",
  type: "Conférence",
  description: "Un retour d'expérience.",
  occurrences: [
    makeOccurrence({
      id: 11,
      conferenceId: 3,
      conferenceSlug: "devfest-toulouse",
      conference: "DevFest",
      lienConf: "https://conf.example",
      lienVideo: "https://video.example",
    }),
  ],
};

describe("a11y (axe) — composants clés sans violation", () => {
  it("Button (lien et bouton)", async () => {
    const c = renderPage(
      <>
        <Button href="/x">Aller</Button>
        <Button>Valider</Button>
      </>,
    );
    expect(await axe(c)).toHaveNoViolations();
  });

  it("ProgressBar", async () => {
    const c = renderPage(<ProgressBar value={42} label="Profil complété" />);
    expect(await axe(c)).toHaveNoViolations();
  });

  it("Breadcrumb", async () => {
    const c = renderPage(
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Mon espace", href: "/mon-espace" },
          { label: "Mes talks" },
        ]}
      />,
    );
    expect(await axe(c)).toHaveNoViolations();
  });

  it("SpeakeuseCard (statique et cliquable)", async () => {
    const profile = makeProfile({ id: 12 });
    const c = renderPage(
      <ul>
        <li>
          <SpeakeuseCard profile={profile} />
        </li>
        <li>
          <SpeakeuseCard profile={profile} href="/speakeuses/12" />
        </li>
      </ul>,
    );
    expect(await axe(c)).toHaveNoViolations();
  });

  it("VideoCard (avec vignette et sans)", async () => {
    const video = {
      id: "v1",
      title: "La soirée Tremplin 2026",
      description: "8 finalistes, un jury.",
      url: "https://youtu.be/Ac6rI2Bg-jE",
      date: "4 juin 2026",
      duree: "1 h 42",
    };
    // La carte vit sous le titre d'une section (« Revoir la soirée ») : son
    // titre est un h3, on la scanne dans ce plan de titres, pas à plat.
    const c = renderPage(
      <section aria-labelledby="videos-title">
        <h2 id="videos-title">Revoir la soirée</h2>
        <ul>
          <li>
            <VideoCard video={video} />
          </li>
          <li>
            {/* URL illisible : la carte tombe sur sa couverture de repli. */}
            <VideoCard
              video={{ ...video, id: "v2", url: "https://exemple.test/x" }}
            />
          </li>
        </ul>
      </section>,
    );
    expect(await axe(c)).toHaveNoViolations();
  });

  /**
   * Le récit d'une conférence n'a AUCUNE couverture axe en vrai navigateur : la
   * page qui entre dans le gate E2E rend sans BDD, donc le bloc y est toujours
   * absent, et la page d'édition n'y entre pas du tout (elle exige Postgres).
   * Ce scan est la seule vérification automatisée de sa structure — le contraste,
   * lui, reste hors de portée de jsdom.
   */
  it("RecitConference (avec chapô et sans)", async () => {
    const recit = {
      slug: "devfest-toulouse-2025-ca-a-marche",
      titre: "DevFest Toulouse 2025 : ça a marché !",
      chapo: "2025 était déjà un tremplin.",
    };
    for (const r of [recit, { ...recit, chapo: null }]) {
      const { container } = render(
        <RecitConference recit={r} headingId="recit-title" />,
      );
      expect(await axe(container)).toHaveNoViolations();
      cleanup();
    }
  });

  it("TalkCard (gestion et fiche)", async () => {
    const c = renderPage(
      <ul>
        <li>
          <TalkCard talk={talk} manageHref="/mon-espace/talks/1" />
        </li>
        <li>
          <TalkCard talk={talk} editHref="/mon-espace/talks/1" />
        </li>
      </ul>,
    );
    expect(await axe(c)).toHaveNoViolations();
  });
});
