import { describe, expect, test } from "vitest";

import {
  createTzEngine,
  lookupZone,
  offsetInstant,
  offsetWall,
  toWall,
  toZonedTime,
} from "../../src/time/index.ts";

const engine = createTzEngine();

const WINTER = { year: 2026, month: 1, day: 15, hour: 8, minute: 0, second: 0 };
const SUMMER = { year: 2026, month: 7, day: 16, hour: 8, minute: 0, second: 0 };
const LA_WINTER = { year: 2026, month: 1, day: 15, hour: 15, minute: 0, second: 0 };
const LA_SUMMER = { year: 2026, month: 7, day: 15, hour: 15, minute: 0, second: 0 };

describe("fixed offsets", () => {
  test("PST 15:00 on 2026-01-15 is 23:00 UTC", () => {
    const zone = lookupZone("pst");
    expect(zone).toMatchObject({ kind: "offset" });
    if (zone?.kind !== "offset") {
      return;
    }
    const wall = { year: 2026, month: 1, day: 15, hour: 15, minute: 0, second: 0 };
    expect(offsetInstant(wall, zone.offsetMinutes)).toBe(Date.UTC(2026, 0, 15, 23, 0, 0));
    expect(offsetWall(Date.UTC(2026, 0, 15, 23, 0, 0), zone.offsetMinutes)).toEqual(wall);
  });

  test("synthetic offsets stop at 14:00", () => {
    expect(lookupZone("utc+1400")).toBeDefined();
    expect(lookupZone("utc+1430")).toBeUndefined();
  });
});

describe("IANA", () => {
  test.each([
    { zone: "Asia/Tokyo", local: WINTER, label: "winter" },
    { zone: "Asia/Tokyo", local: SUMMER, label: "summer" },
    { zone: "America/Los_Angeles", local: LA_WINTER, label: "winter" },
    { zone: "America/Los_Angeles", local: LA_SUMMER, label: "summer" },
  ])("round-trip $zone $label", ({ zone, local }) => {
    const epoch = engine.instant(local, zone);
    expect(epoch).toBeDefined();
    expect(engine.wall(epoch!, zone)).toEqual(local);
  });

  test("spring-forward gap uses later (compatible)", () => {
    const gap = { year: 2026, month: 3, day: 8, hour: 2, minute: 30, second: 0 };
    const epoch = engine.instant(gap, "America/Los_Angeles");
    expect(epoch).toBe(Date.UTC(2026, 2, 8, 10, 30, 0));
    expect(engine.wall(epoch!, "America/Los_Angeles")).toEqual({
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
    expect(engine.instant(twice, "America/Los_Angeles")).toBe(Date.UTC(2026, 10, 1, 8, 30, 0));
  });

  test.each([
    { iana: "Asia/Calcutta", utcHour: 6, utcMinute: 30 },
    { iana: "Asia/Katmandu", utcHour: 6, utcMinute: 15 },
  ])("$iana noon is $utcHour:$utcMinute UTC", ({ iana, utcHour, utcMinute }) => {
    const local = { year: 2026, month: 1, day: 15, hour: 12, minute: 0, second: 0 };
    expect(engine.instant(local, iana)).toBe(Date.UTC(2026, 0, 15, utcHour, utcMinute, 0));
  });

  test("invalid IANA does not throw from instant", () => {
    const local = { year: 2026, month: 1, day: 15, hour: 12, minute: 0, second: 0 };
    expect(() => engine.instant(local, "Not/AZone")).not.toThrow();
    expect(engine.instant(local, "Not/AZone")).toBeUndefined();
  });
});

describe("zoned time", () => {
  test("invalid epochs do not reach Intl", () => {
    expect(
      toWall({
        kind: "zoned-time",
        epochMilliseconds: NaN,
        timeZone: "asia-tokyo",
        label: "JST",
        sourceYear: 2026,
        sourceMonth: 1,
        sourceDay: 1,
      }),
    ).toBeUndefined();
  });

  test("toZonedTime then toWall round-trips an offset zone", () => {
    const zone = lookupZone("pst");
    expect(zone).toBeDefined();
    const wall = { year: 2026, month: 1, day: 15, hour: 15, minute: 0, second: 0 };
    const zoned = toZonedTime(wall, zone!, engine);
    expect(zoned).toBeDefined();
    expect(toWall(zoned!, engine)).toEqual(wall);
  });
});
