import assert from "node:assert/strict";
import { test } from "node:test";

import { createSubscript, evaluate, isZonedTime } from "../src/index.ts";
import { stubFetch } from "./fetch-stub.ts";
import { accept } from "./fixtures/accept.ts";
import { reject } from "./fixtures/reject.ts";
import { REFERENCE_INSTANT, WINTER_NOW } from "./fixtures/types.ts";

const seedInputs = [
  "20 c to f",
  ...accept.map((fixture) => fixture.input),
  ...reject.map((fixture) => fixture.input),
];

test("evaluate never throws on seed inputs", async () => {
  const subscript = createSubscript({
    fetch: stubFetch,
    now: () => REFERENCE_INSTANT,
  });
  for (const input of seedInputs) {
    await assert.doesNotReject(() => subscript.evaluate(input));
  }
});

test("createSubscript().evaluate is stable for a fixed now", async () => {
  const a = createSubscript({ fetch: stubFetch, now: () => REFERENCE_INSTANT });
  const b = createSubscript({ fetch: stubFetch, now: () => REFERENCE_INSTANT });
  for (const input of seedInputs) {
    assert.deepEqual(await a.evaluate(input), await b.evaluate(input));
  }
});

test("invalid injected instants fail without rejecting", async () => {
  for (const epochMilliseconds of [NaN, Infinity, 8_640_000_000_000_001]) {
    const subscript = createSubscript({ now: () => ({ epochMilliseconds }) });
    for (const input of ["3pm PST", "now in Tokyo"]) {
      const result = await subscript.evaluate(input);
      assert.deepEqual(result, { ok: false, reason: { kind: "not-an-expression" } });
    }
  }
});

test("failure results do not share mutable state", async () => {
  const subscript = createSubscript();
  const first = await subscript.evaluate("hello");
  assert.equal(first.ok, false);
  if (!first.ok) {
    (first.reason as { kind: string }).kind = "precision-loss";
  }
  assert.deepEqual(await subscript.evaluate("hello"), {
    ok: false,
    reason: { kind: "not-an-expression" },
  });
});

test("spans colors 20 c to f", () => {
  const subscript = createSubscript();
  assert.deepEqual(subscript.spans("20 c to f"), [
    { start: 0, end: 2, kind: "number" },
    { start: 3, end: 4, kind: "unit" },
    { start: 5, end: 7, kind: "converter" },
    { start: 8, end: 9, kind: "unit" },
  ]);
});

test("compact can be disabled per instance", async () => {
  const subscript = createSubscript({ compact: false });
  const result = await subscript.evaluate("1000");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.text, "1000");
  }
});

test("preferDaytime makes 3:00 into 3pm", async () => {
  const subscript = createSubscript({
    now: () => WINTER_NOW,
    ambiguousClock: "preferDaytime",
  });
  const result = await subscript.evaluate("3:00 PST in PST");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.text, "3:00 PM PST");
    assert.equal(isZonedTime(result.value), true);
  }
});

test("free evaluate still works for SI", async () => {
  const result = await evaluate("20 c to f");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.text, "68 °F");
  }
});
