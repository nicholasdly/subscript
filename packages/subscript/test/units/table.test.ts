import { describe, expect, test } from "vitest";

import { dimensionsEqual } from "../../src/quantity/dimension.ts";
import {
  AREA,
  LENGTH,
  MASS,
  NONE,
  SPEED,
  TEMPERATURE,
  TIME,
  VOLUME,
  type AffineKind,
} from "../../src/units/kinds.ts";
import { UNITS } from "../../src/units/table.ts";

const KEBAB = /^[a-z]+(-[a-z]+)*$/;

const BY_DIMENSION: Record<string, typeof LENGTH> = {
  "1": NONE,
  metre: LENGTH,
  kilometre: LENGTH,
  centimetre: LENGTH,
  millimetre: LENGTH,
  inch: LENGTH,
  foot: LENGTH,
  yard: LENGTH,
  mile: LENGTH,
  "nautical-mile": LENGTH,
  kilogram: MASS,
  gram: MASS,
  milligram: MASS,
  pound: MASS,
  ounce: MASS,
  tonne: MASS,
  second: TIME,
  millisecond: TIME,
  minute: TIME,
  hour: TIME,
  day: TIME,
  week: TIME,
  month: TIME,
  year: TIME,
  kelvin: TEMPERATURE,
  celsius: TEMPERATURE,
  "delta-celsius": TEMPERATURE,
  fahrenheit: TEMPERATURE,
  "delta-fahrenheit": TEMPERATURE,
  rankine: TEMPERATURE,
  "metre-squared": AREA,
  "kilometre-squared": AREA,
  "foot-squared": AREA,
  "inch-squared": AREA,
  hectare: AREA,
  acre: AREA,
  "metre-cubed": VOLUME,
  litre: VOLUME,
  millilitre: VOLUME,
  "us-gallon": VOLUME,
  "imperial-gallon": VOLUME,
  "us-fluid-ounce": VOLUME,
  "imperial-fluid-ounce": VOLUME,
  "metre-per-second": SPEED,
  "kilometre-per-hour": SPEED,
  "mile-per-hour": SPEED,
  knot: SPEED,
};

describe("catalog shape", () => {
  test("every id is unique and kebab-case (except dimensionless 1)", () => {
    const ids = UNITS.map((unit) => unit.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      if (id === "1") {
        continue;
      }
      expect(id, id).toMatch(KEBAB);
    }
  });

  test.each(UNITS)("$id has a citation, a positive finite scale, and a finite offset", (unit) => {
    expect(unit.source.citation.trim(), unit.id).not.toBe("");
    expect(Number.isFinite(unit.scale), unit.id).toBe(true);
    expect(unit.scale, unit.id).toBeGreaterThan(0);
    expect(Number.isFinite(unit.offset), unit.id).toBe(true);
    if (unit.affine === "absolute") {
      expect(unit.offset, unit.id).not.toBe(0);
    } else {
      expect(unit.offset, unit.id).toBe(0);
    }
  });

  test("absolute and difference temperature pairs are exactly the documented set", () => {
    const byAffine = (kind: AffineKind) =>
      UNITS.filter((unit) => unit.affine === kind)
        .map((unit) => unit.id)
        .sort();
    expect(byAffine("absolute")).toEqual(["celsius", "fahrenheit"]);
    expect(byAffine("difference")).toEqual(["delta-celsius", "delta-fahrenheit"]);
  });

  test("each unit is accounted for in BY_DIMENSION", () => {
    expect(Object.keys(BY_DIMENSION)).toHaveLength(UNITS.length);
  });

  test.each(UNITS)("$id dimension matches its section", (unit) => {
    const expected = BY_DIMENSION[unit.id];
    expect(expected, `unexpected id ${unit.id}`).toBeDefined();
    expect(dimensionsEqual(unit.dimension, expected!)).toBe(true);
  });
});

describe("legal definitions", () => {
  test("US and imperial gallon scales match the legal definitions", () => {
    const inch = 0.0254;
    const us = UNITS.find((unit) => unit.id === "us-gallon");
    const imp = UNITS.find((unit) => unit.id === "imperial-gallon");
    expect(us?.scale).toBe(231 * inch * inch * inch);
    expect(imp?.scale).toBe(4.54609 * 0.001);
    expect(us!.scale / 0.001).toBe((231 * inch * inch * inch) / 0.001);
    expect(imp!.scale / 0.001).toBe((4.54609 * 0.001) / 0.001);
  });
});
