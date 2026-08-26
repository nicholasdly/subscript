import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/internals.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  target: false,
  fixedExtension: false,
});
