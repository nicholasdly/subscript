import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/internals.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  splitting: false,
});
