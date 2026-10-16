import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import ContactForm from "@/app/contact/ContactForm";

describe("ContactForm", () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  function renderForm() {
    const result = render(<ContactForm />);
    const form = result.container.querySelector("form")!;
    return { ...result, form };
  }

  it("affiche le formulaire avec les champs requis", () => {
    renderForm();
    expect(screen.getByLabelText(/nom/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sujet/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /envoyer/i })).toBeInTheDocument();
  });

  it("le formulaire a un aria-label", () => {
    const { form } = renderForm();
    expect(form).toHaveAttribute("aria-label", "Formulaire de contact");
  });

  it("affiche une erreur si le nom est vide", () => {
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "test@test.com" } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "Un message" } });
    fireEvent.submit(form);
    expect(screen.getByText(/le nom est obligatoire/i)).toBeInTheDocument();
  });

  it("affiche une erreur si l'e-mail est vide", () => {
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText(/nom/i), { target: { value: "Jean" } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "Un message" } });
    fireEvent.submit(form);
    expect(screen.getByText(/l'e-mail est obligatoire/i)).toBeInTheDocument();
  });

  it("affiche une erreur si l'e-mail est invalide", () => {
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText(/nom/i), { target: { value: "Jean" } });
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "pas-un-email" } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "Un message" } });
    fireEvent.submit(form);
    expect(screen.getByText(/l'adresse e-mail n'est pas valide/i)).toBeInTheDocument();
  });

  it("affiche une erreur si le message est vide", () => {
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText(/nom/i), { target: { value: "Jean" } });
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "test@test.com" } });
    fireEvent.submit(form);
    expect(screen.getByText(/le message est obligatoire/i)).toBeInTheDocument();
  });

  it("affiche une erreur si le message dépasse 2000 caractères", () => {
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText(/nom/i), { target: { value: "Jean" } });
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "test@test.com" } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "a".repeat(2001) } });
    fireEvent.submit(form);
    expect(screen.getByText(/ne doit pas dépasser/i)).toBeInTheDocument();
  });

  it("affiche le bandeau d'erreur global avec role=alert", () => {
    const { form } = renderForm();
    fireEvent.submit(form);
    const alerts = screen.getAllByRole("alert");
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/veuillez corriger/i)).toBeInTheDocument();
  });

  it("n'affiche pas d'erreur quand tout est valide", () => {
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText(/nom/i), { target: { value: "Jean" } });
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "test@test.com" } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "Un message valide" } });
    fireEvent.submit(form);
    expect(screen.queryByText(/veuillez corriger/i)).not.toBeInTheDocument();
  });

  it("contient les 5 sujets dans le select", () => {
    renderForm();
    const options = screen.getByLabelText(/sujet/i).querySelectorAll("option");
    expect(options).toHaveLength(5);
  });

  it("marque les champs en erreur avec aria-invalid", () => {
    const { form } = renderForm();
    fireEvent.submit(form);
    expect(screen.getByLabelText(/nom/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/e-mail/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/message/i)).toHaveAttribute("aria-invalid", "true");
  });

  it("affiche un message de succès avec role=status après envoi réussi", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }));
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText(/nom/i), { target: { value: "Jean" } });
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "test@test.com" } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "Un message valide" } });
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(screen.getByText(/message envoyé/i)).toBeInTheDocument();
  });

  // --- Anti-démarchage (cf. src/lib/anti-spam.ts) ---

  it("pose un piège à robots invisible et hors du parcours clavier", () => {
    const { container } = renderForm();
    const piege = container.querySelector<HTMLInputElement>("input[name='website']")!;
    expect(piege).toBeInTheDocument();
    expect(piege.tabIndex).toBe(-1);
    expect(piege.closest("[aria-hidden='true']")).toBeTruthy();
    // Hors de l'arbre d'accessibilité : les lecteurs d'écran l'ignorent.
    expect(screen.queryAllByRole("textbox")).not.toContain(piege);
  });

  it("envoie le piège et l'horodatage d'ouverture au serveur", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal("fetch", fetchMock);
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText(/nom/i), { target: { value: "Jean" } });
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "test@test.com" } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "Un message" } });
    fireEvent.submit(form);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const corps = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(corps.website).toBe("");
    expect(typeof corps.ouvertA).toBe("number");
  });

  it("affiche aucun widget anti-robot tant que la clé publique manque", () => {
    const { container } = renderForm();
    expect(container.querySelector(".cf-turnstile")).toBeNull();
    // Aucun script tiers chargé : sans clé, le site reste sans appel externe.
    expect(container.querySelector("script[src*='cloudflare']")).toBeNull();
  });

  /**
   * La clé publique est lue à l'import du module (c'est ce que fait un build
   * Next, qui l'inline) : il faut recharger le module après l'avoir posée.
   */
  async function rendreAvecTurnstile() {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "0xCLE_DE_TEST");
    vi.resetModules();
    const { default: FormulaireAvecWidget } = await import("@/app/contact/ContactForm");
    const result = render(<FormulaireAvecWidget />);
    return { ...result, form: result.container.querySelector("form")! };
  }

  it("affiche le widget anti-robot dès que la clé publique existe", async () => {
    await rendreAvecTurnstile();

    expect(screen.getByTestId("turnstile")).toBeInTheDocument();
    // Rendu EXPLICITE : le rendu implicite laisserait le widget vide après
    // « Envoyer un autre message » (le script ne se recharge pas).
    const script = document.querySelector<HTMLScriptElement>(
      "script[src*='challenges.cloudflare.com']",
    );
    expect(script?.src).toContain("render=explicit");
  });

  it("rend le widget dès que le script de Cloudflare est prêt", async () => {
    const render_ = vi.fn().mockReturnValue("widget-1");
    vi.stubGlobal("turnstile", { render: render_, reset: vi.fn() });
    await rendreAvecTurnstile();

    // `next/script` pose la balise dans <body> ; les tests précédents laissent
    // la leur derrière eux, d'où le dernier élément (celui de ce rendu-ci).
    const scripts = document.querySelectorAll("script[src*='challenges.cloudflare.com']");
    scripts[scripts.length - 1]?.dispatchEvent(new Event("load"));

    await waitFor(() => expect(render_).toHaveBeenCalled());
    const [conteneur, options] = render_.mock.calls[0];
    expect(conteneur).toBe(screen.getByTestId("turnstile"));
    expect(options.sitekey).toBe("0xCLE_DE_TEST");
  });

  it("envoie le jeton, puis repose un widget neuf pour le message suivant", async () => {
    const rendreWidget = vi.fn().mockReturnValue("widget-1");
    const reset = vi.fn();
    vi.stubGlobal("turnstile", { render: rendreWidget, reset });
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal("fetch", fetchMock);
    const { form } = await rendreAvecTurnstile();

    const scripts = document.querySelectorAll("script[src*='challenges.cloudflare.com']");
    scripts[scripts.length - 1]?.dispatchEvent(new Event("load"));
    await waitFor(() => expect(rendreWidget).toHaveBeenCalledTimes(1));

    // Cloudflare remet son jeton par le callback du widget.
    fireEvent.change(screen.getByLabelText(/nom/i), { target: { value: "Jean" } });
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "test@test.com" } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "Un message" } });
    rendreWidget.mock.calls[0][1].callback("jeton-de-cloudflare");
    fireEvent.submit(form);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).turnstile).toBe("jeton-de-cloudflare");
    expect(reset).toHaveBeenCalledWith("widget-1");

    // Un jeton sert une fois : le second message a besoin d'un widget neuf, que
    // le rendu implicite de Cloudflare ne reposerait jamais.
    await waitFor(() => screen.getByText(/envoyer un autre message/i));
    fireEvent.click(screen.getByRole("button", { name: /envoyer un autre message/i }));
    await waitFor(() => expect(rendreWidget).toHaveBeenCalledTimes(2));
  });

  it("garde le formulaire debout quand Turnstile refuse de se rendre", async () => {
    // Turnstile LÈVE (clé invalide, domaine absent de ses Hostnames…). Sans
    // filet, l'exception remonte de l'effet à la barrière d'erreur React et
    // toute la page devient « Oups, une erreur est survenue » — c'est ce qui
    // s'est produit en prod à la pose des clés.
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("turnstile", {
      render: vi.fn(() => {
        throw new Error("[Cloudflare Turnstile] Invalid sitekey");
      }),
      reset: vi.fn(),
    });
    await rendreAvecTurnstile();

    const scripts = document.querySelectorAll("script[src*='challenges.cloudflare.com']");
    scripts[scripts.length - 1]?.dispatchEvent(new Event("load"));

    // Le formulaire reste là, et il dit quoi faire.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /envoyer/i })).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText(/nom/i), { target: { value: "Jean" } });
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "test@test.com" } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "Un message" } });
    fireEvent.submit(screen.getByRole("form", { name: /formulaire de contact/i }));
    expect(screen.getByText(/reste injoignable depuis ce navigateur/i)).toBeInTheDocument();
  });

  it("garde l'envoi tant que le jeton anti-robot manque", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { form } = await rendreAvecTurnstile();

    fireEvent.change(screen.getByLabelText(/nom/i), { target: { value: "Jean" } });
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "test@test.com" } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "Un message" } });
    fireEvent.submit(form);

    expect(screen.getByText(/vérification anti-robot se termine/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    // Le bandeau global garde son message générique : il renvoie aux champs.
    expect(screen.getByText(/veuillez corriger/i)).toBeInTheDocument();
  });

  it("le bouton reset après envoi a focus-visible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }));
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText(/nom/i), { target: { value: "Jean" } });
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "test@test.com" } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "Un message" } });
    fireEvent.submit(form);
    await waitFor(() => screen.getByText(/envoyer un autre message/i));
    const resetBtn = screen.getByRole("button", { name: /envoyer un autre message/i });
    expect(resetBtn.className).toContain("focus-visible:");
  });
});
