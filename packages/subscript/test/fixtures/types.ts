import type { Failure, Instant } from "../../src/index.ts";

export const REFERENCE_INSTANT: Instant = {
  epochMilliseconds: Date.UTC(2013, 1, 12, 4, 30, 0),
};

export const WINTER_NOW: Instant = {
  epochMilliseconds: Date.UTC(2026, 0, 15, 18, 0, 0),
};

export const SUMMER_NOW: Instant = {
  epochMilliseconds: Date.UTC(2026, 6, 15, 18, 0, 0),
};

export type Fixture = {
  name: string;
  input: string;
  locale?: string;
  now?: Instant;
  expect:
    | {
        ok: true;
        text: string;
        unitId: string;
        value: number;
        eps?: number;
      }
    | {
        ok: true;
        text: string;
        zoned: { timeZone: string; label: string; hour: number; minute: number };
      }
    | { ok: false; reason: Failure["kind"] };
  todo?: boolean;
  notes?: string;
  noFetch?: boolean;
};
