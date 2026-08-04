import { describe, expect, it } from "vitest";
import { eventInputToIso, isoToEventInput, formatEventDateTime } from "./event-time";

describe("eventInputToIso", () => {
  it("interprète l'heure saisie comme l'heure du gala, pas celle du serveur", () => {
    // 29 août : heure avancée de l'Est, UTC-4. 20 h au chalet = minuit UTC.
    expect(eventInputToIso("2026-08-29T20:00")).toBe("2026-08-30T00:00:00.000Z");
  });

  it("suit le passage à l'heure normale", () => {
    // 15 janvier : heure normale de l'Est, UTC-5.
    expect(eventInputToIso("2026-01-15T20:00")).toBe("2026-01-16T01:00:00.000Z");
  });

  it("reste juste la nuit du changement d'heure", () => {
    // Le 8 mars 2026 à 2 h, l'Est passe de UTC-5 à UTC-4. Une heure saisie
    // après la bascule doit utiliser le NOUVEAU décalage, pas celui estimé
    // depuis une lecture naïve.
    expect(eventInputToIso("2026-03-08T14:00")).toBe("2026-03-08T18:00:00.000Z");
    expect(eventInputToIso("2026-03-08T00:30")).toBe("2026-03-08T05:30:00.000Z");
  });

  it("refuse ce qui n'est pas une saisie datetime-local", () => {
    expect(eventInputToIso("")).toBeNull();
    expect(eventInputToIso("pas une date")).toBeNull();
  });
});

describe("isoToEventInput", () => {
  it("rend l'heure du gala, quel que soit le fuseau du lecteur", () => {
    expect(isoToEventInput("2026-08-30T00:00:00.000Z")).toBe("2026-08-29T20:00");
    expect(isoToEventInput("2026-01-16T01:00:00.000Z")).toBe("2026-01-15T20:00");
  });

  it("gère minuit sans déborder à 24:00", () => {
    // Minuit à Montréal le 30 août = 04:00 UTC.
    expect(isoToEventInput("2026-08-30T04:00:00.000Z")).toBe("2026-08-30T00:00");
  });

  it("encaisse le vide et l'invalide", () => {
    expect(isoToEventInput(null)).toBe("");
    expect(isoToEventInput("")).toBe("");
    expect(isoToEventInput("n'importe quoi")).toBe("");
  });
});

describe("aller-retour", () => {
  it("conserve l'heure saisie", () => {
    for (const saisie of [
      "2026-08-29T20:00",
      "2026-01-15T09:30",
      "2026-07-04T23:59",
      "2026-11-01T01:30",
    ]) {
      expect(isoToEventInput(eventInputToIso(saisie))).toBe(saisie);
    }
  });
});

describe("formatEventDateTime", () => {
  it("affiche l'heure du gala", () => {
    // fr-CA écrit « 20 h 00 », pas « 20:00 ».
    expect(formatEventDateTime("2026-08-30T00:00:00.000Z")).toContain("20 h 00");
    expect(formatEventDateTime("2026-08-30T00:00:00.000Z")).toContain("29 août 2026");
  });
});
