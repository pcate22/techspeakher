import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import InlineActionForm from "@/components/InlineActionForm";

afterEach(cleanup);

/**
 * Les confirmations destructives passent par une VRAIE modale (Radix
 * AlertDialog), plus par `window.confirm` : la boîte
 * native affiche l'URL du site (illisible en preview Vercel) et n'est pas
 * stylable. Contrat commun : titre = question courte, description =
 * conséquence, « Annuler » ne soumet rien, le bouton de confirmation est un
 * `type="submit"` DANS le formulaire d'action (pas d'`AlertDialog.Action`,
 * cf. InviteButton : fermer démonterait le form et annulerait la soumission).
 */
describe("ConfirmSubmitButton (form serveur parent)", () => {
  const setup = () => {
    const action = vi.fn();
    render(
      <form action={action}>
        <input type="hidden" name="registrationId" value="7" />
        <ConfirmSubmitButton
          title="Retirer Camille de « Tremplin 2026 » ?"
          message="Son inscription, ses documents et ses présences photo seront supprimés. Cette action est définitive."
          confirmLabel="Retirer définitivement"
        >
          Retirer Camille de l&apos;édition
        </ConfirmSubmitButton>
      </form>,
    );
    return action;
  };

  it("pas de dialogue au départ, le déclencheur ne soumet pas", async () => {
    const u = userEvent.setup();
    const action = setup();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    const trigger = screen.getByRole("button", { name: /retirer camille de l'édition/i });
    expect(trigger).toHaveAttribute("type", "button");
    await u.click(trigger);
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    // Titre (question) + conséquence affichés
    expect(screen.getByText(/retirer camille de « tremplin 2026 » \?/i)).toBeInTheDocument();
    expect(screen.getByText(/cette action est définitive/i)).toBeInTheDocument();
  });

  it("emphase INVERSÉE : « Annuler » est l'action mise en avant, pas la suppression", async () => {
    // Pattern inverse : dans une modale destructive, le geste sûr porte le
    // poids visuel (bouton plein) et reçoit le focus à l'ouverture ; le geste
    // destructif reste lisible mais discret. On ne peut pas confirmer d'un
    // clic réflexe sur le bouton le plus voyant.
    const u = userEvent.setup();
    setup();
    await u.click(screen.getByRole("button", { name: /retirer camille de l'édition/i }));

    const annuler = screen.getByRole("button", { name: /annuler/i });
    const confirmer = screen.getByRole("button", { name: /retirer définitivement/i });

    // « Annuler » : plein (fond magenta). Confirmer : discret, sans fond.
    expect(annuler.className).toMatch(/bg-magenta/);
    expect(confirmer.className).not.toMatch(/bg-/);
    // Et c'est « Annuler » qui a le focus d'ouverture (défaut Radix, conservé).
    expect(annuler).toHaveFocus();
  });

  it("« Annuler » referme sans soumettre", async () => {
    const u = userEvent.setup();
    const action = setup();
    await u.click(screen.getByRole("button", { name: /retirer camille de l'édition/i }));
    await u.click(screen.getByRole("button", { name: /annuler/i }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it("confirmer est un submit DANS le formulaire parent et déclenche l'action", async () => {
    const u = userEvent.setup();
    const action = setup();
    await u.click(screen.getByRole("button", { name: /retirer camille de l'édition/i }));
    const confirm = screen.getByRole("button", { name: /retirer définitivement/i });
    expect(confirm).toHaveAttribute("type", "submit");
    expect(confirm.closest("form")).not.toBeNull();
    await u.click(confirm);
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe("ConfirmSubmitButton avec saisie de confirmation (type-to-confirm)", () => {
  const setup = () => {
    const action = vi.fn();
    render(
      <form action={action}>
        <ConfirmSubmitButton
          title="Supprimer ton compte ?"
          message="Action irréversible : ta fiche, tes talks et ton compte seront supprimés."
          confirmLabel="Supprimer définitivement"
          confirmText={["Camille Roux", "camille@example.com"]}
          confirmTextLabel="Pour confirmer, écris ton nom ou ton adresse e-mail"
        >
          Supprimer mon compte
        </ConfirmSubmitButton>
      </form>,
    );
    return action;
  };

  it("le bouton de confirmation reste désactivé tant que rien n'est saisi", async () => {
    const u = userEvent.setup();
    const action = setup();
    await u.click(screen.getByRole("button", { name: /supprimer mon compte/i }));
    const confirm = screen.getByRole("button", { name: /supprimer définitivement/i });
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    await u.click(confirm);
    expect(action).not.toHaveBeenCalled();
  });

  it("une saisie qui ne correspond pas ne débloque pas et ne soumet pas", async () => {
    const u = userEvent.setup();
    const action = setup();
    await u.click(screen.getByRole("button", { name: /supprimer mon compte/i }));
    const input = screen.getByLabelText(/écris ton nom ou ton adresse e-mail/i);
    await u.type(input, "peu importe");
    const confirm = screen.getByRole("button", { name: /supprimer définitivement/i });
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    await u.click(confirm);
    expect(action).not.toHaveBeenCalled();
  });

  it("l'e-mail débloque la confirmation (casse ignorée) et soumet", async () => {
    const u = userEvent.setup();
    const action = setup();
    await u.click(screen.getByRole("button", { name: /supprimer mon compte/i }));
    const input = screen.getByLabelText(/écris ton nom ou ton adresse e-mail/i);
    await u.type(input, "  CAMILLE@EXAMPLE.COM  ");
    const confirm = screen.getByRole("button", { name: /supprimer définitivement/i });
    expect(confirm).toHaveAttribute("aria-disabled", "false");
    await u.click(confirm);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("une valeur à espaces irréguliers reste retapable telle qu'elle s'affiche", async () => {
    // HTML fractionne les espaces multiples : un indice « Coder  proprement »
    // s'affiche « Coder proprement ». Sans normalisation, la personne tape ce
    // qu'elle VOIT et le bouton ne se déverrouille jamais : elle se retrouve
    // dans l'incapacité de supprimer. Idem pour une espace insécable, invisible
    // et intapable. Les titres moissonnés du CFP en contiennent.
    const u = userEvent.setup();
    const action = vi.fn();
    render(
      <form action={action}>
        <ConfirmSubmitButton
          title="Supprimer ce talk ?"
          message="Action irréversible."
          confirmLabel="Supprimer définitivement"
          confirmText={["Coder  proprement,  vraiment"]}
          confirmTextLabel="Pour confirmer, réécris le titre du talk"
        >
          Supprimer ce talk
        </ConfirmSubmitButton>
      </form>,
    );
    await u.click(screen.getByRole("button", { name: /supprimer ce talk/i }));
    await u.type(
      screen.getByLabelText(/réécris le titre du talk/i),
      "Coder proprement, vraiment",
    );
    expect(
      screen.getByRole("button", { name: /supprimer définitivement/i }),
    ).toHaveAttribute("aria-disabled", "false");
  });

  it("une apostrophe courbe se retape avec l'apostrophe du clavier", async () => {
    // Les titres moissonnés du CFP arrivent verbatim avec « ’ », qu'aucun
    // clavier ne produit par défaut : sans repli, le talk serait indéboulonnable.
    const u = userEvent.setup();
    const action = vi.fn();
    render(
      <form action={action}>
        <ConfirmSubmitButton
          title="Supprimer ce talk ?"
          message="Action irréversible."
          confirmLabel="Supprimer définitivement"
          confirmText={["L’art du pitch…"]}
          confirmTextLabel="Pour confirmer, réécris le titre du talk"
        >
          Supprimer ce talk
        </ConfirmSubmitButton>
      </form>,
    );
    await u.click(screen.getByRole("button", { name: /supprimer ce talk/i }));
    await u.type(
      screen.getByLabelText(/réécris le titre du talk/i),
      "L'art du pitch...",
    );
    expect(
      screen.getByRole("button", { name: /supprimer définitivement/i }),
    ).toHaveAttribute("aria-disabled", "false");
  });

  it("poste la saisie sous `confirmation` : le serveur peut la revérifier", async () => {
    // Palier 3 : un garde-fou qui ne vit qu'au navigateur se contourne en
    // deux clics de DevTools. La valeur retapée part donc avec le formulaire,
    // pour que la Server Action la revérifie avant de détruire quoi que ce soit.
    const u = userEvent.setup();
    const action = setup();
    await u.click(screen.getByRole("button", { name: /supprimer mon compte/i }));
    await u.type(
      screen.getByLabelText(/écris ton nom ou ton adresse e-mail/i),
      "camille@example.com",
    );
    await u.click(screen.getByRole("button", { name: /supprimer définitivement/i }));

    expect(action).toHaveBeenCalledTimes(1);
    const posted = action.mock.calls[0][0] as FormData;
    expect(posted.get("confirmation")).toBe("camille@example.com");
  });

  it("le nom convient aussi (accents ignorés)", async () => {
    const u = userEvent.setup();
    void setup();
    await u.click(screen.getByRole("button", { name: /supprimer mon compte/i }));
    const input = screen.getByLabelText(/écris ton nom ou ton adresse e-mail/i);
    await u.type(input, "camille roux");
    expect(
      screen.getByRole("button", { name: /supprimer définitivement/i }),
    ).toHaveAttribute("aria-disabled", "false");
  });

  it("réouvrir remet à zéro la saisie (le bouton se re-verrouille)", async () => {
    const u = userEvent.setup();
    void setup();
    await u.click(screen.getByRole("button", { name: /supprimer mon compte/i }));
    await u.type(
      screen.getByLabelText(/écris ton nom ou ton adresse e-mail/i),
      "camille@example.com",
    );
    expect(
      screen.getByRole("button", { name: /supprimer définitivement/i }),
    ).toHaveAttribute("aria-disabled", "false");
    await u.click(screen.getByRole("button", { name: /annuler/i }));
    await u.click(screen.getByRole("button", { name: /supprimer mon compte/i }));
    expect(screen.getByLabelText(/écris ton nom ou ton adresse e-mail/i)).toHaveValue("");
    expect(
      screen.getByRole("button", { name: /supprimer définitivement/i }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});

describe("InlineActionForm avec confirmation", () => {
  const ok = vi.fn(async () => ({ status: "success" as const }));

  afterEach(() => ok.mockClear());

  const setup = () =>
    render(
      <InlineActionForm
        action={ok}
        hidden={{ documentId: 3 }}
        submitLabel="Supprimer"
        confirm={{
          title: "Supprimer « Trame de pitch » ?",
          message: "Il ne sera plus visible des participantes.",
          label: "Supprimer",
        }}
        successMessage="Document supprimé."
      />,
    );

  it("le bouton principal ouvre la confirmation au lieu de soumettre", async () => {
    const u = userEvent.setup();
    setup();
    const trigger = screen.getByRole("button", { name: /^supprimer$/i });
    expect(trigger).toHaveAttribute("type", "button");
    await u.click(trigger);
    expect(ok).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/il ne sera plus visible des participantes/i)).toBeInTheDocument();
  });

  it("« Annuler » ne soumet pas", async () => {
    const u = userEvent.setup();
    setup();
    await u.click(screen.getByRole("button", { name: /^supprimer$/i }));
    await u.click(screen.getByRole("button", { name: /annuler/i }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(ok).not.toHaveBeenCalled();
  });

  it("confirmer soumet l'action puis referme la modale", async () => {
    const u = userEvent.setup();
    setup();
    await u.click(screen.getByRole("button", { name: /^supprimer$/i }));
    const dialog = screen.getByRole("alertdialog");
    // Le bouton de confirmation vit dans la modale (celui de la page est le déclencheur)
    const confirm = Array.from(dialog.querySelectorAll("button")).find(
      (b) => b.type === "submit",
    );
    expect(confirm).toBeDefined();
    await u.click(confirm!);
    expect(ok).toHaveBeenCalledTimes(1);
    // Le résultat referme la confirmation ; le feedback vit à côté du bouton
    expect(await screen.findByText(/document supprimé\./i)).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("sans `confirm`, le bouton reste un submit direct", async () => {
    const u = userEvent.setup();
    render(
      <InlineActionForm action={ok} hidden={{ documentId: 3 }} submitLabel="Basculer" />,
    );
    const btn = screen.getByRole("button", { name: /basculer/i });
    expect(btn).toHaveAttribute("type", "submit");
    await u.click(btn);
    expect(ok).toHaveBeenCalledTimes(1);
  });
});
