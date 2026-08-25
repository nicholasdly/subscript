import type { Failure, Instant } from "../../src/index.ts";

export const REFERENCE_INSTANT: Instant = {
  epochMilliseconds: Date.UTC(2013, 1, 12, 4, 30, 0),
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
    | { ok: false; reason: Failure["kind"] };
  todo?: boolean;
  notes?: string;
  noFetch?: boolean;
};
