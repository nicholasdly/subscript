import { describe, expect, test } from "vitest";

import { lex } from "../../src/pipeline/lex.ts";
import { normalize } from "../../src/pipeline/normalize.ts";
import { trieFor } from "../../src/pipeline/trie.ts";

const trie = trieFor("en-US");

function tokens(input: string) {
  return lex(normalize(input), trie);
}

describe("units", () => {
  test("min is minute, not metre", () => {
    expect(tokens("1 min")).toMatchObject([{ kind: "number" }, { kind: "unit", unitId: "minute" }]);
  });

  test("m in ft: m is metre, in carries both readings", () => {
    expect(tokens("1 m in ft")).toMatchObject([
      { kind: "number" },
      { kind: "unit", unitId: "metre" },
      { kind: "ambiguous" },
      { kind: "unit", unitId: "foot" },
    ]);
  });

  test("2km is number then kilometre", () => {
    expect(tokens("2km")).toEqual([
      expect.objectContaining({ kind: "number", value: 2 }),
      expect.objectContaining({ kind: "unit", unitId: "kilometre" }),
    ]);
  });

  test("minimum does not match min", () => {
    expect(tokens("minimum")).toEqual([expect.objectContaining({ kind: "unknown" })]);
  });

  test("2.5k is still number then kelvin", () => {
    expect(tokens("2.5k")).toMatchObject([{ kind: "number" }, { kind: "unit" }]);
  });
});

describe("offsets", () => {
  test("offsets for 20 c to f match the original string", () => {
    expect(
      tokens("20 c to f").map((token) => ({
        start: token.start,
        end: token.end,
        kind: token.kind,
      })),
    ).toEqual([
      { start: 0, end: 2, kind: "number" },
      { start: 3, end: 4, kind: "unit" },
      { start: 5, end: 7, kind: "converter" },
      { start: 8, end: 9, kind: "unit" },
    ]);
  });

  test("offsets survive a compatibility character that expands", () => {
    expect(tokens("20\u2103").map((token) => ({ start: token.start, end: token.end }))).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 3 },
    ]);
  });
});

describe("scientific numbers", () => {
  test.each([
    { input: "1e3", value: 1000 },
    { input: "1E-3", value: 0.001 },
    { input: "1e309", value: Infinity },
  ])("$input is a single number token", ({ input, value }) => {
    expect(tokens(input)).toEqual([expect.objectContaining({ kind: "number", value })]);
  });

  test("1e3m is number then metre", () => {
    expect(tokens("1e3m")).toEqual([
      expect.objectContaining({ kind: "number", value: 1000 }),
      expect.objectContaining({ kind: "unit", unitId: "metre" }),
    ]);
  });
});

describe("clocks", () => {
  test("3pm is a clock token", () => {
    expect(tokens("3pm")).toEqual([
      expect.objectContaining({ kind: "clock", hour: 15, minute: 0 }),
    ]);
  });

  test("3:00 pm is one clock token covering the space", () => {
    expect(tokens("3:00 pm")).toEqual([
      expect.objectContaining({ kind: "clock", hour: 15, start: 0, end: 7 }),
    ]);
  });

  test("15:00 is a 24-hour clock", () => {
    expect(tokens("15:00")[0]).toMatchObject({ kind: "clock", hour: 15 });
  });

  test("1:30 is a clock, not a number", () => {
    expect(tokens("1:30")).toEqual([expect.objectContaining({ kind: "clock" })]);
  });

  test("25:00 is not a clock", () => {
    expect(tokens("25:00")[0]?.kind).not.toBe("clock");
  });
});

describe("timezones", () => {
  test("GMT+8 is one timezone token", () => {
    expect(tokens("GMT+8")).toEqual([
      expect.objectContaining({ kind: "timezone", zoneId: "utc+0800" }),
    ]);
  });

  test("UTC offsets stop at 14:00", () => {
    expect(tokens("UTC+14")[0]?.kind).toBe("timezone");
    expect(tokens("UTC+14:30")[0]?.kind).not.toBe("timezone");
    expect(tokens("UTC+1430")[0]?.kind).not.toBe("timezone");
  });

  test("compact UTC offsets include minutes", () => {
    expect(tokens("UTC+0530")).toEqual([
      expect.objectContaining({ kind: "timezone", zoneId: "utc+0530" }),
    ]);
  });

  test("PST is a timezone", () => {
    expect(tokens("PST")).toMatchObject([{ kind: "timezone", zoneId: "pst" }]);
  });

  test("now is a now token", () => {
    expect(tokens("now")[0]?.kind).toBe("now");
  });
});
