import assert from "node:assert/strict";
import { test } from "node:test";

import { createSubscript } from "../src/index.ts";

const subscript = createSubscript();

async function unitId(input: string): Promise<string | undefined> {
  const result = await subscript.evaluate(input);
  return result.ok ? result.value.unit.id : undefined;
}

test("1 m in ft prefers converter over inch", async () => {
  const result = await createSubscript().evaluate("1 m in ft");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.unit.id, "foot");
  }
});

test("5 ft 11 in uses the inch reading and larger-unit output", async () => {
  const result = await createSubscript().evaluate("5 ft 11 in");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.unit.id, "foot");
    assert.ok(Math.abs(result.value.value - 5.916666666666667) < 1e-12);
  }
});

test("5 ft 11 in cm converts the mixed length", async () => {
  assert.equal(await unitId("5 ft 11 in cm"), "centimetre");
});

test("11 in is inches", async () => {
  assert.equal(await unitId("11 in"), "inch");
});

test("11 in cm converts inches to centimetres", async () => {
  const result = await createSubscript().evaluate("11 in cm");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.unit.id, "centimetre");
    assert.ok(result.value.value > 20);
  }
});
