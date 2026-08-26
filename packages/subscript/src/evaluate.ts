/** Default `evaluate(input)`. A thin wrapper over a lazily created instance. */
import { createSubscript, type Subscript } from "./create.ts";
import type { Result } from "./types.ts";

let defaultInstance: Subscript | undefined;

function getDefault(): Subscript {
  defaultInstance ??= createSubscript();
  return defaultInstance;
}

export function evaluate(input: string): Result {
  return getDefault().evaluate(input);
}
