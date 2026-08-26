/**
 * float64 ops in one place so a later numeric backend is a contained change.
 * Checked variants refuse precision-loss instead of returning a lie.
 */
export const RELATIVE_EPS = 1e-12;

export type NumericOutcome = { ok: true; value: number } | { ok: false };

export function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

export function add(a: number, b: number): number {
  return a + b;
}

export function sub(a: number, b: number): number {
  return a - b;
}

export function mul(a: number, b: number): number {
  return a * b;
}

export function div(a: number, b: number): number {
  return a / b;
}

export function sqrt(value: number): number {
  return Math.sqrt(value);
}

export function pow(base: number, exp: number): number {
  return base ** exp;
}

/**
 * Operand +/−: refuse a lost addend, snap cancellation residue to 0.
 * Scale math keeps using the primitive `add` / `sub`.
 */
function checked(a: number, b: number, result: number): NumericOutcome {
  if (!isFiniteNumber(result)) {
    return { ok: false };
  }
  if ((b !== 0 && result === a) || (a !== 0 && result === b)) {
    return { ok: false };
  }
  const scale = Math.max(Math.abs(a), Math.abs(b));
  if (scale > 0 && Math.abs(result) <= RELATIVE_EPS * scale) {
    return { ok: true, value: 0 };
  }
  return { ok: true, value: result };
}

export function addChecked(a: number, b: number): NumericOutcome {
  return checked(a, b, a + b);
}

export function subChecked(a: number, b: number): NumericOutcome {
  return addChecked(a, -b);
}
