import { describe, expect, test } from "vitest";

import {
  dimension,
  dimensionsEqual,
  divDimensions,
  mulDimensions,
  rational,
  rationalsEqual,
  scaleDimension,
} from "../../src/quantity/dimension.ts";
import { AREA, ENERGY, FORCE, LENGTH, POWER, PRESSURE, TIME } from "../../src/units/kinds.ts";

describe("rationals", () => {
  test("rational reduces by gcd and normalizes sign", () => {
    expect(rational(2, 4)).toEqual({ n: 1, d: 2 });
    expect(rational(-2, -4)).toEqual({ n: 1, d: 2 });
    expect(rational(2, -4)).toEqual({ n: -1, d: 2 });
    expect(rational(0, 4)).toEqual({ n: 0, d: 1 });
  });

  test("rationalsEqual compares reduced pairs", () => {
    expect(rationalsEqual(rational(2, 4), rational(1, 2))).toBe(true);
    expect(rationalsEqual(rational(1, 2), rational(1, 3))).toBe(false);
  });
});

describe("dimensions", () => {
  test("metre \u00d7 metre is area, sqrt(area) is length", () => {
    const m2 = mulDimensions(LENGTH, LENGTH);
    expect(dimensionsEqual(m2, AREA)).toBe(true);
    expect(dimensionsEqual(scaleDimension(m2, rational(1, 2)), LENGTH)).toBe(true);
  });

  test("newton, joule, watt, and pascal are the named SI products", () => {
    expect(dimensionsEqual(mulDimensions(FORCE, LENGTH), ENERGY)).toBe(true);
    expect(dimensionsEqual(divDimensions(ENERGY, TIME), POWER)).toBe(true);
    expect(dimensionsEqual(divDimensions(FORCE, AREA), PRESSURE)).toBe(true);
  });

  test("dimension() defaults to all-zero exponents", () => {
    for (const exponent of dimension()) {
      expect(exponent).toEqual({ n: 0, d: 1 });
    }
  });
});
