import { describe, expect, test } from "vitest";

import { ZONES, type IanaZone } from "../../src/time/table.ts";

describe("zone catalog", () => {
  const supported = Intl.supportedValuesOf("timeZone");
  const ianaZones = ZONES.filter((zone): zone is IanaZone => zone.kind === "iana");

  test("zone ids are unique", () => {
    const ids = ZONES.map((zone) => zone.id);
    expect(ids).toEqual([...new Set(ids)]);
  });

  test.each(ianaZones)("$id IANA name $iana is supported", (zone) => {
    expect(supported).toContain(zone.iana);
  });
});
