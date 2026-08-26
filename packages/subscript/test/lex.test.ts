import assert from "node:assert/strict";
import { test } from "node:test";

import { lex } from "../src/pipeline/lex.ts";
import { normalize } from "../src/pipeline/normalize.ts";
import { trieFor } from "../src/pipeline/trie.ts";

const trie = trieFor("en-US");

function tokens(input: string) {
  return lex(normalize(input), trie);
}

test("min is minute, not metre", () => {
  const [number, unit] = tokens("1 min");
  assert.equal(number?.kind, "number");
  assert.equal(unit?.kind, "unit");
  if (unit?.kind === "unit") {
    assert.equal(unit.unitId, "minute");
  }
});

test("m in ft: m is metre, in carries both readings", () => {
  const [, metre, ambiguous, foot] = tokens("1 m in ft");
  assert.equal(metre?.kind, "unit");
  if (metre?.kind === "unit") {
    assert.equal(metre.unitId, "metre");
  }
  assert.equal(ambiguous?.kind, "ambiguous");
  if (ambiguous?.kind === "ambiguous") {
    assert.equal(ambiguous.converter, "in");
    assert.equal(ambiguous.unitId, "inch");
  }
  assert.equal(foot?.kind, "unit");
  if (foot?.kind === "unit") {
    assert.equal(foot.unitId, "foot");
  }
});

test("2km is number then kilometre", () => {
  const result = tokens("2km");
  assert.equal(result.length, 2);
  assert.equal(result[0]?.kind, "number");
  if (result[0]?.kind === "number") {
    assert.equal(result[0].value, 2);
  }
  assert.equal(result[1]?.kind, "unit");
  if (result[1]?.kind === "unit") {
    assert.equal(result[1].unitId, "kilometre");
  }
});

test("offsets for 20 c to f match the original string", () => {
  assert.deepEqual(
    tokens("20 c to f").map((token) => ({
      start: token.start,
      end: token.end,
      kind: token.kind,
    })),
    [
      { start: 0, end: 2, kind: "number" },
      { start: 3, end: 4, kind: "unit" },
      { start: 5, end: 7, kind: "converter" },
      { start: 8, end: 9, kind: "unit" },
    ],
  );
});

test("offsets survive a compatibility character that expands", () => {
  assert.deepEqual(
    tokens("20\u2103").map((token) => ({ start: token.start, end: token.end })),
    [
      { start: 0, end: 2 },
      { start: 2, end: 3 },
    ],
  );
});

test("minimum does not match min", () => {
  const result = tokens("minimum");
  assert.equal(result.length, 1);
  assert.equal(result[0]?.kind, "unknown");
});

test("1e3 is a single number token", () => {
  const result = tokens("1e3");
  assert.equal(result.length, 1);
  assert.equal(result[0]?.kind, "number");
  if (result[0]?.kind === "number") {
    assert.equal(result[0].value, 1000);
  }
});

test("1E-3 is a single number token", () => {
  const result = tokens("1E-3");
  assert.equal(result.length, 1);
  assert.equal(result[0]?.kind, "number");
  if (result[0]?.kind === "number") {
    assert.equal(result[0].value, 0.001);
  }
});

test("1e3m is number then metre", () => {
  const result = tokens("1e3m");
  assert.equal(result.length, 2);
  assert.equal(result[0]?.kind, "number");
  if (result[0]?.kind === "number") {
    assert.equal(result[0].value, 1000);
  }
  assert.equal(result[1]?.kind, "unit");
  if (result[1]?.kind === "unit") {
    assert.equal(result[1].unitId, "metre");
  }
});

test("1e309 is still a number token, non-finite", () => {
  const result = tokens("1e309");
  assert.equal(result.length, 1);
  assert.equal(result[0]?.kind, "number");
  if (result[0]?.kind === "number") {
    assert.equal(result[0].value, Infinity);
  }
});

test("3pm is a clock token", () => {
  const result = tokens("3pm");
  assert.equal(result.length, 1);
  assert.equal(result[0]?.kind, "clock");
  if (result[0]?.kind === "clock") {
    assert.equal(result[0].hour, 15);
    assert.equal(result[0].minute, 0);
  }
});

test("3:00 pm is one clock token covering the space", () => {
  const result = tokens("3:00 pm");
  assert.equal(result.length, 1);
  assert.equal(result[0]?.kind, "clock");
  if (result[0]?.kind === "clock") {
    assert.equal(result[0].hour, 15);
    assert.equal(result[0].start, 0);
    assert.equal(result[0].end, 7);
  }
});

test("15:00 is a 24-hour clock", () => {
  const result = tokens("15:00");
  assert.equal(result[0]?.kind, "clock");
  if (result[0]?.kind === "clock") {
    assert.equal(result[0].hour, 15);
  }
});

test("1:30 is a clock, not a number", () => {
  const result = tokens("1:30");
  assert.equal(result.length, 1);
  assert.equal(result[0]?.kind, "clock");
});

test("GMT+8 is one timezone token", () => {
  const result = tokens("GMT+8");
  assert.equal(result.length, 1);
  assert.equal(result[0]?.kind, "timezone");
  if (result[0]?.kind === "timezone") {
    assert.equal(result[0].zoneId, "utc+0800");
  }
});

test("UTC offsets stop at 14:00", () => {
  assert.equal(tokens("UTC+14")[0]?.kind, "timezone");
  assert.notEqual(tokens("UTC+14:30")[0]?.kind, "timezone");
  assert.notEqual(tokens("UTC+1430")[0]?.kind, "timezone");
});

test("compact UTC offsets include minutes", () => {
  const result = tokens("UTC+0530");
  assert.equal(result.length, 1);
  assert.equal(result[0]?.kind, "timezone");
  if (result[0]?.kind === "timezone") {
    assert.equal(result[0].zoneId, "utc+0530");
  }
});

test("25:00 is not a clock", () => {
  const result = tokens("25:00");
  assert.notEqual(result[0]?.kind, "clock");
});

test("2.5k is still number then kelvin", () => {
  const result = tokens("2.5k");
  assert.equal(result[0]?.kind, "number");
  assert.equal(result[1]?.kind, "unit");
});

test("PST is a timezone", () => {
  const result = tokens("PST");
  assert.equal(result[0]?.kind, "timezone");
  if (result[0]?.kind === "timezone") {
    assert.equal(result[0].zoneId, "pst");
  }
});

test("now is a now token", () => {
  const result = tokens("now");
  assert.equal(result[0]?.kind, "now");
});
