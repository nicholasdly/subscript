import assert from "node:assert/strict";
import { test } from "node:test";

import { aliasesFor, UNIT_ALIASES, volumeLocale, type VolumeLocale } from "../src/units/aliases.ts";
import { lookupUnit } from "../src/units/lookup.ts";
import { matchTrie, trieFor, type TrieValue } from "../src/units/trie.ts";

function match(locale: string, text: string): TrieValue | undefined {
  return matchTrie(trieFor(locale), text, 0)?.value;
}

function unitId(locale: string, text: string): string | undefined {
  const value = match(locale, text);
  return value?.kind === "unit" ? value.unitId : undefined;
}

test("volume locale is imperial only for en-GB", () => {
  assert.equal(volumeLocale("en-US"), "us");
  assert.equal(volumeLocale("en"), "us");
  assert.equal(volumeLocale("en-AU"), "us");
  assert.equal(volumeLocale("de-DE"), "us");
  assert.equal(volumeLocale("en-GB"), "gb");
  assert.equal(volumeLocale("en-GB-oxendict"), "gb");
});

test("non-locale aliases are unique", () => {
  const seen = new Map<string, string>();
  for (const row of UNIT_ALIASES) {
    if (row.locale !== undefined) {
      continue;
    }
    const previous = seen.get(row.alias);
    assert.equal(previous, undefined, `duplicate alias ${row.alias}`);
    seen.set(row.alias, row.id);
  }
});

test("every alias id exists in the unit table", () => {
  for (const row of UNIT_ALIASES) {
    assert.notEqual(lookupUnit(row.id), undefined, row.id);
  }
});

test("resolved aliases are unique per locale except in", () => {
  for (const volume of ["us", "gb"] as VolumeLocale[]) {
    const seen = new Map<string, string>();
    for (const row of aliasesFor(volume)) {
      const previous = seen.get(row.alias);
      assert.equal(
        previous,
        undefined,
        `duplicate ${row.alias} in ${volume}: ${previous} vs ${row.id}`,
      );
      seen.set(row.alias, row.id);
    }
  }
});

test("in has exactly two readings", () => {
  const hit = matchTrie(trieFor("en-US"), "in", 0);
  assert.equal(hit?.length, 2);
  assert.equal(hit?.value.kind, "ambiguous");
  if (hit?.value.kind === "ambiguous") {
    assert.equal(hit.value.converter, "in");
    assert.equal(hit.value.unitId, "inch");
  }
});

test("oz is mass, not fluid ounce", () => {
  assert.equal(unitId("en-US", "oz"), "ounce");
});

test("gal follows locale", () => {
  assert.equal(unitId("en-US", "gal"), "us-gallon");
  assert.equal(unitId("en-GB", "gal"), "imperial-gallon");
});

test("k is kelvin, km is kilometre, kilo is kilogram", () => {
  assert.equal(unitId("en-US", "k"), "kelvin");
  assert.equal(unitId("en-US", "km"), "kilometre");
  assert.equal(unitId("en-US", "kilo"), "kilogram");
});

test("fl oz follows locale rather than the us-fluid-ounce symbol", () => {
  assert.equal(unitId("en-US", "fl oz"), "us-fluid-ounce");
  assert.equal(unitId("en-GB", "fl oz"), "imperial-fluid-ounce");
});

test("temperature interval symbols are not typeable", () => {
  for (const symbol of ["\u0394\u00b0C", "\u0394\u00b0F"]) {
    assert.equal(match("en-US", symbol), undefined, symbol);
  }
});
