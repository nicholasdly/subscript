import { describe, expect, test } from "vitest";

import {
  add,
  convert,
  div,
  isZonedTime,
  mul,
  quantity,
  sqrt,
  sub,
  type Quantity,
  type Result,
} from "../../src/index.ts";

function q(value: number, unitId?: string): Quantity {
  const result = quantity(value, unitId);
  expect(result.ok).toBe(true);
  if (!result.ok || isZonedTime(result.value)) {
    throw new Error(`quantity(${value}, ${unitId}) failed`);
  }
  return result.value;
}

describe("temperature convert", () => {
  test.each([
    {
      name: "c-to-f",
      value: 20,
      from: "celsius",
      to: "fahrenheit",
      unitId: "fahrenheit",
      expected: 68,
      eps: 1e-12,
    },
    {
      name: "f-to-c",
      value: 68,
      from: "fahrenheit",
      to: "celsius",
      unitId: "celsius",
      expected: 20,
    },
    {
      name: "c-to-k",
      value: 20,
      from: "celsius",
      to: "kelvin",
      unitId: "kelvin",
      expected: 293.15,
    },
  ])("$name", ({ value, from, to, unitId, expected, eps }) => {
    expect(convert(q(value, from), to)).toBeQuantity(unitId, expected, eps);
  });

  test("c-to-delta-c", () => {
    expect(convert(q(20, "celsius"), "delta-celsius")).toFailWith("dimension-mismatch");
  });
});

describe("temperature arithmetic", () => {
  test("abs-plus-abs-c", () => {
    expect(add(q(20, "celsius"), q(5, "celsius"))).toFailWith("dimension-mismatch");
  });

  test("abs-plus-delta-c", () => {
    expect(add(q(20, "celsius"), q(5, "delta-celsius"))).toBeQuantity("celsius", 25);
  });

  test("abs-plus-kelvin", () => {
    expect(add(q(20, "celsius"), q(5, "kelvin"))).toBeQuantity("celsius", 25);
  });

  test("abs-minus-abs", () => {
    expect(sub(q(25, "celsius"), q(20, "celsius"))).toBeQuantity("delta-celsius", 5);
  });

  test("abs-times-two", () => {
    expect(mul(q(20, "celsius"), q(2))).toFailWith("dimension-mismatch");
  });

  test("delta-times-two", () => {
    expect(mul(q(5, "delta-celsius"), q(2))).toBeQuantity("delta-celsius", 10);
  });
});

describe("length, mass, volume", () => {
  test("m-to-ft", () => {
    expect(convert(q(1, "metre"), "foot")).toBeQuantity("foot", 1 / 0.3048, 1e-12);
  });

  test("km-plus-m", () => {
    expect(add(q(1, "kilometre"), q(1000, "metre"))).toBeQuantity("kilometre", 2);
  });

  test("bare-plus-km", () => {
    expect(add(q(300), q(20, "kilometre"))).toBeQuantity("kilometre", 320);
  });

  test("m-times-m", () => {
    expect(mul(q(10, "metre"), q(10, "metre"))).toBeQuantity("metre-squared", 100);
  });

  test("kg-times-litre", () => {
    const result = mul(q(3, "kilogram"), q(3, "litre"));
    expect(result).toFailWith("unknown-unit");
    expect(result).toMatchObject({ reason: { token: "kg\u00b7L" } });
  });

  test("m-div-s", () => {
    expect(div(q(10, "metre"), q(2, "second"))).toBeQuantity("metre-per-second", 5);
  });

  test("m-plus-kg", () => {
    expect(add(q(1, "metre"), q(1, "kilogram"))).toFailWith("dimension-mismatch");
  });

  test("us-vs-imp-gallon", () => {
    const inch = 0.0254;
    expect(convert(q(1, "us-gallon"), "litre")).toBeQuantity(
      "litre",
      (231 * inch * inch * inch) / 0.001,
    );
    expect(convert(q(1, "imperial-gallon"), "litre")).toBeQuantity(
      "litre",
      (4.54609 * 0.001) / 0.001,
    );
  });

  test("year-in-days", () => {
    expect(convert(q(1, "year"), "day")).toBeQuantity("day", 365.2425);
  });

  test("n-times-m-is-joule", () => {
    expect(mul(q(10, "newton"), q(2, "metre"))).toBeQuantity("joule", 20);
  });

  test("j-div-s-is-watt", () => {
    expect(div(q(1, "joule"), q(1, "second"))).toBeQuantity("watt", 1);
  });

  test("n-div-m2-is-pascal", () => {
    expect(div(q(1, "newton"), q(1, "metre-squared"))).toBeQuantity("pascal", 1);
  });

  test("kw-times-s-is-kilojoule", () => {
    expect(mul(q(1, "kilowatt"), q(1, "second"))).toBeQuantity("kilojoule", 1);
  });

  test("byte-times-metre-is-unknown", () => {
    const result = mul(q(1, "byte"), q(1, "metre"));
    expect(result).toFailWith("unknown-unit");
    expect(result).toMatchObject({ reason: { token: "B\u00b7m" } });
  });

  test("eight-bit-to-byte", () => {
    expect(convert(q(8, "bit"), "byte")).toBeQuantity("byte", 1);
  });
});

describe("sqrt", () => {
  test("sqrt-m2", () => {
    expect(sqrt(q(4, "metre-squared"))).toBeQuantity("metre", 2);
  });

  test("sqrt-m", () => {
    expect(sqrt(q(4, "metre"))).toFailWith("unknown-unit");
  });
});

describe("quantity constructor", () => {
  test("unknown-id", () => {
    expect(quantity(1, "c")).toMatchObject({
      ok: false,
      reason: { kind: "unknown-unit", token: "c" },
    });
  });

  test("quantity never throws on non-finite values or empty ids", () => {
    expect(() => quantity(NaN)).not.toThrow();
    expect(() => quantity(Infinity, "metre")).not.toThrow();
    expect(() => quantity(1, "")).not.toThrow();
    expect(quantity(NaN)).toFailWith("precision-loss");
    expect(quantity(Infinity, "metre")).toFailWith("precision-loss");
    expect(quantity(1, "")).toFailWith("unknown-unit");
  });

  test("iso currency ids are unknown units", () => {
    expect(quantity(100, "usd")).toFailWith("unknown-unit");
  });
});

describe("precision", () => {
  test("adding a lost addend is precision-loss", () => {
    expect(add(q(1e100), q(1))).toFailWith("precision-loss");
  });

  test("subtracting two close irrationals snaps to zero", () => {
    const result: Result = sub(q(Math.sqrt(2)), q(2 ** 0.5));
    expect(result).toBeQuantity("1", 0);
    expect(result).toMatchObject({ text: "0" });
  });
});
