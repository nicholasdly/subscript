import { FRANKFURTER_ORIGIN } from "../src/rates.ts";
import { isCurrency } from "../src/units/kinds.ts";
import { UNITS } from "../src/units/table.ts";

const TABLE: Readonly<Record<string, number>> = {
  USD: 1,
  EUR: 0.5,
  GBP: 0.5,
  JPY: 100,
  CAD: 2,
  TRY: 30,
};

const KNOWN = new Set(
  UNITS.filter((unit) => isCurrency(unit)).map((unit) => unit.id.toUpperCase()),
);

export let fetchCalls = 0;

export function resetFetchCalls(): void {
  fetchCalls = 0;
}

function hrefOf(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

export const stubFetch: typeof globalThis.fetch = async (input) => {
  fetchCalls += 1;
  const url = new URL(hrefOf(input), FRANKFURTER_ORIGIN);
  const match = /^\/v2\/rate\/([A-Z]{3})\/([A-Z]{3})$/.exec(url.pathname);
  if (match === null) {
    return Response.json({ message: "not found" }, { status: 404 });
  }
  const base = match[1]!;
  const quote = match[2]!;
  if (!KNOWN.has(base) || !KNOWN.has(quote)) {
    return Response.json({ message: `Could not find currency ${base}` }, { status: 422 });
  }
  const from = TABLE[base];
  const to = TABLE[quote];
  if (from === undefined || to === undefined) {
    return Response.json({ message: "No data found" }, { status: 404 });
  }
  return Response.json({
    date: "2013-02-12",
    base,
    quote,
    rate: to / from,
  });
};
