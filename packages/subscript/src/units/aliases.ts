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
  ...rows("micrometre", [
    "\u00b5m",
    "\u03bcm",
    "um",
    "micron",
    "microns",
    "micrometer",
    "micrometers",
    "micrometre",
    "micrometres",
  ]),
  ...rows("nanometre", ["nm", "nanometer", "nanometers", "nanometre", "nanometres"]),
  ...rows("angstrom", ["\u00c5", "\u00e5", "angstrom", "angstroms"]),
  ...rows("fathom", ["ftm", "fathom", "fathoms"]),
  ...rows("furlong", ["fur", "furlong", "furlongs"]),
  ...rows("astronomical-unit", ["au", "astronomical unit", "astronomical units"]),
  ...rows("light-year", [
    "ly",
    "light year",
    "light years",
    "light-year",
    "light-years",
    "lightyear",
    "lightyears",
  ]),
  ...rows("parsec", ["pc", "parsec", "parsecs"]),
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
  ...rows("us-quart", ["us quart", "us quarts", "us qt", "united states quart"]),
  ...rows("us-quart", ["quart", "quarts", "qt"], "us"),
  ...rows("imperial-quart", [
    "imperial quart",
    "imperial quarts",
    "imp qt",
    "uk quart",
    "uk quarts",
  ]),
  ...rows("imperial-quart", ["quart", "quarts", "qt"], "gb"),
  // `pt` is Pacific Time, so pint is only the word `pint`.
  ...rows("us-pint", ["us pint", "us pints", "united states pint"]),
  ...rows("us-pint", ["pint", "pints"], "us"),
  ...rows("imperial-pint", ["imperial pint", "imperial pints", "uk pint", "uk pints"]),
  ...rows("imperial-pint", ["pint", "pints"], "gb"),
  ...rows("us-cup", ["us cup", "us cups", "united states cup"]),
  ...rows("us-cup", ["cup", "cups"], "us"),
  ...rows("imperial-cup", ["imperial cup", "imperial cups", "uk cup", "uk cups"]),
  ...rows("imperial-cup", ["cup", "cups"], "gb"),
  ...rows("us-tablespoon", [
    "us tablespoon",
    "us tablespoons",
    "us tbsp",
    "united states tablespoon",
  ]),
  ...rows("us-tablespoon", ["tablespoon", "tablespoons", "tbsp", "tbs"], "us"),
  ...rows("imperial-tablespoon", [
    "imperial tablespoon",
    "imperial tablespoons",
    "imp tbsp",
    "uk tablespoon",
    "uk tablespoons",
    "uk tbsp",
  ]),
  ...rows("imperial-tablespoon", ["tablespoon", "tablespoons", "tbsp", "tbs"], "gb"),
  ...rows("metre-per-second", ["m/s", "mps", "meters per second", "metres per second"]),
  ...rows("kilometre-per-hour", ["km/h", "kph", "kilometers per hour", "kilometres per hour"]),
  ...rows("mile-per-hour", ["mph", "mile per hour", "miles per hour"]),
  ...rows("knot", ["kn", "kt", "knot", "knots"]),
  ...rows("newton", ["n", "newton", "newtons"]),
  ...rows("joule", ["j", "joule", "joules"]),
  ...rows("kilojoule", ["kj", "kilojoule", "kilojoules"]),
  ...rows("watt", ["w", "watt", "watts"]),
  ...rows("kilowatt", ["kw", "kilowatt", "kilowatts"]),
  ...rows("pascal", ["pa", "pascal", "pascals"]),
  ...rows("hectopascal", ["hpa", "hectopascal", "hectopascals"]),
  ...rows("kilopascal", ["kpa", "kilopascal", "kilopascals"]),
  ...rows("bit", ["bit", "bits"]),
  ...rows("byte", ["b", "byte", "bytes"]),
  ...rows("kilobyte", ["kb", "kilobyte", "kilobytes"]),
  ...rows("megabyte", ["mb", "megabyte", "megabytes"]),
  ...rows("gigabyte", ["gb", "gigabyte", "gigabytes"]),
  ...rows("terabyte", ["tb", "terabyte", "terabytes"]),
  ...rows("kibibyte", ["kib", "kibibyte", "kibibytes"]),
  ...rows("mebibyte", ["mib", "mebibyte", "mebibytes"]),
  ...rows("gibibyte", ["gib", "gibibyte", "gibibytes"]),
  ...rows("tebibyte", ["tib", "tebibyte", "tebibytes"]),
];

export function aliasesFor(volume: VolumeLocale): readonly UnitAlias[] {
  return UNIT_ALIASES.filter((row) => row.locale === undefined || row.locale === volume);
}
