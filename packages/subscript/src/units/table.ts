import * as numeric from "../numeric.ts";
import {
  AREA,
  LENGTH,
  MASS,
  NONE,
  SPEED,
  TEMPERATURE,
  TIME,
  VOLUME,
  type UnitDef,
} from "./kinds.ts";

const SI_BROCHURE = {
  citation: "SI Brochure 9",
  url: "https://www.bipm.org/en/publications/si-brochure",
};

const NIST_SP811 = {
  citation: "NIST SP 811 Appendix B.8",
  url: "https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8",
};

const NIST_HB44 = {
  citation: "NIST Handbook 44 Appendix C",
  url: "https://www.nist.gov/pml/owm/nist-handbook-44-current",
};

const YARD_POUND_1959 = {
  citation: "International Yard and Pound Agreement (1959)",
  notes: "inch = 0.0254 m, foot = 0.3048 m, avoirdupois pound = 0.45359237 kg, exactly",
};

const INCH_M = 0.0254;
const FOOT_M = 0.3048;
const YARD_M = 0.9144;
const MILE_M = numeric.mul(5280, FOOT_M);
const NAUTICAL_MILE_M = 1852;
const POUND_KG = 0.45359237;
const US_GALLON_M3 = numeric.mul(
  231,
  numeric.mul(numeric.mul(INCH_M, INCH_M), INCH_M),
);
const LITRE_M3 = 0.001;
const IMPERIAL_GALLON_M3 = numeric.mul(4.54609, LITRE_M3);
const DAY_S = 86400;
const YEAR_S = numeric.mul(365.2425, DAY_S);
const CELSIUS_OFFSET = 273.15;
const FAHRENHEIT_SCALE = numeric.div(5, 9);
const FAHRENHEIT_OFFSET = numeric.sub(
  CELSIUS_OFFSET,
  numeric.mul(32, FAHRENHEIT_SCALE),
);

function linear(def: Omit<UnitDef, "offset" | "affine">): UnitDef {
  return {
    affine: "linear",
    offset: 0,
    ...def,
  };
}

function difference(def: Omit<UnitDef, "offset" | "affine">): UnitDef {
  return {
    affine: "difference",
    offset: 0,
    ...def,
  };
}

