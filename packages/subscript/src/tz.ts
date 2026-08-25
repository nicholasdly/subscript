import type { ZonedTime } from "./types.ts";
import { catalogZone, type ZoneDef } from "./zones/table.ts";

export type Wall = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
};

export type TzEngine = {
  wall(epochMs: number, iana: string): Wall;
  instant(wall: Wall, iana: string): number | undefined;
};

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const UTC_ID = /^utc([+-])(\d{2})(\d{2})$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function offsetLabel(offsetMinutes: number): string {
  if (offsetMinutes === 0) {
    return "UTC";
  }
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return minutes === 0 ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${pad2(minutes)}`;
}

export function offsetZoneId(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `utc${sign}${pad2(hours)}${pad2(minutes)}`;
}

function syntheticOffset(id: string): ZoneDef | undefined {
  const match = UTC_ID.exec(id);
  if (match === null) {
    return undefined;
  }
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 14 || (minutes !== 0 && minutes !== 30 && minutes !== 45)) {
    return undefined;
  }
  const offsetMinutes = (hours * 60 + minutes) * (match[1] === "-" ? -1 : 1);
  return {
    id,
    kind: "offset",
    label: offsetLabel(offsetMinutes),
    offsetMinutes,
    source: { citation: "Civil offset, not tzdb rules" },
  };
}

export function lookupZone(id: string): ZoneDef | undefined {
  return catalogZone(id) ?? syntheticOffset(id);
}

export function wallsEqual(a: Wall, b: Wall): boolean {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute &&
    a.second === b.second
  );
}

function wallMs(wall: Wall): number {
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
}

export function offsetWall(epochMs: number, offsetMinutes: number): Wall {
  const shifted = new Date(epochMs + offsetMinutes * MINUTE_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

export function offsetInstant(wall: Wall, offsetMinutes: number): number {
  return wallMs(wall) - offsetMinutes * MINUTE_MS;
}

function partNumber(parts: Intl.DateTimeFormatPart[], type: string): number {
  const part = parts.find((entry) => entry.type === type);
  return part === undefined ? 0 : Number(part.value);
}

function createWallFormatter(iana: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: iana,
    hourCycle: "h23",
    hour12: false,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    numberingSystem: "latn",
  });
}

function partsToWall(parts: Intl.DateTimeFormatPart[]): Wall {
  let hour = partNumber(parts, "hour");
  if (hour === 24) {
    hour = 0;
  }
  return {
    year: partNumber(parts, "year"),
    month: partNumber(parts, "month"),
    day: partNumber(parts, "day"),
    hour,
    minute: partNumber(parts, "minute"),
    second: partNumber(parts, "second"),
  };
}

export function createTzEngine(): TzEngine {
  const formatters = new Map<string, Intl.DateTimeFormat>();

  function formatter(iana: string): Intl.DateTimeFormat {
    let cached = formatters.get(iana);
    if (cached === undefined) {
      cached = createWallFormatter(iana);
      formatters.set(iana, cached);
    }
    return cached;
  }

  function wall(epochMs: number, iana: string): Wall {
    return partsToWall(formatter(iana).formatToParts(new Date(epochMs)));
  }

  function offsetAt(epochMs: number, iana: string): number {
    return wallMs(wall(epochMs, iana)) - epochMs;
  }

  function instant(local: Wall, iana: string): number | undefined {
    try {
      formatter(iana);
    } catch {
      return undefined;
    }

    const wanted = wallMs(local);
    const seeds = [
      wanted,
      wanted - 12 * HOUR_MS,
      wanted + 12 * HOUR_MS,
      wanted - 3 * HOUR_MS,
      wanted + 3 * HOUR_MS,
    ];
    const matches: number[] = [];
    const seen = new Set<number>();

    for (const seed of seeds) {
      let epoch = seed;
      for (let i = 0; i < 8; i++) {
        const next = wanted - offsetAt(epoch, iana);
        if (next === epoch) {
          break;
        }
        epoch = next;
      }
      if (!seen.has(epoch) && wallsEqual(wall(epoch, iana), local)) {
        seen.add(epoch);
        matches.push(epoch);
      }
    }

    const found = matches.length;
    for (let i = 0; i < found; i++) {
      const match = matches[i]!;
      for (const delta of [-HOUR_MS, HOUR_MS, -HOUR_MS / 2, HOUR_MS / 2]) {
        const probe = match + delta;
        if (!seen.has(probe) && wallsEqual(wall(probe, iana), local)) {
          seen.add(probe);
          matches.push(probe);
        }
      }
    }

    matches.sort((a, b) => a - b);
    if (matches.length === 1) {
      return matches[0];
    }
    if (matches.length >= 2) {
      return matches[0];
    }

    const candidates = seeds.map((seed) => wanted - offsetAt(seed, iana));
    candidates.sort((a, b) => a - b);
    return candidates[candidates.length - 1];
  }

  return { wall, instant };
}

const defaultEngine = createTzEngine();

export function zoneWall(epochMs: number, zone: ZoneDef, engine: TzEngine = defaultEngine): Wall {
  return zone.kind === "offset"
    ? offsetWall(epochMs, zone.offsetMinutes)
    : engine.wall(epochMs, zone.iana);
}

export function toZonedTime(
  local: Wall,
  zone: ZoneDef,
  engine: TzEngine = defaultEngine,
  source: Wall = local,
): ZonedTime | undefined {
  const epoch =
    zone.kind === "offset"
      ? offsetInstant(local, zone.offsetMinutes)
      : engine.instant(local, zone.iana);
  if (epoch === undefined) {
    return undefined;
  }
  return {
    kind: "zoned-time",
    epochMilliseconds: epoch,
    timeZone: zone.id,
    label: zone.label,
    sourceYear: source.year,
    sourceMonth: source.month,
    sourceDay: source.day,
  };
}

export function toWall(zoned: ZonedTime, engine: TzEngine = defaultEngine): Wall | undefined {
  const zone = lookupZone(zoned.timeZone);
  if (zone === undefined) {
    return undefined;
  }
  return zoneWall(zoned.epochMilliseconds, zone, engine);
}

export function retarget(zoned: ZonedTime, zone: ZoneDef): ZonedTime {
  return {
    ...zoned,
    timeZone: zone.id,
    label: zone.label,
  };
}
