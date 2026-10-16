import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// On isole la page de la stack Auth.js/BDD : seuls le rendu/les boutons nous intéressent.
vi.mock("@/auth", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  auth: vi.fn(),
  handlers: {},
}));
// Le rendu lit le cookie « dernière méthode » : on le contrôle via ce mock.
const lastMethod = { value: undefined as string | undefined };
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => (lastMethod.value ? { value: lastMethod.value } : undefined),
  })),
  headers: vi.fn(async () => new Headers()),
}));

import Connexion from "@/app/connexion/page";

const original = { ...process.env };
afterEach(() => {
  cleanup();
  process.env = { ...original };
});
beforeEach(() => {
  // Par défaut, on coupe toutes les méthodes ; chaque test active ce qu'il teste.
  delete process.env.AUTH_GOOGLE_ID;
  delete process.env.AUTH_GOOGLE_SECRET;
  delete process.env.AUTH_LINKEDIN_ID;
  delete process.env.AUTH_LINKEDIN_SECRET;
  delete process.env.BREVO_API_KEY;
  lastMethod.value = undefined; // aucun cookie « dernière méthode » par défaut
});

function enableGoogle() {
  process.env.AUTH_GOOGLE_ID = "gid";
  process.env.AUTH_GOOGLE_SECRET = "gsecret";
}
function enableLinkedIn() {
  process.env.AUTH_LINKEDIN_ID = "lid";
  process.env.AUTH_LINKEDIN_SECRET = "lsecret";
}

describe("Page /connexion", () => {
  it("a un titre accessible et affiche les providers activés", async () => {
    enableGoogle();
    enableLinkedIn();
    render(await Connexion({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { level: 1, name: /connexion/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /se connecter avec google/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /se connecter avec linkedin/i }),
    ).toBeInTheDocument();
  });

  it("masque LinkedIn tant qu'il n'est pas configuré", async () => {
    enableGoogle(); // LinkedIn non configuré
    render(await Connexion({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("button", { name: /se connecter avec google/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /linkedin/i }),
    ).not.toBeInTheDocument();
  });

  it("affiche un message d'erreur (role=alert) si ?error est présent", async () => {
    enableGoogle();
    render(
      await Connexion({ searchParams: Promise.resolve({ error: "Configuration" }) }),
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("propose la connexion par e-mail (lien magique) — utilisable seule", async () => {
    process.env.BREVO_API_KEY = "key"; // aucun OAuth activé
    render(await Connexion({ searchParams: Promise.resolve({}) }));
    expect(screen.getByPlaceholderText(/ton@email/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /recevoir un lien de connexion/i }),
    ).toBeInTheDocument();
  });

  it("affiche un repli si aucune méthode n'est configurée", async () => {
    render(await Connexion({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/bientôt disponible/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /se connecter/i }),
    ).not.toBeInTheDocument();
  });

  it("met en avant la dernière méthode utilisée (cookie) avec les autres en dessous", async () => {
    enableGoogle();
    enableLinkedIn();
    lastMethod.value = "linkedin";
    render(await Connexion({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/la dernière fois sur cet appareil/i)).toBeInTheDocument();
    // LinkedIn (dernière méthode) mis en avant + Google toujours accessible.
    expect(
      screen.getByRole("button", { name: /se connecter avec linkedin/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /se connecter avec google/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/autres options/i)).toBeInTheDocument();
  });

  it("ignore la dernière méthode si elle n'est plus configurée", async () => {
    enableGoogle(); // LinkedIn désactivé
    lastMethod.value = "linkedin";
    render(await Connexion({ searchParams: Promise.resolve({}) }));
    expect(
      screen.queryByText(/la dernière fois sur cet appareil/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /se connecter avec google/i }),
    ).toBeInTheDocument();
  });
});
