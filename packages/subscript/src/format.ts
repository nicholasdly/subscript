import type { Quantity } from "./types.ts";

/** Relative, so it nudges 67.99999999999999 to 68 without flattening 1e-13 to 0. */
const NEAR_INTEGER = 1e-12;

/** M1 stub. M3 replaces it with significant figures and `Intl`. */
function displayNumber(value: number): string {
  const nearest = Math.round(value);
  if (Math.abs(value - nearest) <= NEAR_INTEGER * Math.abs(value)) {
    return String(nearest);
  }
  return String(value);
}

export function formatQuantity(qty: Quantity): string {
  const number = displayNumber(qty.value);
  return qty.unit.symbol === "" ? number : `${number} ${qty.unit.symbol}`;
}
