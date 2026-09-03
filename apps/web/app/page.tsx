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
          A natural language parser and evaluator for unit conversion, time zone conversion, and
          basic math — zero dependencies and tree-shakeable.
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
          Evaluate natural language queries anywhere in your project.
        </p>
        <CodeBlock language="typescript">
          {[
            'import { evaluate } from "@nicholasdly/subscript";',
            "",
            "// ...",
            "",
            'evaluate("1 m in ft");',
            'evaluate("2 - sqrt(25) * -3");',
            'evaluate("now in cst");',
          ].join("\n")}
        </CodeBlock>
      </div>

      <div>
        <h2 className="mb-1 text-lg font-medium">Configuration</h2>
        <p className="text-muted-foreground mb-4">
          When the default <Code>evaluate</Code> function isn't enough, you can use{" "}
          <Code>createSubscript</Code> to configure a custom parser.
        </p>
        <CodeBlock language="typescript">
          {[
            'import { createSubscript } from "@nicholasdly/subscript";',
            "",
            "// ...",
            "",
            "const subscript = createSubscript({",
            "  compact: false,",
            "});",
            "",
            'subscript.evaluate("100000 + 200000");',
          ].join("\n")}
        </CodeBlock>
      </div>

      <div>
        <h2 className="mb-1 text-lg font-medium">Spans</h2>
        <p className="text-muted-foreground mb-4">
          A <Code>Span</Code> is a range over the original query string. They represent which pieces
          of the input are numbers, units, converters, and so on, without exposing the parser's
          internal tokens.
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
          The result of a query is represented as a <Code>Result</Code> object: either a successful
          answer or a typed failure. Nothing in the API throws for bad input — you check{" "}
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
