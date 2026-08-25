import { RELATIVE_EPS } from "./numeric.ts";
import type { Quantity } from "./types.ts";

export type FormatConfig = {
  compact?: boolean;
};

export type Formatter = (qty: Quantity) => string;

const SUFFIXES: readonly { suffix: string; size: number }[] = [
  { suffix: "P", size: 1e15 },
  { suffix: "T", size: 1e12 },
  { suffix: "G", size: 1e9 },
  { suffix: "M", size: 1e6 },
  { suffix: "k", size: 1e3 },
];

type NumberFormats = {
  decimal: Intl.NumberFormat;
  scientific: Intl.NumberFormat;
};

function numberFormats(): NumberFormats {
  // `roundingMode` is in ECMA-402 and Node 24; this TS lib's `NumberFormatOptions` omits it.
  const shared = {
    maximumSignificantDigits: 6,
    useGrouping: false,
    roundingMode: "halfExpand",
  } as Intl.NumberFormatOptions;
  return {
    decimal: new Intl.NumberFormat("en-US", shared),
    scientific: new Intl.NumberFormat("en-US", { ...shared, notation: "scientific" }),
  };
}

function toLowerE(text: string): string {
  return text.replaceAll("E", "e").replaceAll("\u2212", "-");
}

function isNearInteger(abs: number, nearest: number): boolean {
  return Math.abs(abs - nearest) <= RELATIVE_EPS * abs;
}

/** Positive, already nudged. Integers use `String`; tiny/huge use scientific. */
function formatMagnitude(mag: number, formats: NumberFormats): string {
  if (mag < 1e-6 || mag >= 1e15) {
    return toLowerE(formats.scientific.format(mag));
  }
  return formats.decimal.format(mag);
}

function formatScaled(scaled: number, formats: NumberFormats): string {
  const nearest = Math.round(scaled);
  if (scaled === 0 || isNearInteger(scaled, nearest)) {
    return String(nearest);
  }
  return formatMagnitude(scaled, formats);
}

function formatCompact(mag: number, formats: NumberFormats): string {
  let index = SUFFIXES.findIndex((entry) => mag >= entry.size);
  if (index < 0) {
    index = SUFFIXES.length - 1;
  }
  let scaled = mag / SUFFIXES[index]!.size;
  let body = formatScaled(scaled, formats);
  if (Number(body) >= 1000 && index > 0) {
    index -= 1;
    scaled = mag / SUFFIXES[index]!.size;
    body = formatScaled(scaled, formats);
  }
  return body + SUFFIXES[index]!.suffix;
}

function formatNumber(
  value: number,
  compact: boolean,
  dimensionless: boolean,
  formats: NumberFormats,
): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  if (value === 0) {
    return "0";
  }
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const nearest = Math.round(abs);
  const integer = isNearInteger(abs, nearest);
  const mag = integer ? nearest : abs;

  if (compact && dimensionless && mag >= 1000 && mag < 1e18) {
    return sign + formatCompact(mag, formats);
  }
  if (integer) {
    return sign + String(mag);
  }
  return sign + formatMagnitude(mag, formats);
}

export function createFormatter(config: FormatConfig = {}): Formatter {
  const compact = config.compact ?? true;
  const formats = numberFormats();
  return (qty) => {
    const number = formatNumber(qty.value, compact, qty.unit.symbol === "", formats);
    return qty.unit.symbol === "" ? number : `${number} ${qty.unit.symbol}`;
  };
}

const defaultFormatter = createFormatter();

export function formatQuantity(qty: Quantity, config?: FormatConfig): string {
  return config === undefined ? defaultFormatter(qty) : createFormatter(config)(qty);
}
