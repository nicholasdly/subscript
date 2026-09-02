import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

import { Code } from "@/components/code";
import { CodeBlock } from "@/components/code-block";
import { Demo } from "@/components/demo";
import { InstallButton } from "@/components/install-button";

export default function Page() {
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-20 p-5 py-32">
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
        <h2 className="mb-1 text-lg font-medium">Results</h2>
        <p className="text-muted-foreground mb-4">
          Queries are parsed into <Code>Result</Code> objects. Be sure to check <Code>ok</Code>{" "}
          before reading the object's contents.
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
