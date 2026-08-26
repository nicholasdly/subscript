import { describe, expect, test } from "vitest";

import {
  add,
  addChecked,
  div,
  isFiniteNumber,
  mul,
  sqrt,
  sub,
  subChecked,
} from "../../src/quantity/numeric.ts";

describe("float64 wrappers", () => {
  test.each([
    { name: "add", actual: add(2, 3), expected: 5 },
    { name: "sub", actual: sub(5, 3), expected: 2 },
    { name: "mul", actual: mul(4, 2.5), expected: 10 },
    { name: "div", actual: div(9, 3), expected: 3 },
    { name: "sqrt", actual: sqrt(9), expected: 3 },
  ])("$name wraps float64 arithmetic", ({ actual, expected }) => {
    expect(actual).toBe(expected);
  });
});

describe("isFiniteNumber", () => {
  test.each([
    [0, true],
    [1.5, true],
    [NaN, false],
    [Infinity, false],
    [-Infinity, false],
  ] as const)("isFiniteNumber(%s) is %s", (value, expected) => {
    expect(isFiniteNumber(value)).toBe(expected);
  });
});

describe("checked arithmetic", () => {
  test.each([
    [1e100, 1],
    [1e16, 1],
  ])("addChecked(%d, %d) refuses a lost addend", (a, b) => {
    expect(addChecked(a, b)).toEqual({ ok: false });
  });

  test("addChecked of zero plus a value keeps the value", () => {
    expect(addChecked(0, 5)).toEqual({ ok: true, value: 5 });
  });

  test("subChecked snaps cancellation residue to zero", () => {
    expect(subChecked(Math.sqrt(2), 2 ** 0.5)).toEqual({ ok: true, value: 0 });
  });

  test("subChecked keeps a small magnitude that is not cancellation", () => {
    expect(subChecked(1e-13, 0)).toEqual({ ok: true, value: 1e-13 });
  });
});