export const UNITS: readonly UnitDef[] = [
  linear({
    id: "1",
    symbol: "",
    dimension: NONE,
    scale: 1,
    source: {
      citation: "SI Brochure 9",
      notes: "dimensionless one",
    },
  }),

  linear({
    id: "metre",
    symbol: "m",
    dimension: LENGTH,
    scale: 1,
    source: { ...SI_BROCHURE, notes: "SI base unit of length" },
  }),
  linear({
    id: "kilometre",
    symbol: "km",
    dimension: LENGTH,
    scale: 1000,
    source: { ...SI_BROCHURE, notes: "SI prefix kilo-" },
  }),
  linear({
    id: "centimetre",
    symbol: "cm",
    dimension: LENGTH,
    scale: 0.01,
    source: { ...SI_BROCHURE, notes: "SI prefix centi-" },
  }),
  linear({
    id: "millimetre",
    symbol: "mm",
    dimension: LENGTH,
    scale: 0.001,
    source: { ...SI_BROCHURE, notes: "SI prefix milli-" },
  }),
  linear({
    id: "inch",
    symbol: "in",
    dimension: LENGTH,
    scale: INCH_M,
    source: { ...YARD_POUND_1959, notes: "exactly 0.0254 m" },
  }),
  linear({
    id: "foot",
    symbol: "ft",
    dimension: LENGTH,
    scale: FOOT_M,
    source: {
      ...YARD_POUND_1959,
      notes: "international foot, exactly 0.3048 m; not the US survey foot",
    },
  }),
  linear({
    id: "yard",
    symbol: "yd",
    dimension: LENGTH,
    scale: YARD_M,
    source: { ...YARD_POUND_1959, notes: "exactly 0.9144 m" },
  }),
  linear({
    id: "mile",
    symbol: "mi",
    dimension: LENGTH,
    scale: MILE_M,
    source: { ...NIST_SP811, notes: "statute mile = 5280 international feet = 1609.344 m" },
  }),
  linear({
    id: "nautical-mile",
    symbol: "nmi",
    dimension: LENGTH,
    scale: NAUTICAL_MILE_M,
    source: {
      ...SI_BROCHURE,
      notes: "exactly 1852 m (IHO / SI Brochure)",
    },
  }),

  linear({
    id: "kilogram",
    symbol: "kg",
    dimension: MASS,
    scale: 1,
    source: { ...SI_BROCHURE, notes: "SI base unit of mass" },
  }),
  linear({
    id: "gram",
    symbol: "g",
    dimension: MASS,
    scale: 0.001,
    source: { ...SI_BROCHURE, notes: "10^-3 kilogram" },
  }),
  linear({
    id: "milligram",
    symbol: "mg",
    dimension: MASS,
    scale: 1e-6,
    source: { ...SI_BROCHURE, notes: "SI prefix milli-" },
  }),
  linear({
    id: "pound",
    symbol: "lb",
    dimension: MASS,
    scale: POUND_KG,
    source: { ...YARD_POUND_1959, notes: "avoirdupois pound, exactly 0.45359237 kg" },
  }),
  linear({
    id: "ounce",
    symbol: "oz",
    dimension: MASS,
    scale: numeric.div(POUND_KG, 16),
    source: {
      ...YARD_POUND_1959,
      notes: "avoirdupois ounce = pound / 16; not a fluid ounce",
    },
  }),
  linear({
    id: "tonne",
    symbol: "t",
    dimension: MASS,
    scale: 1000,
    source: { ...SI_BROCHURE, notes: "metric ton = 1000 kg" },
  }),

  linear({
    id: "second",
    symbol: "s",
    dimension: TIME,
    scale: 1,
    source: { ...SI_BROCHURE, notes: "SI base unit of time" },
  }),
  linear({
    id: "millisecond",
    symbol: "ms",
    dimension: TIME,
    scale: 0.001,
    source: { ...SI_BROCHURE, notes: "SI prefix milli-" },
  }),
  linear({
    id: "minute",
    symbol: "min",
    dimension: TIME,
    scale: 60,
    source: { ...SI_BROCHURE, notes: "exactly 60 s" },
  }),
  linear({
    id: "hour",
    symbol: "h",
    dimension: TIME,
    scale: 3600,
    source: { ...SI_BROCHURE, notes: "exactly 3600 s" },
  }),
  linear({
    id: "day",
    symbol: "d",
    dimension: TIME,
    scale: DAY_S,
    source: { ...SI_BROCHURE, notes: "exactly 86400 s" },
  }),
  linear({
    id: "week",
    symbol: "wk",
    dimension: TIME,
    scale: numeric.mul(7, DAY_S),
    source: { ...SI_BROCHURE, notes: "exactly 7 days" },
  }),
  linear({
    id: "month",
    symbol: "mo",
    dimension: TIME,
    scale: numeric.div(YEAR_S, 12),
    source: {
      ...SI_BROCHURE,
      notes: "mean Gregorian year / 12; a documented convention, not a calendar month",
    },
  }),
  linear({
    id: "year",
    symbol: "yr",
    dimension: TIME,
    scale: YEAR_S,
    source: {
      ...SI_BROCHURE,
      notes: "mean Gregorian year = 365.2425 days; any year length is wrong somewhere",
    },
  }),

  linear({
    id: "kelvin",
    symbol: "K",
    dimension: TEMPERATURE,
    scale: 1,
    source: { ...SI_BROCHURE, notes: "SI base unit of thermodynamic temperature" },
  }),
  {
    id: "celsius",
    symbol: "°C",
    dimension: TEMPERATURE,
    scale: 1,
    offset: CELSIUS_OFFSET,
    affine: "absolute",
    differenceId: "delta-celsius",
    source: {
      ...SI_BROCHURE,
      notes: "T_K = T_°C + 273.15",
    },
  },
  difference({
    id: "delta-celsius",
    symbol: "Δ°C",
    dimension: TEMPERATURE,
    scale: 1,
    source: {
      ...SI_BROCHURE,
      notes: "Celsius interval; same scale as kelvin, no offset",
    },
  }),
  {
    id: "fahrenheit",
    symbol: "°F",
    dimension: TEMPERATURE,
    scale: FAHRENHEIT_SCALE,
    offset: FAHRENHEIT_OFFSET,
    affine: "absolute",
    differenceId: "delta-fahrenheit",
    source: {
      ...SI_BROCHURE,
      notes: "T_K = T_°F × 5/9 + (273.15 − 32 × 5/9)",
    },
  },
  difference({
    id: "delta-fahrenheit",
    symbol: "Δ°F",
    dimension: TEMPERATURE,
    scale: FAHRENHEIT_SCALE,
    source: {
      ...NIST_SP811,
      notes: "Fahrenheit interval; scale 5/9 kelvin, no offset",
    },
  }),
  linear({
    id: "rankine",
    symbol: "°R",
    dimension: TEMPERATURE,
    scale: FAHRENHEIT_SCALE,
    source: {
      ...NIST_SP811,
      notes: "thermodynamic scale; T_K = T_°R × 5/9",
    },
  }),

  linear({
    id: "metre-squared",
    symbol: "m²",
    dimension: AREA,
    scale: 1,
    source: { ...SI_BROCHURE, notes: "coherent SI derived unit of area" },
  }),
  linear({
    id: "kilometre-squared",
    symbol: "km²",
    dimension: AREA,
    scale: 1e6,
    source: { ...SI_BROCHURE, notes: "SI prefix kilo-, squared" },
  }),
  linear({
    id: "foot-squared",
    symbol: "ft²",
    dimension: AREA,
    scale: numeric.mul(FOOT_M, FOOT_M),
    source: { ...YARD_POUND_1959, notes: "international foot squared" },
  }),
  linear({
    id: "inch-squared",
    symbol: "in²",
    dimension: AREA,
    scale: numeric.mul(INCH_M, INCH_M),
    source: { ...YARD_POUND_1959, notes: "international inch squared" },
  }),
  linear({
    id: "hectare",
    symbol: "ha",
    dimension: AREA,
    scale: 1e4,
    source: { ...SI_BROCHURE, notes: "exactly 10^4 m²" },
  }),
  linear({
    id: "acre",
    symbol: "ac",
    dimension: AREA,
    scale: numeric.mul(4840, numeric.mul(YARD_M, YARD_M)),
    source: {
      ...NIST_SP811,
      notes: "international acre = 4840 yd² with the 1959 yard; SP 811 prints a rounded factor",
    },
  }),

  linear({
    id: "metre-cubed",
    symbol: "m³",
    dimension: VOLUME,
    scale: 1,
    source: { ...SI_BROCHURE, notes: "coherent SI derived unit of volume" },
  }),
  linear({
    id: "litre",
    symbol: "L",
    dimension: VOLUME,
    scale: LITRE_M3,
    source: { ...SI_BROCHURE, notes: "exactly 0.001 m³" },
  }),
  linear({
    id: "millilitre",
    symbol: "mL",
    dimension: VOLUME,
    scale: 1e-6,
    source: { ...SI_BROCHURE, notes: "SI prefix milli-" },
  }),
  linear({
    id: "us-gallon",
    symbol: "gal",
    dimension: VOLUME,
    scale: US_GALLON_M3,
    source: {
      ...NIST_HB44,
      notes: "231 in³ with inch = 0.0254 m; NIST SP 811 prints 3.785412 L (rounded)",
    },
  }),
  linear({
    id: "imperial-gallon",
    symbol: "imp gal",
    dimension: VOLUME,
    scale: IMPERIAL_GALLON_M3,
    source: { ...NIST_SP811, notes: "exactly 4.54609 L" },
  }),
  linear({
    id: "us-fluid-ounce",
    symbol: "fl oz",
    dimension: VOLUME,
    scale: numeric.div(US_GALLON_M3, 128),
    source: { ...NIST_HB44, notes: "US gallon / 128" },
  }),
  linear({
    id: "imperial-fluid-ounce",
    symbol: "imp fl oz",
    dimension: VOLUME,
    scale: numeric.div(IMPERIAL_GALLON_M3, 160),
    source: { ...NIST_SP811, notes: "imperial gallon / 160" },
  }),

  linear({
    id: "metre-per-second",
    symbol: "m/s",
    dimension: SPEED,
    scale: 1,
    source: { ...SI_BROCHURE, notes: "coherent SI derived unit of speed" },
  }),
  linear({
    id: "kilometre-per-hour",
    symbol: "km/h",
    dimension: SPEED,
    scale: numeric.div(1000, 3600),
    source: { ...SI_BROCHURE, notes: "1000 m / 3600 s" },
  }),
  linear({
    id: "mile-per-hour",
    symbol: "mph",
    dimension: SPEED,
    scale: numeric.div(MILE_M, 3600),
    source: { ...NIST_SP811, notes: "international mile / hour" },
  }),
  linear({
    id: "knot",
    symbol: "kn",
    dimension: SPEED,
    scale: numeric.div(NAUTICAL_MILE_M, 3600),
    source: { ...SI_BROCHURE, notes: "nautical mile / hour = 1852 m / 3600 s" },
  }),
];
