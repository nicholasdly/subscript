import { describe, expect, test } from "vitest";

import { createSubscript } from "../src/index.ts";

const subscript = createSubscript();

describe("spans", () => {
  test.each([
    {
      name: "20 c to f",
      input: "20 c to f",
      spans: [
        { start: 0, end: 2, kind: "number" },
        { start: 3, end: 4, kind: "unit" },
        { start: 5, end: 7, kind: "converter" },
        { start: 8, end: 9, kind: "unit" },
      ],
    },
    {
      name: "1 min is number then unit",
      input: "1 min",
      spans: [
        { start: 0, end: 1, kind: "number" },
        { start: 2, end: 5, kind: "unit" },
      ],
    },
    {
      name: "adjacent quantities color as number unit number unit",
      input: "5 ft 11 in",
      spans: [
        { start: 0, end: 1, kind: "number" },
        { start: 2, end: 4, kind: "unit" },
        { start: 5, end: 7, kind: "number" },
        { start: 8, end: 10, kind: "unit" },
      ],
    },
    {
      name: "11 in cm colors in as the inch unit used by evaluation",
      input: "11 in cm",
      spans: [
        { start: 0, end: 2, kind: "number" },
        { start: 3, end: 5, kind: "unit" },
        { start: 6, end: 8, kind: "unit" },
      ],
    },
    {
      name: "parentheses and sqrt colour as punctuation and operator",
      input: "sqrt(4)",
      spans: [
        { start: 0, end: 4, kind: "operator" },
        { start: 4, end: 5, kind: "punctuation" },
        { start: 5, end: 6, kind: "number" },
        { start: 6, end: 7, kind: "punctuation" },
      ],
    },
    {
      name: "failure yields no spans",
      input: "hello world",
      spans: [],
    },
    {
      name: "a unitless convert is not an expression and yields no spans",
      input: "20 to f",
      spans: [],
    },
    {
      name: "a scientific number is one number span",
      input: "1e100",
      spans: [{ start: 0, end: 5, kind: "number" }],
    },
    {
      name: "over-length input yields no spans",
      input: "x".repeat(257),
      spans: [],
    },
    {
      name: "3pm PST in Tokyo colors clock, zones, and converter",
      input: "3pm PST in Tokyo",
      spans: [
        { start: 0, end: 3, kind: "number" },
        { start: 4, end: 7, kind: "timezone" },
        { start: 8, end: 10, kind: "converter" },
        { start: 11, end: 16, kind: "timezone" },
      ],
    },
  ])("$name", ({ input, spans }) => {
    expect(subscript.spans(input)).toEqual(spans);
  });

  test("currency queries are not expressions and yield no spans", () => {
    expect(subscript.spans("100 usd in eur")).toEqual([]);
    expect(subscript.spans("$100")).toEqual([]);
  });
});
