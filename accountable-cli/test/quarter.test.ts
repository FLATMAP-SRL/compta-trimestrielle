import { describe, expect, it } from "vitest";
import { parseQuarter, parsePeriod, inPeriod, currentQuarter } from "../src/quarter.js";

describe("parseQuarter", () => {
  it("mappe les trimestres", () => {
    expect(parseQuarter("2026-Q1")).toMatchObject({ start: "2026-01-01", end: "2026-04-01" });
    expect(parseQuarter("2026-Q2")).toMatchObject({ start: "2026-04-01", end: "2026-07-01" });
    expect(parseQuarter("2026-Q3")).toMatchObject({ start: "2026-07-01", end: "2026-10-01" });
  });
  it("Q4 → 1er janvier de l'année suivante", () => {
    expect(parseQuarter("2026-Q4")).toMatchObject({ start: "2026-10-01", end: "2027-01-01" });
  });
  it("accepte 2026Q3 sans tiret", () => {
    expect(parseQuarter("2026Q3").start).toBe("2026-07-01");
  });
  it("rejette les invalides", () => {
    expect(() => parseQuarter("2026-Q5")).toThrow();
    expect(() => parseQuarter("banane")).toThrow();
  });
});

describe("parsePeriod / inPeriod", () => {
  const p = parsePeriod("2026-04-01/2026-07-01");
  it("borne haute exclue", () => {
    expect(inPeriod("2026-04-01", p)).toBe(true);
    expect(inPeriod("2026-06-30", p)).toBe(true);
    expect(inPeriod("2026-07-01", p)).toBe(false); // exclu
    expect(inPeriod("2026-03-31", p)).toBe(false);
  });
  it("tolère les dates ISO complètes", () => {
    expect(inPeriod("2026-05-10T22:00:00.000Z", p)).toBe(true);
  });
});

describe("currentQuarter", () => {
  it("calcule le trimestre courant", () => {
    expect(currentQuarter(new Date("2026-08-15T12:00:00Z"))).toMatchObject({ label: "2026-Q3" });
  });
});
