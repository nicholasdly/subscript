import { createSubscript, type Subscript } from "./create.ts";
import type { Result } from "./types.ts";

let defaultInstance: Subscript | undefined;

function getDefault(): Subscript {
  defaultInstance ??= createSubscript();
  return defaultInstance;
}

export function evaluate(input: string): Promise<Result> {
  return getDefault().evaluate(input);
}
