/** Spellings people type (`lbs`, `c`, `meters`) mapped to catalog ids. */
export type VolumeLocale = "us" | "gb";

export type UnitAlias = {
  readonly alias: string;
  readonly id: string;
  readonly locale?: VolumeLocale;
};

/** `en-GB` is imperial volume; every other locale is US. */
export function volumeLocale(locale: string): VolumeLocale {
  const parts = locale.toLowerCase().split("-");
  if (parts[0] === "en" && parts[1] === "gb") {
    return "gb";
  }
  return "us";
}

function rows(id: string, aliases: readonly string[], locale?: VolumeLocale): UnitAlias[] {
  return aliases.map((alias) => (locale === undefined ? { alias, id } : { alias, id, locale }));
}

export const UNIT_ALIASES: readonly UnitAlias[] = [
  ...rows("metre", ["m", "meter", "meters", "metre", "metres"]),
  ...rows("kilometre", ["km", "kilometer", "kilometers", "kilometre", "kilometres"]),
  ...rows("centimetre", ["cm", "centimeter", "centimeters", "centimetre", "centimetres"]),
  ...rows("millimetre", ["mm", "millimeter", "millimeters", "millimetre", "millimetres"]),
  ...rows("inch", ["inch", "inches"]),
  ...rows("foot", ["ft", "foot", "feet"]),
  ...rows("yard", ["yd", "yard", "yards"]),
  ...rows("mile", ["mi", "mile", "miles"]),
  ...rows("nautical-mile", ["nmi", "nautical mile", "nautical miles"]),
  ...rows("kilogram", ["kg", "kilogram", "kilograms", "kilo", "kilos"]),
  ...rows("gram", ["g", "gram", "grams"]),
  ...rows("milligram", ["mg", "milligram", "milligrams"]),
  ...rows("pound", ["lb", "lbs", "pound", "pounds"]),
  ...rows("ounce", ["oz", "ounce", "ounces"]),
  ...rows("tonne", ["t", "tonne", "tonnes", "metric ton", "metric tons"]),
  ...rows("second", ["s", "sec", "secs", "second", "seconds"]),
  ...rows("millisecond", ["ms", "msec", "millisecond", "milliseconds"]),
  ...rows("minute", ["min", "mins", "minute", "minutes"]),
  ...rows("hour", ["h", "hr", "hrs", "hour", "hours"]),
  ...rows("day", ["d", "day", "days"]),
  ...rows("week", ["wk", "week", "weeks"]),
  ...rows("month", ["mo", "month", "months"]),
  ...rows("year", ["yr", "year", "years"]),
  ...rows("kelvin", ["k", "kelvin", "kelvins"]),
  ...rows("celsius", ["c", "\u00b0c", "degc", "celsius", "centigrade"]),
  ...rows("fahrenheit", ["f", "\u00b0f", "degf", "fahrenheit"]),
  ...rows("rankine", ["\u00b0r", "rankine"]),
  ...rows("metre-squared", [
    "m\u00b2",
    "m2",
    "m^2",
    "sq m",
    "square meter",
    "square meters",
    "square metre",
    "square metres",
  ]),
  ...rows("kilometre-squared", [
    "km\u00b2",
    "km2",
    "km^2",
    "sq km",
    "square kilometer",
    "square kilometers",
    "square kilometre",
    "square kilometres",
  ]),
  ...rows("foot-squared", ["ft\u00b2", "ft2", "sq ft", "square foot", "square feet"]),
  ...rows("inch-squared", ["in\u00b2", "in2", "sq in", "square inch", "square inches"]),
  ...rows("hectare", ["ha", "hectare", "hectares"]),
  ...rows("acre", ["ac", "acre", "acres"]),
  ...rows("metre-cubed", [
    "m\u00b3",
    "m3",
    "m^3",
    "cu m",
    "cubic meter",
    "cubic meters",
    "cubic metre",
    "cubic metres",
  ]),
  ...rows("litre", ["l", "liter", "liters", "litre", "litres"]),
  ...rows("millilitre", ["ml", "milliliter", "milliliters", "millilitre", "millilitres", "cc"]),
  ...rows("us-gallon", ["us gallon", "us gallons", "us gal", "united states gallon"]),
  ...rows("us-gallon", ["gallon", "gallons", "gal"], "us"),
  ...rows("imperial-gallon", [
    "imperial gallon",
    "imperial gallons",
    "imp gal",
    "uk gallon",
    "uk gallons",
  ]),
  ...rows("imperial-gallon", ["gallon", "gallons", "gal"], "gb"),
  ...rows("us-fluid-ounce", ["us fl oz", "us fluid ounce", "us fluid ounces"]),
  ...rows("us-fluid-ounce", ["fl oz", "fluid ounce", "fluid ounces"], "us"),
  ...rows("imperial-fluid-ounce", ["imp fl oz", "imperial fluid ounce", "imperial fluid ounces"]),
  ...rows("imperial-fluid-ounce", ["fl oz", "fluid ounce", "fluid ounces"], "gb"),
  ...rows("metre-per-second", ["m/s", "mps", "meters per second", "metres per second"]),
  ...rows("kilometre-per-hour", ["km/h", "kph", "kilometers per hour", "kilometres per hour"]),
  ...rows("mile-per-hour", ["mph", "mile per hour", "miles per hour"]),
  ...rows("knot", ["kn", "kt", "knot", "knots"]),
];

export function aliasesFor(volume: VolumeLocale): readonly UnitAlias[] {
  return UNIT_ALIASES.filter((row) => row.locale === undefined || row.locale === volume);
}
