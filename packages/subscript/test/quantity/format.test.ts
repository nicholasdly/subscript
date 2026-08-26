import { describe, expect, test } from "vitest";

import type { Quantity, ZonedTime } from "../../src/index.ts";
import { createFormatter, formatQuantity } from "../../src/quantity/format.ts";

function q(value: number, id = "metre", symbol = "m"): Quantity {
  return { value, unit: { id, symbol } };
}

describe("quantities", () => {
  test.each([
    { name: "a dimensionless quantity prints without a symbol", value: q(20, "1", ""), text: "20" },
    {
      name: "float noise near an integer prints as the integer",
      value: q(67.99999999999999),
      text: "68 m",
    },
    {
      name: "large float noise near an integer prints as the integer",
      value: q(9270.999999999998),
      text: "9271 m",
    },
    { name: "tiny magnitudes survive the relative nudge", value: q(1e-13), text: "1e-13 m" },
    { name: "half is not snapped to an integer", value: q(0.5), text: "0.5 m" },
    { name: "zero prints with a unit", value: q(0), text: "0 m" },
    {
      name: "float noise that is not an integer rounds to six significant figures",
      value: q(27.939999999999998),
      text: "27.94 m",
    },
    {
      name: "metre to foot conversion rounds to six significant figures",
      value: q(1 / 0.3048, "foot", "ft"),
      text: "3.28084 ft",
    },
    {
      name: "litre conversion rounds to six significant figures",
      value: q(3.785411784, "litre", "L"),
      text: "3.78541 L",
    },
    {
      name: "compact thousand is on by default for dimensionless values",
      value: q(1000, "1", ""),
      text: "1k",
    },
    { name: "compact does not attach to a unit", value: q(1000), text: "1000 m" },
    { name: "compact million uses M", value: q(3.3e6, "1", ""), text: "3.3M" },
    {
      name: "metre-squared keeps its symbol",
      value: q(100, "metre-squared", "m\u00b2"),
      text: "100 m\u00b2",
    },
    { name: "negative zero prints as 0", value: q(-0, "1", ""), text: "0" },
  ])("$name", ({ value, text }) => {
    expect(formatQuantity(value)).toBe(text);
  });

  test("compact can be turned off", () => {
    expect(formatQuantity(q(1000, "1", ""), { compact: false })).toBe("1000");
  });
});

describe("zoned time", () => {
  test("prints 12-hour clock, label, and rollover date", () => {
    const format = createFormatter();
    const sameDay: ZonedTime = {
      kind: "zoned-time",
      epochMilliseconds: Date.UTC(2026, 0, 15, 23, 0, 0),
      timeZone: "pst",
      label: "PST",
      sourceYear: 2026,
      sourceMonth: 1,
      sourceDay: 15,
    };
    expect(format(sameDay)).toBe("3:00 PM PST");

    const rolled: ZonedTime = {
      kind: "zoned-time",
      epochMilliseconds: Date.UTC(2026, 0, 15, 23, 0, 0),
      timeZone: "asia-tokyo",
      label: "JST",
      sourceYear: 2026,
      sourceMonth: 1,
      sourceDay: 15,
    };
    expect(format(rolled)).toBe("8:00 AM JST, Jan 16");
  });
});
