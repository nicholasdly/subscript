import { describe, expect, test } from "vitest";

import { createSubscript, evaluate, isZonedTime } from "../src/index.ts";
import { accept } from "./fixtures/accept.ts";
import { reject } from "./fixtures/reject.ts";
import { REFERENCE_INSTANT, WINTER_NOW } from "./fixtures/types.ts";

const seedInputs = [
  "20 c to f",
  ...accept.map((fixture) => fixture.input),
  ...reject.map((fixture) => fixture.input),
];

describe("evaluate", () => {
  test("never throws on seed inputs", () => {
    const subscript = createSubscript({
      now: () => REFERENCE_INSTANT,
    });
    for (const input of seedInputs) {
      expect.soft(() => subscript.evaluate(input), input).not.toThrow();
    }
  });

  test("createSubscript().evaluate is stable for a fixed now", () => {
    const a = createSubscript({ now: () => REFERENCE_INSTANT });
    const b = createSubscript({ now: () => REFERENCE_INSTANT });
    for (const input of seedInputs) {
      expect.soft(a.evaluate(input), input).toEqual(b.evaluate(input));
    }
  });

  test.each([NaN, Infinity, 8_640_000_000_000_001])(
    "invalid injected instant %s fails without throwing",
    (epochMilliseconds) => {
      const subscript = createSubscript({ now: () => ({ epochMilliseconds }) });
      for (const input of ["3pm PST", "now in Tokyo"]) {
        expect(subscript.evaluate(input)).toEqual({
          ok: false,
          reason: { kind: "not-an-expression" },
        });
      }
    },
  );

  test("free evaluate still works for SI", () => {
    expect(evaluate("20 c to f")).toMatchObject({ ok: true, text: "68 \u00b0F" });
  });
});

describe("results", () => {
  test("failure results do not share mutable state", () => {
    const subscript = createSubscript();
    const first = subscript.evaluate("hello");
    expect(first).toFailWith("not-an-expression");
    if (!first.ok) {
      (first.reason as { kind: string }).kind = "precision-loss";
    }
    expect(subscript.evaluate("hello")).toEqual({
      ok: false,
      reason: { kind: "not-an-expression" },
    });
  });
});

describe("instance options", () => {
  test("spans colors 20 c to f", () => {
    expect(createSubscript().spans("20 c to f")).toEqual([
      { start: 0, end: 2, kind: "number" },
      { start: 3, end: 4, kind: "unit" },
      { start: 5, end: 7, kind: "converter" },
      { start: 8, end: 9, kind: "unit" },
    ]);
  });

  test("compact can be disabled per instance", () => {
    expect(createSubscript({ compact: false }).evaluate("1000")).toMatchObject({
      ok: true,
      text: "1000",
    });
  });

  test("preferDaytime makes 3:00 into 3pm", () => {
    const result = createSubscript({
      now: () => WINTER_NOW,
      ambiguousClock: "preferDaytime",
    }).evaluate("3:00 PST in PST");
    expect(result).toMatchObject({ ok: true, text: "3:00 PM PST" });
    if (result.ok) {
      expect(isZonedTime(result.value)).toBe(true);
    }
  });
});
