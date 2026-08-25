"use client";

import { evaluate } from "@nicholasdly/subscript";
import { useState } from "react";

import { Input } from "@/components/ui/input";

const json = (data: unknown) => JSON.stringify(data, null, 2);

const DEFAULT_QUERY = "2 lbs in grams";

export default function Page() {
  const [query, setQuery] = useState(DEFAULT_QUERY);

  const result = json(evaluate(query));

  return (
    <main className="mx-auto my-8 max-w-md p-5">
      <h1 className="mb-1 text-xl font-medium tracking-tight">nicholasdly/subscript</h1>
      <p className="text-muted-foreground mb-4">
        A natural language parser for unit conversion, time zone conversion, and basic math.
      </p>
      <Input className="mb-4" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="bg-muted overflow-scroll rounded-lg px-3 py-2">
        <p className="text-muted-foreground font-mono text-sm whitespace-pre">{result}</p>
      </div>
    </main>
  );
}
