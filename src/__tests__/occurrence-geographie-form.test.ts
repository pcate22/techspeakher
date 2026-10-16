import { describe, it, expect } from "vitest";
import { parseOccurrenceForm } from "@/lib/talk-form";

/**
 * LA GÉOGRAPHIE ARRIVE PAR DES CHAMPS CACHÉS — donc par une entrée NON FIABLE.
 *
 * `VilleField` remplit `codeInsee` et `region` depuis la Base Adresse
 * Nationale quand elle reconnaît une commune. Ces champs voyagent dans le
 * formulaire : n'importe qui peut poster ce qu'il veut. Le serveur ne peut pas
 * les vérifier auprès de la BAN à chaque enregistrement (latence, et surtout
 * une saisie ne doit JAMAIS échouer parce qu'un service tiers est indisponible).
 *
 * L'INVARIANT QUI TIENT LIEU DE VÉRIFICATION : une région ne survit QUE si elle
 * est accompagnée d'un code INSEE plausible. Un code INSEE, c'est une commune
 * FRANÇAISE ; sans lui, prétendre « Occitanie » est invérifiable, donc écarté.
 * Forger les deux reste possible, mais il faut alors fournir un vrai code de
 * commune française — c'est-à-dire dire la vérité.
 *
 * Portée réelle du risque : l'occurrence appartient à la speakeuse qui la
 * saisit, et elle peut déjà taper la ville qu'elle veut. Ce n'est pas une
 * frontière d'autorisation, c'est une garde de QUALITÉ de donnée — sans quoi
 * une facette « Occitanie » listerait des dates bruxelloises.
 */

function form(champs: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("conference", "DevFest Toulouse");
  fd.set("annee", "2026");
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}

function geo(fd: FormData) {
  const r = parseOccurrenceForm(fd);
  if (!r.ok) throw new Error(`formulaire refusé : ${JSON.stringify(r.errors)}`);
  return { codeInsee: r.data.codeInsee, region: r.data.region };
}

describe("parseOccurrenceForm — la géographie postée est revalidée", () => {
  it("garde le couple quand le code INSEE est plausible", () => {
    expect(geo(form({ ville: "Toulouse", codeInsee: "31555", region: "Occitanie" }))).toEqual({
      codeInsee: "31555",
      region: "Occitanie",
    });
  });

  it("accepte la Corse, dont le code n'est PAS que des chiffres", () => {
    // 2A/2B : le piège classique d'une validation « cinq chiffres ».
    expect(geo(form({ ville: "Ajaccio", codeInsee: "2A004", region: "Corse" }))).toEqual({
      codeInsee: "2A004",
      region: "Corse",
    });
  });

  it("ÉCARTE une région annoncée sans code INSEE", () => {
    // Le cas qui mord : « Bruxelles » + « Occitanie ». Bruxelles n'a pas de
    // code INSEE, donc la région est invérifiable et ne doit pas être retenue.
    expect(geo(form({ ville: "Bruxelles", codeInsee: "", region: "Occitanie" }))).toEqual({
      codeInsee: null,
      region: null,
    });
  });

  it("ÉCARTE un code INSEE mal formé, et la région avec lui", () => {
    for (const faux of ["31", "abcde", "315555", "3155A", "<script>"]) {
      expect(geo(form({ ville: "Toulouse", codeInsee: faux, region: "Occitanie" }))).toEqual({
        codeInsee: null,
        region: null,
      });
    }
  });

  it("ÉCARTE une région absente du vocabulaire, même avec un code valide", () => {
    // Une facette ne doit jamais proposer une entrée que l'annuaire ignore.
    expect(
      geo(form({ ville: "Toulouse", codeInsee: "31555", region: "Midi-Pyrénées" })),
    ).toEqual({ codeInsee: "31555", region: null });
  });

  it("ÉCARTE « À distance (visio) » et « Toute la France » : ce ne sont pas des lieux", () => {
    // Correctif de revue (18/08). `REGIONS` porte trois entrées qu'une
    // occurrence ne peut pas tenir : une case de raccourci de l'annuaire et deux
    // règles d'affichage. Depuis le lot 1 de l'agenda, la région décide si une
    // intervention TRAVERSE les filtres géographiques : une date toulousaine
    // postée « À distance (visio) », avec un vrai code INSEE, passait cette
    // garde et se retrouvait listée sous CHAQUE ville de l'agenda public.
    for (const region of ["À distance (visio)", "International", "Toute la France"]) {
      expect(
        geo(form({ ville: "Toulouse", codeInsee: "31555", region })),
      ).toEqual({ codeInsee: "31555", region: null });
    }
    // Les vraies régions passent toujours.
    expect(geo(form({ ville: "Toulouse", codeInsee: "31555", region: "Occitanie" }))).toEqual({
      codeInsee: "31555",
      region: "Occitanie",
    });
  });

  it("sans ville, aucune géographie n'est retenue", () => {
    expect(geo(form({ ville: "", codeInsee: "31555", region: "Occitanie" }))).toEqual({
      codeInsee: null,
      region: null,
    });
  });

  it("une saisie SANS géographie reste valide : la BAN peut être muette", () => {
    // Le point non négociable : une speakeuse enregistre sa date même quand le
    // service public ne répond pas. Le rattrapage remplira plus tard.
    const r = parseOccurrenceForm(form({ ville: "Toulouse" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.ville).toBe("Toulouse");
      expect(r.data.codeInsee).toBeNull();
      expect(r.data.region).toBeNull();
    }
  });
});
