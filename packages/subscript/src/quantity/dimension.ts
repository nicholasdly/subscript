/**
 * Dimension vectors: time, length, mass, and temperature, plus information
 * (ISO 80000-13). Ampere, mole, and candela are omitted until the catalog
 * has those units. Used to decide whether two units can convert or combine.
 */
export type Rational = { readonly n: number; readonly d: number };

export type Dimension = readonly [
  Rational, // T — second
  Rational, // L — metre
  Rational, // M — kilogram
  Rational, // Θ — kelvin
  Rational, // info — bit
];

export type DimensionExponents = {
  readonly T?: Rational;
  readonly L?: Rational;
  readonly M?: Rational;
  readonly Θ?: Rational;
  readonly info?: Rational;
};

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a === 0 ? 1 : a;
}

export function rational(n: number, d = 1): Rational {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  if (n === 0) {
    return { n: 0, d: 1 };
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

export function rationalsEqual(a: Rational, b: Rational): boolean {
  return a.n === b.n && a.d === b.d;
}

function addRationals(a: Rational, b: Rational): Rational {
  return rational(a.n * b.d + b.n * a.d, a.d * b.d);
}

function subRationals(a: Rational, b: Rational): Rational {
  return rational(a.n * b.d - b.n * a.d, a.d * b.d);
}

function mulRationals(a: Rational, b: Rational): Rational {
  return rational(a.n * b.n, a.d * b.d);
}

const ZERO = rational(0);

export function dimension(exponents: DimensionExponents = {}): Dimension {
  return [
    exponents.T ?? ZERO,
    exponents.L ?? ZERO,
    exponents.M ?? ZERO,
    exponents.Θ ?? ZERO,
    exponents.info ?? ZERO,
  ];
}

export function dimensionsEqual(a: Dimension, b: Dimension): boolean {
  return (
    rationalsEqual(a[0], b[0]) &&
    rationalsEqual(a[1], b[1]) &&
    rationalsEqual(a[2], b[2]) &&
    rationalsEqual(a[3], b[3]) &&
    rationalsEqual(a[4], b[4])
  );
}

export function isDimensionless(dim: Dimension): boolean {
  return dim.every((exponent) => exponent.n === 0);
}

export function mulDimensions(a: Dimension, b: Dimension): Dimension {
  return [
    addRationals(a[0], b[0]),
    addRationals(a[1], b[1]),
    addRationals(a[2], b[2]),
    addRationals(a[3], b[3]),
    addRationals(a[4], b[4]),
  ];
}

export function divDimensions(a: Dimension, b: Dimension): Dimension {
  return [
    subRationals(a[0], b[0]),
    subRationals(a[1], b[1]),
    subRationals(a[2], b[2]),
    subRationals(a[3], b[3]),
    subRationals(a[4], b[4]),
  ];
}

export function scaleDimension(dim: Dimension, factor: Rational): Dimension {
  return [
    mulRationals(dim[0], factor),
    mulRationals(dim[1], factor),
    mulRationals(dim[2], factor),
    mulRationals(dim[3], factor),
    mulRationals(dim[4], factor),
  ];
}
