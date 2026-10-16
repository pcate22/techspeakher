import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/admin/actions", () => ({ sendInvitationsAction: vi.fn() }));

import { sendInvitationsAction } from "@/app/admin/actions";
import InviteButton from "@/app/admin/speakeuses/InviteButton";

afterEach(() => {
  cleanup();
  vi.mocked(sendInvitationsAction).mockReset();
});

describe("InviteButton", () => {
  it("count 0 : message « toutes invitées », aucun bouton à cliquer", () => {
    render(<InviteButton count={0} />);
    expect(
      screen.getByText(/toutes les fiches publiées ont été invitées/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("confirmer déclenche bien l'action serveur d'envoi", async () => {
    const u = userEvent.setup();
    render(<InviteButton count={3} />);

    await u.click(
      screen.getByRole("button", { name: /inviter 3 speakeuses/i }),
    );
    const confirm = await screen.findByRole("button", {
      name: /envoyer maintenant/i,
    });
    expect(confirm).toHaveAttribute("type", "submit");
    expect(confirm.closest("form")).not.toBeNull();

    // Note : jsdom ne reproduit pas la course réelle (le démontage du
    // portail qui annulait le submit). Ce test garde le câblage : le clic
    // sur la confirmation soumet bien le formulaire d'action.
    await u.click(confirm);
    expect(vi.mocked(sendInvitationsAction)).toHaveBeenCalledTimes(1);
  });
});
