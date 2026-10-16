import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import SpeakeuseCard from "@/components/SpeakeuseCard";
import type { SpeakerProfile } from "@/lib/profiles";
import { makeProfile } from "./test-helpers";

afterEach(cleanup);

const profile: SpeakerProfile = makeProfile({
  id: 12,
  titreProfil: "Spécialiste IA",
  poste: "Dev",
  entreprise: "OVH",
  linkedin: "https://lk/moi",
  secteurs: ["Industrie"],
  sujets: ["IA / ML / Data"],
  isWoman: true,
  status: "en_attente",
});

describe("SpeakeuseCard", () => {
  it("affiche le nom et les tags", () => {
    render(<SpeakeuseCard profile={profile} />);
    expect(screen.getByText("Marie Curie")).toBeInTheDocument();
    expect(screen.getByText("Industrie")).toBeInTheDocument();
  });

  it("une fiche au nom blanc affiche le repli calculé au bord, jamais du vide", () => {
    // Le défaut d'origine (dette P1) : `name ?? …` laissait passer "   ",
    // la carte de l'ANNUAIRE — surface publique n° 1 — s'affichait sans nom.
    render(
      <SpeakeuseCard
        profile={makeProfile({
          name: "   ",
          titreProfil: "Spécialiste IA",
          poste: "Dev",
          entreprise: "OVH",
        })}
      />,
    );
    expect(screen.getByRole("heading", { name: "Spécialiste IA" })).toBeInTheDocument();
    // Sans vrai nom, le sous-titre retombe sur poste · entreprise : le titre
    // de profil est déjà en tête, l'y répéter dirait deux fois la même chose.
    expect(screen.getByText("Dev · OVH")).toBeInTheDocument();
  });

  it("devient un lien vers la fiche si href est fourni", () => {
    render(<SpeakeuseCard profile={profile} href="/speakeuses/12" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/speakeuses/12");
  });

  it("affiche l'affordance « Voir la fiche » quand cliquable", () => {
    render(<SpeakeuseCard profile={profile} href="/speakeuses/12" />);
    expect(screen.getByText("Voir la fiche")).toBeInTheDocument();
  });

  it("n'affiche pas d'affordance quand la carte n'est pas cliquable", () => {
    render(<SpeakeuseCard profile={profile} />);
    expect(screen.queryByText("Voir la fiche")).not.toBeInTheDocument();
  });

  it("utilise les initiales quand il n'y a pas de photo", () => {
    render(<SpeakeuseCard profile={profile} />);
    expect(screen.getByText("MC")).toBeInTheDocument();
  });

  it("sépare Secteurs et Sujets", () => {
    render(<SpeakeuseCard profile={profile} />);
    expect(screen.getByText("Secteurs")).toBeInTheDocument();
    expect(screen.getByText("Sujets")).toBeInTheDocument();
  });

  it("met en avant les titres de talks quand ils sont fournis", () => {
    render(
      <SpeakeuseCard
        profile={profile}
        talks={[
          { titre: "AI Brain Fry", type: "Conférence" },
          { titre: "Scaling Istio", type: "Meetup" },
        ]}
      />,
    );
    expect(screen.getByText("Talks")).toBeInTheDocument();
    expect(screen.getByText("AI Brain Fry")).toBeInTheDocument();
    expect(screen.getByText("Scaling Istio")).toBeInTheDocument();
  });

  it("replie au-delà de 3 talks avec un « +N » nominatif", () => {
    render(
      <SpeakeuseCard
        profile={profile}
        talks={[
          { titre: "Talk 1", type: "Conférence" },
          { titre: "Talk 2", type: "Conférence" },
          { titre: "Talk 3", type: "Conférence" },
          { titre: "Talk 4", type: "Conférence" },
          { titre: "Talk 5", type: "Conférence" },
        ]}
      />,
    );
    expect(screen.getByText("Talk 3")).toBeInTheDocument();
    expect(screen.queryByText("Talk 4")).not.toBeInTheDocument();
    expect(screen.getByText("+2 autres talks")).toBeInTheDocument();
  });

  it("n'affiche pas la section Talks quand il n'y en a pas", () => {
    render(<SpeakeuseCard profile={profile} />);
    expect(screen.queryByText("Talks")).not.toBeInTheDocument();
  });
});
