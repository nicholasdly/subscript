import { describe, expect, test } from "vitest";

import { createSubscript, isZonedTime, type Result } from "../src/index.ts";
import { toWall } from "../src/time/index.ts";
import { accept } from "./fixtures/accept.ts";
import { reject } from "./fixtures/reject.ts";
import { REFERENCE_INSTANT, type Fixture } from "./fixtures/types.ts";

const FAILURE_KINDS = [
  "not-an-expression",
  "dimension-mismatch",
  "unknown-unit",
  "ambiguous",
  "precision-loss",
  "limit-exceeded",
] as const;

const fixtures: Fixture[] = [...accept, ...reject];

function expectWellFormed(result: Result): void {
  expect(result).toEqual(expect.objectContaining({ ok: expect.any(Boolean) }));
  if (result.ok) {
    expect(result.text).toEqual(expect.any(String));
    expect(result.value).toEqual(expect.any(Object));
    return;
  }
  expect(result.reason).toEqual(expect.any(Object));
  expect(FAILURE_KINDS).toContain(result.reason.kind);
}

function expectFixture(result: Result, expected: Fixture["expect"]): void {
  if (!expected.ok) {
    expect.soft(result).toFailWith(expected.reason);
    return;
  }
  expect.soft(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect.soft(result.text).toBe(expected.text);
  if ("zoned" in expected) {
    expect.soft(isZonedTime(result.value)).toBe(true);
    if (!isZonedTime(result.value)) {
      return;
    }
    expect.soft(result.value).toMatchObject({
      timeZone: expected.zoned.timeZone,
      label: expected.zoned.label,
    });
    expect.soft(toWall(result.value)).toMatchObject({
      hour: expected.zoned.hour,
      minute: expected.zoned.minute,
    });
    return;
  }
  expect.soft(result).toBeQuantity(expected.unitId, expected.value, expected.eps);
}

function runFixture(fixture: Fixture): void {
  const subscript = createSubscript({
    locale: fixture.locale ?? "en-US",
    now: () => fixture.now ?? REFERENCE_INSTANT,
  });
  const result = subscript.evaluate(fixture.input);
  expectWellFormed(result);
  expectFixture(result, fixture.expect);
}

describe("fixtures", () => {
  test("names are unique", () => {
    const names = fixtures.map((fixture) => fixture.name);
    expect(names).toEqual([...new Set(names)]);
  });

  describe("accept", () => {
    const pending = accept.filter((fixture) => fixture.todo);
    test.each(accept.filter((fixture) => !fixture.todo))("$name", runFixture);
    if (pending.length > 0) {
      test.todo.each(pending)("$name", runFixture);
    }
  });

  describe("reject", () => {
    const pending = reject.filter((fixture) => fixture.todo);
    test.each(reject.filter((fixture) => !fixture.todo))("$name", runFixture);
    if (pending.length > 0) {
      test.todo.each(pending)("$name", runFixture);
    }
  });
});
