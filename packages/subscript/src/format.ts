import { RELATIVE_EPS } from "./numeric.ts";
import { isZonedTime, type EvalValue, type Quantity, type ZonedTime } from "./types.ts";
import { createTzEngine, toWall, type TzEngine } from "./tz.ts";
import { isCurrency } from "./units/kinds.ts";
import { lookupUnit } from "./units/lookup.ts";

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

const MONEY_SUFFIXES: readonly { suffix: string; size: number }[] = [
  { suffix: "P", size: 1e15 },
  { suffix: "T", size: 1e12 },
  { suffix: "B", size: 1e9 },
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

function currencyFormatter(iso: string): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: iso,
      currencyDisplay: "symbol",
      useGrouping: false,
      numberingSystem: "latn",
    });
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      currencyDisplay: "code",
      useGrouping: false,
      numberingSystem: "latn",
    });
  }
}

function stripTrailingZeros(text: string): string {
  if (!text.includes(".")) {
    return text;
  }
  return text.replace(/0+$/, "").replace(/\.$/, "");
}

function formatMoneyCompact(mag: number, maxFrac: number, symbol: string): string {
  const compactFormat = new Intl.NumberFormat("en-US", {
    useGrouping: false,
    numberingSystem: "latn",
    maximumFractionDigits: maxFrac,
    roundingMode: "halfExpand",
  } as Intl.NumberFormatOptions);

  let index = MONEY_SUFFIXES.findIndex((entry) => mag >= entry.size);
  if (index < 0) {
    index = MONEY_SUFFIXES.length - 1;
  }
  let scaled = mag / MONEY_SUFFIXES[index]!.size;
  let body = stripTrailingZeros(compactFormat.format(scaled));
  if (Number(body) >= 1000 && index > 0) {
    index -= 1;
    scaled = mag / MONEY_SUFFIXES[index]!.size;
    body = stripTrailingZeros(compactFormat.format(scaled));
  }
  return symbol + body + MONEY_SUFFIXES[index]!.suffix;
}

function formatMoney(
  value: number,
  id: string,
  symbol: string,
  compact: boolean,
  formatters: Map<string, Intl.NumberFormat>,
): string {
  const iso = id.toUpperCase();
  let formatter = formatters.get(iso);
  if (formatter === undefined) {
    formatter = currencyFormatter(iso);
    formatters.set(iso, formatter);
  }
  if (!Number.isFinite(value)) {
    return String(value);
  }
  const abs = Math.abs(value);
  const nearest = Math.round(abs);
  const integer = value === 0 || isNearInteger(abs, nearest);
  const mag = integer ? nearest : abs;
  if (compact && mag >= 1000 && mag < 1e18) {
    const maxFrac = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    const sign = value < 0 ? "-" : "";
    return sign + formatMoneyCompact(mag, maxFrac, symbol);
  }
  return formatter.format(value).replaceAll("\u2212", "-");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

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
  const currencyFormatters = new Map<string, Intl.NumberFormat>();
  return (value) => {
    if (isZonedTime(value)) {
      return formatZoned(value, engine);
    }
    const def = lookupUnit(value.unit.id);
    if (def !== undefined && isCurrency(def)) {
      return formatMoney(value.value, def.id, def.symbol, compact, currencyFormatters);
    }
    const number = formatNumber(value.value, compact, value.unit.symbol === "", formats);
    return value.unit.symbol === "" ? number : `${number} ${value.unit.symbol}`;
  };
}

const defaultFormatter = createFormatter();

export function formatQuantity(qty: Quantity, config?: FormatConfig): string {
  return config === undefined ? defaultFormatter(qty) : createFormatter(config)(qty);
}
