/** UnitDef shape, affine kinds, and the seven SI dimension constants. */
import { dimension, rational, type Dimension } from "../quantity/dimension.ts";

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
  readonly scale: number;
  readonly offset: number;
  readonly affine: AffineKind;
  readonly source: UnitSource;
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
