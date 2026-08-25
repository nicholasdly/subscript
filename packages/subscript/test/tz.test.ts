import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createTzEngine,
  lookupZone,
  offsetInstant,
  offsetWall,
  toWall,
  toZonedTime,
  wallsEqual,
} from "../src/tz.ts";

const engine = createTzEngine();

test("PST 15:00 on 2026-01-15 is 23:00 UTC", () => {
  const zone = lookupZone("pst");
  assert.ok(zone);
  assert.equal(zone.kind, "offset");
  if (zone.kind !== "offset") {
    return;
  }
  const wall = { year: 2026, month: 1, day: 15, hour: 15, minute: 0, second: 0 };
  assert.equal(offsetInstant(wall, zone.offsetMinutes), Date.UTC(2026, 0, 15, 23, 0, 0));
  assert.deepEqual(offsetWall(Date.UTC(2026, 0, 15, 23, 0, 0), zone.offsetMinutes), wall);
});

test("IANA round-trip Tokyo winter and summer", () => {
  const winter = { year: 2026, month: 1, day: 15, hour: 8, minute: 0, second: 0 };
  const summer = { year: 2026, month: 7, day: 16, hour: 8, minute: 0, second: 0 };
  for (const local of [winter, summer]) {
    const epoch = engine.instant(local, "Asia/Tokyo");
    assert.ok(epoch !== undefined);
    assert.ok(wallsEqual(engine.wall(epoch!, "Asia/Tokyo"), local));
  }
});

test("IANA round-trip Los Angeles winter and summer", () => {
  const winter = { year: 2026, month: 1, day: 15, hour: 15, minute: 0, second: 0 };
  const summer = { year: 2026, month: 7, day: 15, hour: 15, minute: 0, second: 0 };
  for (const local of [winter, summer]) {
    const epoch = engine.instant(local, "America/Los_Angeles");
    assert.ok(epoch !== undefined);
    assert.ok(wallsEqual(engine.wall(epoch!, "America/Los_Angeles"), local));
  }
});

test("spring-forward gap uses later (compatible)", () => {
  const gap = { year: 2026, month: 3, day: 8, hour: 2, minute: 30, second: 0 };
  const epoch = engine.instant(gap, "America/Los_Angeles");
  assert.equal(epoch, Date.UTC(2026, 2, 8, 10, 30, 0));
  assert.deepEqual(engine.wall(epoch!, "America/Los_Angeles"), {
    year: 2026,
    month: 3,
    day: 8,
    hour: 3,
    minute: 30,
    second: 0,
  });
});

test("fall-back overlap uses earlier (compatible)", () => {
  const twice = { year: 2026, month: 11, day: 1, hour: 1, minute: 30, second: 0 };
  const epoch = engine.instant(twice, "America/Los_Angeles");
  assert.equal(epoch, Date.UTC(2026, 10, 1, 8, 30, 0));
});

test("Kolkata noon is 06:30 UTC", () => {
  const local = { year: 2026, month: 1, day: 15, hour: 12, minute: 0, second: 0 };
  assert.equal(engine.instant(local, "Asia/Calcutta"), Date.UTC(2026, 0, 15, 6, 30, 0));
});

test("Kathmandu noon is 06:15 UTC", () => {
  const local = { year: 2026, month: 1, day: 15, hour: 12, minute: 0, second: 0 };
  assert.equal(engine.instant(local, "Asia/Katmandu"), Date.UTC(2026, 0, 15, 6, 15, 0));
});

test("invalid IANA does not throw from instant", () => {
  const local = { year: 2026, month: 1, day: 15, hour: 12, minute: 0, second: 0 };
  assert.equal(engine.instant(local, "Not/AZone"), undefined);
});

test("toZonedTime then toWall round-trips an offset zone", () => {
  const zone = lookupZone("pst");
  assert.ok(zone);
  const wall = { year: 2026, month: 1, day: 15, hour: 15, minute: 0, second: 0 };
  const zoned = toZonedTime(wall, zone, engine);
  assert.ok(zoned);
  assert.deepEqual(toWall(zoned, engine), wall);
});
