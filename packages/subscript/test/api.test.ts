import assert from "node:assert/strict";
import { test } from "node:test";

import { createSubscript, evaluate } from "../src/index.ts";
import { stubFetch } from "./fetch-stub.ts";
import { accept } from "./fixtures/accept.ts";
import { reject } from "./fixtures/reject.ts";

const seedInputs = [
  "20 c to f",
  ...accept.map((fixture) => fixture.input),
  ...reject.map((fixture) => fixture.input),
];

async function withStubbedFetch<T>(run: () => Promise<T>): Promise<T> {
  const previous = globalThis.fetch;
  globalThis.fetch = stubFetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = previous;
  }
}

test("evaluate never throws on seed inputs", async () => {
  await withStubbedFetch(async () => {
    for (const input of seedInputs) {
      await assert.doesNotReject(() => evaluate(input));
    }
  });
});

test("createSubscript().evaluate matches evaluate", async () => {
  await withStubbedFetch(async () => {
    const subscript = createSubscript();
    for (const input of seedInputs) {
      assert.deepEqual(await subscript.evaluate(input), await evaluate(input));
    }
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
