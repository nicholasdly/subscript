import type { Quantity } from "./types.ts";

function displayNumber(value: number): string {
  const nearestInteger = Math.round(value);
  if (Math.abs(value - nearestInteger) <= 1e-12) {
    return String(nearestInteger);
  }
  return String(value);
}

export function formatQuantity(qty: Quantity): string {
  if (qty.unit.symbol === "") {
    return displayNumber(qty.value);
  }
  return `${displayNumber(qty.value)} ${qty.unit.symbol}`;
}
