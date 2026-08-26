import { describe, expect, test } from "vitest";

import { createSubscript, isZonedTime } from "../../src/index.ts";

const subscript = createSubscript();

function unitId(input: string): string | undefined {
  const result = subscript.evaluate(input);
  if (!result.ok || isZonedTime(result.value)) {
    return undefined;
  }
  return result.value.unit.id;
}

describe("ambiguous in", () => {
  test("1 m in ft prefers converter over inch", () => {
    expect(createSubscript().evaluate("1 m in ft")).toBeQuantity("foot", 1 / 0.3048, 1e-9);
  });

  test("5 ft 11 in uses the inch reading and larger-unit output", () => {
    expect(createSubscript().evaluate("5 ft 11 in")).toBeQuantity("foot", 5.916666666666667, 1e-12);
  });

  test("5 ft 11 in cm converts the mixed length", () => {
    expect(unitId("5 ft 11 in cm")).toBe("centimetre");
  });

  test("11 in is inches", () => {
    expect(unitId("11 in")).toBe("inch");
  });

  test("11 in cm converts inches to centimetres", () => {
    const result = createSubscript().evaluate("11 in cm");
    expect(result).toMatchObject({ ok: true, value: { unit: { id: "centimetre" } } });
    if (result.ok && !isZonedTime(result.value)) {
      expect(result.value.value).toBeGreaterThan(20);
    }
  });
});

describe("arithmetic and offsets", () => {
  test("exponentiation binds before unary minus", () => {
    const negative = subscript.evaluate("-2^2");
    const grouped = subscript.evaluate("(-2)^2");
    expect(negative).toBeQuantity("1", -4);
    expect(grouped).toBeQuantity("1", 4);
  });

  test("compact UTC offsets retain their minutes", () => {
    expect(subscript.evaluate("3pm UTC+0530")).toMatchObject({
      ok: true,
      text: "3:00 PM UTC+5:30",
    });
  });
});
