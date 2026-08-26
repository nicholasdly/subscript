/**
 * Catalog row shape. Affine kinds matter for temperature: `20 °C + 5 °C` is
 * a mismatch, `20 °C + 5 Δ°C` is 25 °C. Linear units (metre, kelvin) have
 * scale only.
 */
import { dimension, rational, type Dimension } from "../quantity/dimension.ts";

/**
 * How a unit relates to SI.
 *
 * `"linear"`: scale only (metre, kelvin).
 * `"absolute"`: a point on the scale, with offset (celsius, fahrenheit).
 * `"difference"`: the matching interval, no offset (`delta-celsius`).
 */
export type AffineKind = "linear" | "absolute" | "difference";

export type UnitSource = {
  readonly citation: string;
  readonly url?: string;
  readonly notes?: string;
};

export type UnitDef = {
  readonly id: string;
  readonly symbol: string;
  readonly dimension: Dimension;
  /** Multiply by this to reach the coherent SI unit. */
  readonly scale: number;
  /** Add this (after scaling) to reach SI. Non-zero only for absolute temperatures. */
  readonly offset: number;
  readonly affine: AffineKind;
  readonly source: UnitSource;
  /** Interval sibling of an absolute temperature (`celsius` → `delta-celsius`). */
  readonly differenceId?: string;
};

const ONE = rational(1);
const TWO = rational(2);
const THREE = rational(3);
const NEG_ONE = rational(-1);

export const NONE = dimension();
export const TIME = dimension({ T: ONE });
export const LENGTH = dimension({ L: ONE });
export const MASS = dimension({ M: ONE });
export const TEMPERATURE = dimension({ Θ: ONE });
export const AREA = dimension({ L: TWO });
export const VOLUME = dimension({ L: THREE });
export const SPEED = dimension({ L: ONE, T: NEG_ONE });
