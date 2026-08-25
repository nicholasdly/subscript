import assert from "node:assert/strict";
import { test } from "node:test";

import { aliasesFor, UNIT_ALIASES, volumeLocale } from "../src/units/aliases.ts";
import { lookupUnit } from "../src/units/lookup.ts";
import { buildTrie, matchTrie } from "../src/units/trie.ts";

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
    const prev = seen.get(row.alias);
    assert.equal(prev, undefined, `duplicate alias ${row.alias}`);
    seen.set(row.alias, row.id);
  }
});

test("every alias id exists in the unit table", () => {
  for (const row of UNIT_ALIASES) {
    assert.notEqual(lookupUnit(row.id), undefined, row.id);
  }
});

test("resolved aliases are unique per locale except in", () => {
  for (const locale of ["en-US", "en-GB"]) {
    const seen = new Map<string, string>();
    for (const row of aliasesFor(locale)) {
      const prev = seen.get(row.alias);
      assert.equal(
        prev,
        undefined,
        `duplicate ${row.alias} in ${locale}: ${prev} vs ${row.id}`,
      );
      seen.set(row.alias, row.id);
    }
  }
});

test("in has exactly two readings", () => {
  const trie = buildTrie("en-US");
  const hit = matchTrie(trie, "in", 0);
  assert.equal(hit?.kind, "ambiguous");
  if (hit?.kind === "ambiguous") {
    assert.equal(hit.converter, "in");
    assert.equal(hit.unitId, "inch");
    assert.equal(hit.length, 2);
  }
});

test("oz is mass, not fluid ounce", () => {
  const trie = buildTrie("en-US");
  const hit = matchTrie(trie, "oz", 0);
  assert.equal(hit?.kind, "unit");
  if (hit?.kind === "unit") {
    assert.equal(hit.unitId, "ounce");
  }
});

test("gal follows locale", () => {
  const us = matchTrie(buildTrie("en-US"), "gal", 0);
  const gb = matchTrie(buildTrie("en-GB"), "gal", 0);
  assert.equal(us?.kind, "unit");
  assert.equal(gb?.kind, "unit");
  if (us?.kind === "unit" && gb?.kind === "unit") {
    assert.equal(us.unitId, "us-gallon");
    assert.equal(gb.unitId, "imperial-gallon");
    assert.notEqual(us.unitId, gb.unitId);
  }
});

test("k is kelvin, km is kilometre, kilo is kilogram", () => {
  const trie = buildTrie("en-US");
  const k = matchTrie(trie, "k", 0);
  const km = matchTrie(trie, "km", 0);
  const kilo = matchTrie(trie, "kilo", 0);
  assert.equal(k?.kind, "unit");
  assert.equal(km?.kind, "unit");
  assert.equal(kilo?.kind, "unit");
  if (k?.kind === "unit" && km?.kind === "unit" && kilo?.kind === "unit") {
    assert.equal(k.unitId, "kelvin");
    assert.equal(km.unitId, "kilometre");
    assert.equal(kilo.unitId, "kilogram");
  }
});
