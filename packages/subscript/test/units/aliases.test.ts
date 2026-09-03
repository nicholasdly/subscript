import { describe, expect, test } from "vitest";

import { matchTrie, trieFor, type TrieValue } from "../../src/pipeline/trie.ts";
import {
  aliasesFor,
  UNIT_ALIASES,
  volumeLocale,
  type VolumeLocale,
} from "../../src/units/aliases.ts";
import { lookupUnit } from "../../src/units/lookup.ts";

function match(locale: string, text: string): TrieValue | undefined {
  return matchTrie(trieFor(locale), text, 0)?.value;
}

function unitId(locale: string, text: string): string | undefined {
  const value = match(locale, text);
  return value?.kind === "unit" ? value.unitId : undefined;
}

describe("volume locale", () => {
  test.each([
    ["en-US", "us"],
    ["en", "us"],
    ["en-AU", "us"],
    ["de-DE", "us"],
    ["en-GB", "gb"],
    ["en-GB-oxendict", "gb"],
  ] as const)("volumeLocale(%s) is %s", (locale, expected) => {
    expect(volumeLocale(locale)).toBe(expected);
  });
});

describe("alias table", () => {
  test("non-locale aliases are unique", () => {
    const seen = new Map<string, string>();
    for (const row of UNIT_ALIASES) {
      if (row.locale !== undefined) {
        continue;
      }
      expect(seen.get(row.alias), `duplicate alias ${row.alias}`).toBeUndefined();
      seen.set(row.alias, row.id);
    }
  });

  test("every alias id exists in the unit table", () => {
    for (const row of UNIT_ALIASES) {
      expect(lookupUnit(row.id), row.id).toBeDefined();
    }
  });

  test.each(["us", "gb"] as VolumeLocale[])(
    "resolved aliases are unique for %s except in",
    (volume) => {
      const seen = new Map<string, string>();
      for (const row of aliasesFor(volume)) {
        const previous = seen.get(row.alias);
        expect(
          previous,
          `duplicate ${row.alias} in ${volume}: ${previous} vs ${row.id}`,
        ).toBeUndefined();
        seen.set(row.alias, row.id);
      }
    },
  );
});

describe("trie readings", () => {
  test("in has exactly two readings", () => {
    const hit = matchTrie(trieFor("en-US"), "in", 0);
    expect(hit).toMatchObject({
      length: 2,
      value: { kind: "ambiguous", converter: "in", unitId: "inch" },
    });
  });

  test("oz is mass, not fluid ounce", () => {
    expect(unitId("en-US", "oz")).toBe("ounce");
  });

  test.each([
    { locale: "en-US", alias: "gal", id: "us-gallon" },
    { locale: "en-GB", alias: "gal", id: "imperial-gallon" },
    { locale: "en-US", alias: "fl oz", id: "us-fluid-ounce" },
    { locale: "en-GB", alias: "fl oz", id: "imperial-fluid-ounce" },
    { locale: "en-US", alias: "pint", id: "us-pint" },
    { locale: "en-GB", alias: "pint", id: "imperial-pint" },
    { locale: "en-US", alias: "cup", id: "us-cup" },
    { locale: "en-GB", alias: "cup", id: "imperial-cup" },
    { locale: "en-US", alias: "quart", id: "us-quart" },
    { locale: "en-GB", alias: "quart", id: "imperial-quart" },
    { locale: "en-US", alias: "tbsp", id: "us-tablespoon" },
    { locale: "en-GB", alias: "tbsp", id: "imperial-tablespoon" },
  ])("$alias in $locale is $id", ({ locale, alias, id }) => {
    expect(unitId(locale, alias)).toBe(id);
  });

  test("pt is Pacific Time, not pint", () => {
    expect(match("en-US", "pt")).toEqual({ kind: "timezone", zoneId: "america-los-angeles" });
  });

  test.each([
    ["k", "kelvin"],
    ["km", "kilometre"],
    ["kilo", "kilogram"],
  ] as const)("%s is %s", (alias, id) => {
    expect(unitId("en-US", alias)).toBe(id);
  });

  test.each(["\u0394\u00b0C", "\u0394\u00b0F"])("%s is not typeable", (symbol) => {
    expect(match("en-US", symbol)).toBeUndefined();
  });
});
