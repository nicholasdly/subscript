import assert from "node:assert/strict";
import { test } from "node:test";

import { UNIT_ALIASES } from "../src/units/aliases.ts";
import { ZONE_ALIASES } from "../src/zones/aliases.ts";
import { ZONES } from "../src/zones/table.ts";

const RESERVED = new Set(["to", "in", "as", "sqrt", "now", "\u2192"]);

test("zone ids are unique and IANA names are supported", () => {
  const supported = new Set(Intl.supportedValuesOf("timeZone"));
  const seen = new Set<string>();
  for (const zone of ZONES) {
    assert.equal(seen.has(zone.id), false, zone.id);
    seen.add(zone.id);
    if (zone.kind === "iana") {
      assert.ok(supported.has(zone.iana), zone.iana);
    }
  }
});

test("zone aliases are unique and do not collide with units or reserved words", () => {
  const unitAliases = new Set(UNIT_ALIASES.map((row) => row.alias.toLowerCase()));
  const seen = new Set<string>();
  const zoneIds = new Set(ZONES.map((zone) => zone.id));
  for (const row of ZONE_ALIASES) {
    const key = row.alias.toLowerCase();
    assert.equal(seen.has(key), false, `duplicate zone alias ${row.alias}`);
    seen.add(key);
    assert.equal(unitAliases.has(key), false, `zone alias collides with unit: ${row.alias}`);
    assert.equal(RESERVED.has(key), false, `zone alias collides with reserved: ${row.alias}`);
    assert.ok(zoneIds.has(row.id), row.id);
  }
});
