import { describe, expect, test } from "vitest";

import { ZONE_ALIASES } from "../../src/time/aliases.ts";
import { ZONES } from "../../src/time/table.ts";
import { UNIT_ALIASES } from "../../src/units/aliases.ts";

const RESERVED = new Set(["to", "in", "as", "sqrt", "now", "\u2192"]);

describe("zone aliases", () => {
  const unitAliases = new Set(UNIT_ALIASES.map((row) => row.alias.toLowerCase()));
  const zoneIds = new Set(ZONES.map((zone) => zone.id));

  test("aliases are unique", () => {
    const aliases = ZONE_ALIASES.map((row) => row.alias.toLowerCase());
    expect(aliases).toEqual([...new Set(aliases)]);
  });

  test.each(ZONE_ALIASES)("$alias maps to $id and does not collide", (row) => {
    const key = row.alias.toLowerCase();
    expect(unitAliases.has(key), `zone alias collides with unit: ${row.alias}`).toBe(false);
    expect(RESERVED.has(key), `zone alias collides with reserved: ${row.alias}`).toBe(false);
    expect(zoneIds.has(row.id), row.id).toBe(true);
  });
});
