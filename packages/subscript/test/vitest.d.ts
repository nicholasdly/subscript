import type { Failure } from "../src/index.ts";
import "vitest";

declare module "vitest" {
  interface Matchers<T = any> {
    toBeQuantity: (unitId: string, value: number, eps?: number) => void;
    toFailWith: (kind: Failure["kind"]) => void;
  }
}
