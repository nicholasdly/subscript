<p>
  <img src="https://badgen.net/npm/v/@nicholasdly/subscript" />
  <img src="https://badgen.net/npm/license/@nicholasdly/subscript" />
</p>

# subscript

Monorepo for [`@nicholasdly/subscript`](https://www.npmjs.com/package/@nicholasdly/subscript): evaluate arithmetic, unit conversions, and time zones from natural language.

```ts
import { evaluate } from "@nicholasdly/subscript";

evaluate("20 c to f");
// { ok: true, text: "68 °F", ... }
```

See [packages/subscript](packages/subscript) for install, API, and usage.

## What's in here

- [`packages/subscript`](packages/subscript) — the published library
- [`apps/web`](apps/web) — a playground for trying queries

```sh
npm install
npm run dev
```

## License

MIT
