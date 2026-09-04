import { createTzEngine, pad2, toWall, type TzEngine } from "../time/index.ts";
import { isZonedTime, type EvalValue, type Quantity, type ZonedTime } from "../types.ts";
import { RELATIVE_EPS } from "./numeric.ts";

/**
 * Display strings for Quantity and ZonedTime.
 *
 * Rounding is format-time only (six significant figures). Compact notation
 * (`300k`) is output-only — typing `2.5k` is still 2.5 kelvin.
 */

export type FormatConfig = {
  compact?: boolean;
};

export type Formatter = (value: EvalValue) => string;

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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatZoned(zoned: ZonedTime, engine: TzEngine): string {
  const target = toWall(zoned, engine);
  if (target === undefined) {
    return "";
  }
  const hour12 = target.hour % 12 === 0 ? 12 : target.hour % 12;
  const ampm = target.hour < 12 ? "AM" : "PM";
  let clock = `${hour12}:${pad2(target.minute)}`;
  if (target.second !== 0) {
    clock += `:${pad2(target.second)}`;
  }
  let text = `${clock} ${ampm} ${zoned.label}`;
  const rolled =
    target.year !== zoned.sourceYear ||
    target.month !== zoned.sourceMonth ||
    target.day !== zoned.sourceDay;
  if (rolled) {
    const month = MONTHS[target.month - 1] ?? "";
    text += `, ${month} ${target.day}`;
    if (target.year !== zoned.sourceYear) {
      text += `, ${target.year}`;
    }
  }
  return text;
}

export function createFormatter(
  config: FormatConfig = {},
  engine: TzEngine = createTzEngine(),
): Formatter {
  const compact = config.compact ?? true;
  const formats = numberFormats();
  return (value) => {
    if (isZonedTime(value)) {
      return formatZoned(value, engine);
    }
    const number = formatNumber(value.value, compact, value.unit.symbol === "", formats);
    return value.unit.symbol === "" ? number : `${number} ${value.unit.symbol}`;
  };
}

const defaultFormatter = createFormatter();

export function formatQuantity(qty: Quantity, config?: FormatConfig): string {
  return config === undefined ? defaultFormatter(qty) : createFormatter(config)(qty);
}
