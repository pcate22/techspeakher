import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConferenceCombobox, { HORS_REGISTRE } from "@/components/ConferenceCombobox";
import type { RegistreConf } from "@/lib/talks";

/**
 * Le combobox du choix de conférence : un champ où on TAPE (nom, ville ou
 * pays) au lieu de dérouler 126 options. Même pattern accessible que la
 * recherche du site (SearchBar) : input `role="combobox"`, options parcourues
 * aux flèches via aria-activedescendant, cliquables directement.
 *
 * L'option « Ma conférence manque dans la liste… » reste TOUJOURS visible :
 * c'est la porte du circuit de proposition (migration 068), elle ne doit
 * jamais disparaître derrière un filtre.
 */

afterEach(cleanup);

const REGISTRE: RegistreConf[] = [
  { id: 2, nom: "Cloud Nord", ville: "Lille", pays: "France", editions: [] },
  { id: 3, nom: "DevFest Toulouse", ville: "Toulouse", pays: "France", editions: [] },
  { id: 4, nom: "Devoxx Belgium", ville: "Anvers", pays: "Belgique", editions: [] },
];

function rendre(props: Partial<React.ComponentProps<typeof ConferenceCombobox>> = {}) {
  const onChange = vi.fn();
  render(
    <ConferenceCombobox
      id="conf-select"
      label="Conférence"
      registre={REGISTRE}
      valeur=""
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, input: screen.getByRole("combobox", { name: /conférence/i }) };
}

describe("ConferenceCombobox — ouverture et filtre", () => {
  it("fermé au rendu, s'ouvre au clic avec TOUTE la liste + l'option « manque »", async () => {
    const u = userEvent.setup();
    const { input } = rendre();
    expect(input).toHaveAttribute("aria-expanded", "false");

    await u.click(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    const options = screen.getAllByRole("option");
    // 3 conférences + l'option « ma conférence manque », toujours dernière.
    expect(options).toHaveLength(4);
    expect(options[3]).toHaveTextContent(/ma conférence manque/i);
  });

  it("taper filtre sur nom, ville ou pays — et le lieu est visible sur l'option", async () => {
    const u = userEvent.setup();
    const { input } = rendre();
    await u.type(input, "lille");

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2); // Cloud Nord + « manque »
    expect(options[0]).toHaveTextContent("Cloud Nord");
    // On VOIT pourquoi le résultat remonte (match sur la ville).
    expect(options[0]).toHaveTextContent("Lille");
  });

  it("aucune correspondance : l'option « ma conférence manque » reste seule et atteignable", async () => {
    const u = userEvent.setup();
    const { input } = rendre();
    await u.type(input, "KCD Helsinki");

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent(/ma conférence manque/i);
  });

  it("le nombre de résultats est annoncé (région vivante)", async () => {
    const u = userEvent.setup();
    const { input } = rendre();
    await u.type(input, "france");
    expect(screen.getByRole("status")).toHaveTextContent(/2 conférences/i);
  });

  it("ouvrir SANS taper annonce déjà le nombre (le lecteur d'écran sait que la liste est là)", async () => {
    const u = userEvent.setup();
    const { input } = rendre();
    await u.click(input);
    expect(screen.getByRole("status")).toHaveTextContent(/3 conférences/i);
  });
});

describe("ConferenceCombobox — choisir", () => {
  it("cliquer une option remonte son id, ferme la liste et affiche son nom", async () => {
    const u = userEvent.setup();
    const { input, onChange } = rendre();
    await u.type(input, "belgique");
    await u.click(screen.getByRole("option", { name: /devoxx belgium/i }));

    expect(onChange).toHaveBeenCalledWith("4", "belgique");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("cliquer « ma conférence manque » remonte HORS_REGISTRE avec le texte tapé", async () => {
    const u = userEvent.setup();
    const { input, onChange } = rendre();
    await u.type(input, "KCD Helsinki");
    await u.click(screen.getByRole("option", { name: /ma conférence manque/i }));

    expect(onChange).toHaveBeenCalledWith(HORS_REGISTRE, "KCD Helsinki");
  });

  it("la valeur choisie s'affiche dans le champ (contrôlé par le parent)", () => {
    const { input } = rendre({ valeur: "3" });
    expect(input).toHaveValue("DevFest Toulouse");
  });

  it("valeur HORS_REGISTRE : le champ affiche l'option « manque »", () => {
    const { input } = rendre({ valeur: HORS_REGISTRE });
    expect(input).toHaveValue("Ma conférence manque dans la liste…");
  });
});

describe("ConferenceCombobox — clavier", () => {
  it("flèches + Entrée : choisit l'option active SANS soumettre le formulaire", async () => {
    const u = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <ConferenceCombobox
          id="conf-select"
          label="Conférence"
          registre={REGISTRE}
          valeur=""
          onChange={onChange}
        />
      </form>,
    );
    const input = screen.getByRole("combobox", { name: /conférence/i });
    await u.type(input, "toulouse");
    await u.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("option"),
    );
    await u.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith("3", "toulouse");
    expect(onSubmit).toHaveBeenCalledTimes(0);
  });

  it("Échap referme la liste et rend le texte au choix en cours", async () => {
    const u = userEvent.setup();
    const { input } = rendre({ valeur: "2" });
    await u.click(input);
    await u.clear(input);
    await u.type(input, "dev");
    await u.keyboard("{Escape}");

    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveValue("Cloud Nord");
  });

  it("quitter le champ (blur) referme et rend le texte au choix en cours", async () => {
    const u = userEvent.setup();
    const { input, onChange } = rendre({ valeur: "2" });
    await u.clear(input);
    await u.type(input, "belg");
    await u.tab();

    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveValue("Cloud Nord");
    // Une frappe PARTIELLE reste exploratoire : rien d'engagé à sa place.
    expect(onChange).toHaveBeenCalledTimes(0);
  });

  // Le piège mobile : elle tape le nom EN ENTIER puis touche directement le
  // champ suivant, sans passer par l'option. Sans ce rattrapage, le formulaire
  // garderait l'ANCIEN choix en silence.
  it("taper le nom exact (casse/accents libres) puis quitter le champ ENGAGE la conférence", async () => {
    const u = userEvent.setup();
    const { input, onChange } = rendre({ valeur: "2" });
    await u.clear(input);
    await u.type(input, "devoxx bélgium");
    await u.tab();

    expect(onChange).toHaveBeenCalledWith("4", "devoxx bélgium");
  });
});

describe("ConferenceCombobox — erreur serveur", () => {
  it("l'erreur est reliée au champ (aria-invalid + describedby + role alert)", () => {
    const { input } = rendre({ error: "Choisis une conférence dans la liste" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Choisis une conférence dans la liste");
    expect(input.getAttribute("aria-describedby")).toContain(alert.id);
  });
});
