import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

import { Code } from "@/components/code";
import { CodeBlock } from "@/components/code-block";
import { Demo } from "@/components/demo";
import { InstallButton } from "@/components/install-button";

export default function Page() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-20 p-5 py-32">
      <div>
        <h1 className="mb-1 text-xl font-medium tracking-tight">
          <Link
            className="inline-flex items-center gap-2 decoration-1 underline-offset-4 hover:underline"
            href="https://github.com/nicholasdly/subscript"
          >
            @nicholasdly/subscript <ExternalLinkIcon className="size-4" />
          </Link>
        </h1>
        <p className="text-muted-foreground mb-4">
          Evaluate arithmetic, unit conversions, and time zones from natural language — zero
          dependencies or network requests.
        </p>
        <Demo />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Installation</h2>
        <InstallButton />
      </div>

      <div>
        <h2 className="mb-1 text-lg font-medium">Usage</h2>
        <p className="text-muted-foreground mb-4">
          Evaluate natural language queries anywhere in your project using the default configured{" "}
          <Code>evaluate</Code> function.
        </p>
        <CodeBlock language="typescript">
          {[
            'import { evaluate } from "@nicholasdly/subscript";',
            "",
            'evaluate("20 c to f");',
            '// { ok: true, text: "68 °F", ... }',
            "",
            'evaluate("1 m in ft");',
            '// { ok: true, text: "3.28084 ft", ... }',
            "",
            'evaluate("(2 + 3) * 4 km in miles");',
            '// { ok: true, text: "12.4274 mi", ... }',
          ].join("\n")}
        </CodeBlock>
      </div>

      <div>
        <h2 className="mb-1 text-lg font-medium">Configuration</h2>
        <p className="text-muted-foreground mb-4">
          Use <Code>createSubscript</Code> to configure the clock, locale, and format of the parser.
        </p>
        <CodeBlock language="typescript">
          {[
            'import { createSubscript, isZonedTime } from "@nicholasdly/subscript";',
            "",
            "const subscript = createSubscript({",
            "  now: () => ({ epochMilliseconds: Date.UTC(2026, 0, 15, 18, 0, 0) }),",
            "});",
            "",
            'const time = subscript.evaluate("3pm PST in Tokyo");',
            '// time.text === "8:00 AM JST, Jan 16"',
            "// isZonedTime(time.value) === true",
          ].join("\n")}
        </CodeBlock>
      </div>

      <div>
        <h2 className="mb-1 text-lg font-medium">Spans</h2>
        <p className="text-muted-foreground mb-4">
          <Code>spans</Code> returns highlight ranges for the original string. It does not evaluate.
        </p>
        <CodeBlock language="typescript">
          {[
            'createSubscript().spans("20 c to f");',
            "// [",
            '//   { start: 0, end: 2, kind: "number" },',
            '//   { start: 3, end: 4, kind: "unit" },',
            '//   { start: 5, end: 7, kind: "converter" },',
            '//   { start: 8, end: 9, kind: "unit" },',
            "// ]",
          ].join("\n")}
        </CodeBlock>
      </div>

      <div>
        <h2 className="mb-1 text-lg font-medium">Results</h2>
        <p className="text-muted-foreground mb-4">
          The result of an evaluation is a <Code>Result</Code> object, representing either a
          successful answer or a typed failure. Nothing in the API throws for bad input — you check{" "}
          <Code>ok</Code> and then read <Code>value</Code> or <Code>reason</Code> .
        </p>
        <CodeBlock language="typescript">
          {[
            "type Result =",
            "  | {",
            "      ok: true;",
            "      value: Quantity | ZonedTime;",
            "      text: string;",
            "      alternates?: Alternate[];",
            "    }",
            "  | { ok: false; reason: Failure };",
          ].join("\n")}
        </CodeBlock>
      </div>
    </main>
  );
}
