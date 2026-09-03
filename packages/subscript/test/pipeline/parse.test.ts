import { describe, expect, test } from "vitest";

import { lex } from "../../src/pipeline/lex.ts";
import { normalize } from "../../src/pipeline/normalize.ts";
import { parse } from "../../src/pipeline/parse.ts";
import { enumerateReadings } from "../../src/pipeline/rank.ts";
import type { Token } from "../../src/pipeline/token.ts";
import { trieFor } from "../../src/pipeline/trie.ts";

const trie = trieFor("en-US");

function readings(input: string): Token[][] {
  return enumerateReadings(lex(normalize(input), trie)) ?? [];
}

function ast(input: string) {
  const rows = readings(input);
  expect(rows.length).toBeGreaterThan(0);
  const converted = rows.find((tokens) =>
    tokens.some((token) => token.kind === "converter" && token.converter === "in"),
  );
  return parse(converted ?? rows[0]!);
}

function hasUnit(tokens: readonly Token[], unitId: string): boolean {
  return tokens.some((token) => token.kind === "unit" && token.unitId === unitId);
}

describe("time", () => {
  test("3pm PST in Tokyo is convert-zone", () => {
    expect(ast("3pm PST in Tokyo")).toMatchObject({
      ok: true,
      ast: { kind: "convert-zone", toZoneId: "asia-tokyo", expr: { kind: "zoned" } },
    });
  });

  test("3pm PST is zoned without convert", () => {
    expect(ast("3pm PST")).toMatchObject({ ok: true, ast: { kind: "zoned" } });
  });

  test("now in Tokyo is convert-zone of now", () => {
    expect(ast("now in Tokyo")).toMatchObject({
      ok: true,
      ast: { kind: "convert-zone", toZoneId: "asia-tokyo", expr: { kind: "now" } },
    });
  });
});

describe("quantity", () => {
  test("quantity parse is unchanged for 20 c to f", () => {
    expect(ast("20 c to f")).toMatchObject({ ok: true, ast: { kind: "convert" } });
  });
});

describe("adjacent quantities", () => {
  test("5 ft 11 in is addition", () => {
    const inchReading = readings("5 ft 11 in").find((tokens) => hasUnit(tokens, "inch"));
    expect(inchReading).toBeDefined();
    expect(parse(inchReading!)).toMatchObject({
      ok: true,
      ast: { kind: "binary", op: "+" },
    });
  });

  test("5 m 11 cm is the same addition", () => {
    const [only] = readings("5 m 11 cm");
    expect(only).toBeDefined();
    expect(parse(only!)).toMatchObject({
      ok: true,
      ast: { kind: "binary", op: "+" },
    });
  });

  test("2 3 is not addition", () => {
    const [only] = readings("2 3");
    expect(only).toBeDefined();
    expect(parse(only!).ok).toBe(false);
  });
});
