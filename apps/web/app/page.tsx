"use client";

import { evaluate } from "@nicholasdly/subscript";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Input } from "@/components/ui/input";

export default function Page() {
  const [query, setQuery] = useState("2 lbs in grams");

  const result = JSON.stringify(evaluate(query), null, 2);

  return (
    <main className="mx-auto my-8 flex max-w-lg flex-col gap-16 p-5">
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
        <div className="bg-muted overflow-scroll rounded-lg px-3 py-2">
          <pre className="text-muted-foreground font-mono text-sm">
            npm install @nicholasdly/subscript
          </pre>
        </div>
      </div>
      <div>
        <h2 className="mb-1 text-lg font-medium">Demonstration</h2>
        <p className="text-muted-foreground mb-4">
          Enter a natural language query below and see how it's evaluated.
        </p>
        <Input className="mb-4" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="bg-muted overflow-scroll rounded-lg px-3 py-2">
          <pre className="text-muted-foreground font-mono text-sm whitespace-pre">{result}</pre>
        </div>
      </div>
    </main>
  );
}
