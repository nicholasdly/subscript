import { describe, expect, test } from "vitest";

import { normalize, sourceIndex } from "../../src/pipeline/normalize.ts";

describe("character mapping", () => {
  test("maps minus, times, divide, and long arrow", () => {
    const result = normalize("1 \u2212 2 \u00d7 3 \u00f7 4 \u27f6 5");
    expect(result.text).toBe("1 - 2 * 3 / 4 \u2192 5");
    expect(result.starts).toHaveLength(result.text.length + 1);
  });

  test("maps compatibility celsius and fahrenheit", () => {
    const c = normalize("20\u2103");
    expect(c.text).toBe("20\u00b0C");
    expect(c.starts).toEqual([0, 1, 2, 2, 3]);

    expect(normalize("68\u2109").text).toBe("68\u00b0F");
  });

  test("maps the angstrom sign to \u00c5", () => {
    expect(normalize("1\u212b").text).toBe("1\u00c5");
  });

  test("folds a.m. and p.m. to am and pm", () => {
    expect(normalize("3 p.m. PST").text).toBe("3 pm PST");
  });

  test("does not fold case or collapse spaces", () => {
    expect(normalize("20  C").text).toBe("20  C");
  });
});

describe("source offsets", () => {
  test("the entry past the end is the length of the source", () => {
    const result = normalize("20 c");
    expect(sourceIndex(result, result.text.length)).toBe(4);
    expect(sourceIndex(result, result.text.length + 1)).toBe(4);
  });

  test("keeps offsets correct across astral characters", () => {
    const result = normalize("\u{1f600}m");
    expect(result.text).toBe("\u{1f600}m");
    expect(sourceIndex(result, 2)).toBe(2);
  });

  test("keeps original offsets when NFC composes characters", () => {
    const result = normalize("sa\u0303o");
    expect(result.text).toBe("s\u00e3o");
    expect(result.starts).toEqual([0, 1, 3, 4]);
  });
});
