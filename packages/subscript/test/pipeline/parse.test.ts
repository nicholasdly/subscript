import { describe, expect, test } from "vitest";

import { lex } from "../../src/pipeline/lex.ts";
import { normalize } from "../../src/pipeline/normalize.ts";
import { parse } from "../../src/pipeline/parse.ts";
import { enumerateReadings } from "../../src/pipeline/rank.ts";
import { rewrite } from "../../src/pipeline/rewrite.ts";
import { trieFor } from "../../src/pipeline/trie.ts";

const trie = trieFor("en-US");

function ast(input: string) {
  const readings = enumerateReadings(lex(normalize(input), trie));
  expect(readings).toBeTruthy();
  const converted = readings!.find((tokens) =>
    tokens.some((token) => token.kind === "converter" && token.converter === "in"),
  );
  return parse(rewrite(converted ?? readings![0]!));
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
