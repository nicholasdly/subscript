import assert from "node:assert/strict";
import { test } from "node:test";

import { dimensionsEqual } from "../src/quantity/dimension.ts";
import {
  AREA,
  LENGTH,
  MASS,
  NONE,
  SPEED,
  TEMPERATURE,
  TIME,
  VOLUME,
  type AffineKind,
} from "../src/units/kinds.ts";
import { UNITS } from "../src/units/table.ts";

const KEBAB = /^[a-z]+(-[a-z]+)*$/;

const BY_DIMENSION: Record<string, typeof LENGTH> = {
  "1": NONE,
  metre: LENGTH,
  kilometre: LENGTH,
  centimetre: LENGTH,
  millimetre: LENGTH,
  inch: LENGTH,
  foot: LENGTH,
  yard: LENGTH,
  mile: LENGTH,
  "nautical-mile": LENGTH,
  kilogram: MASS,
  gram: MASS,
  milligram: MASS,
  pound: MASS,
  ounce: MASS,
  tonne: MASS,
  second: TIME,
  millisecond: TIME,
  minute: TIME,
  hour: TIME,
  day: TIME,
  week: TIME,
  month: TIME,
  year: TIME,
  kelvin: TEMPERATURE,
  celsius: TEMPERATURE,
  "delta-celsius": TEMPERATURE,
  fahrenheit: TEMPERATURE,
  "delta-fahrenheit": TEMPERATURE,
  rankine: TEMPERATURE,
  "metre-squared": AREA,
  "kilometre-squared": AREA,
  "foot-squared": AREA,
  "inch-squared": AREA,
  hectare: AREA,
  acre: AREA,
  "metre-cubed": VOLUME,
  litre: VOLUME,
  millilitre: VOLUME,
  "us-gallon": VOLUME,
  "imperial-gallon": VOLUME,
  "us-fluid-ounce": VOLUME,
  "imperial-fluid-ounce": VOLUME,
  "metre-per-second": SPEED,
  "kilometre-per-hour": SPEED,
  "mile-per-hour": SPEED,
  knot: SPEED,
};

test("every id is unique and kebab-case (except dimensionless 1)", () => {
  const ids = UNITS.map((unit) => unit.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    if (id === "1") {
      continue;
    }
    assert.match(id, KEBAB, id);
  }
});

test("every row has a citation, a positive finite scale, and a finite offset", () => {
  for (const unit of UNITS) {
    assert.notEqual(unit.source.citation.trim(), "", unit.id);
    assert.equal(Number.isFinite(unit.scale), true, unit.id);
    assert.ok(unit.scale > 0, unit.id);
    assert.equal(Number.isFinite(unit.offset), true, unit.id);
    if (unit.affine === "absolute") {
      assert.notEqual(unit.offset, 0, unit.id);
    } else {
      assert.equal(unit.offset, 0, unit.id);
    }
  }
});

test("absolute and difference temperature pairs are exactly the documented set", () => {
  const byAffine = (kind: AffineKind) =>
    UNITS.filter((unit) => unit.affine === kind)
      .map((unit) => unit.id)
      .sort();
  assert.deepEqual(byAffine("absolute"), ["celsius", "fahrenheit"]);
  assert.deepEqual(byAffine("difference"), ["delta-celsius", "delta-fahrenheit"]);
});

test("each unit’s dimension matches its section", () => {
  assert.equal(Object.keys(BY_DIMENSION).length, UNITS.length);
  for (const unit of UNITS) {
    const expected = BY_DIMENSION[unit.id];
    assert.ok(expected, `unexpected id ${unit.id}`);
    assert.equal(dimensionsEqual(unit.dimension, expected), true, unit.id);
  }
});

test("US and imperial gallon scales match the legal definitions", () => {
  const inch = 0.0254;
  const us = UNITS.find((unit) => unit.id === "us-gallon");
  const imp = UNITS.find((unit) => unit.id === "imperial-gallon");
  assert.ok(us);
  assert.ok(imp);
  assert.equal(us.scale, 231 * inch * inch * inch);
  assert.equal(imp.scale, 4.54609 * 0.001);
  assert.equal(us.scale / 0.001, (231 * inch * inch * inch) / 0.001);
  assert.equal(imp.scale / 0.001, (4.54609 * 0.001) / 0.001);
});
