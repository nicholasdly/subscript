import assert from "node:assert/strict";
import { test } from "node:test";

import { createSubscript, isZonedTime, type Result } from "../src/index.ts";
import { toWall } from "../src/tz.ts";
import { accept } from "./fixtures/accept.ts";
import { reject } from "./fixtures/reject.ts";
import { REFERENCE_INSTANT, type Fixture } from "./fixtures/types.ts";

const FAILURE_KINDS = new Set([
  "not-an-expression",
  "dimension-mismatch",
  "unknown-unit",
  "ambiguous",
  "precision-loss",
  "limit-exceeded",
]);

const fixtures: Fixture[] = [...accept, ...reject];

const names = new Set<string>();
for (const fixture of fixtures) {
  if (names.has(fixture.name)) {
    throw new Error(`Duplicate fixture name: ${fixture.name}`);
  }
  names.add(fixture.name);
}

function assertWellFormed(result: Result): void {
  assert.equal(typeof result, "object");
  assert.notEqual(result, null);
  assert.equal(typeof result.ok, "boolean");
  if (result.ok) {
    assert.equal(typeof result.text, "string");
    assert.equal(typeof result.value, "object");
  } else {
    assert.equal(typeof result.reason, "object");
    assert.ok(FAILURE_KINDS.has(result.reason.kind), result.reason.kind);
  }
}

function assertExpect(result: Result, expect: Fixture["expect"]): void {
  if (expect.ok) {
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.text, expect.text);
    if ("zoned" in expect) {
      assert.equal(isZonedTime(result.value), true);
      if (isZonedTime(result.value)) {
        assert.equal(result.value.timeZone, expect.zoned.timeZone);
        assert.equal(result.value.label, expect.zoned.label);
        const wall = toWall(result.value);
        assert.ok(wall);
        assert.equal(wall.hour, expect.zoned.hour);
        assert.equal(wall.minute, expect.zoned.minute);
      }
      return;
    }
    assert.equal(isZonedTime(result.value), false);
    if (!isZonedTime(result.value)) {
      assert.equal(result.value.unit.id, expect.unitId);
      const eps = expect.eps ?? 0;
      if (eps === 0) {
        assert.equal(result.value.value, expect.value);
      } else {
        assert.ok(Math.abs(result.value.value - expect.value) <= eps);
      }
    }
    return;
  }
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason.kind, expect.reason);
  }
}

for (const fixture of fixtures) {
  test(fixture.name, (t) => {
    const subscript = createSubscript({
      locale: fixture.locale ?? "en-US",
      now: () => fixture.now ?? REFERENCE_INSTANT,
    });
    const result = subscript.evaluate(fixture.input);
    assertWellFormed(result);
    if (fixture.todo) {
      t.todo();
      return;
    }
    assertExpect(result, fixture.expect);
  });
}
