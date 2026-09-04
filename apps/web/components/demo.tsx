"use client";

import { createSubscript } from "@nicholasdly/subscript";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { InputGroup, InputGroupAddon, InputGroupInput } from "./ui/input-group";

const subscript = createSubscript();

const EXAMPLES = ["5 ft 11 in to m", "20 c to f", "(2 + 3) * 4 km in miles", "3pm PST in Tokyo"];

export function Demo() {
  const [query, setQuery] = useState<string>(EXAMPLES[0]!);

  const result = subscript.evaluate(query);

  return (
    <div className="flex flex-col gap-3">
      <InputGroup>
        <InputGroupInput
          aria-label="Query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {result.ok ? <InputGroupAddon align="inline-end">{result.text}</InputGroupAddon> : null}
      </InputGroup>
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((example) => (
          <Button
            key={example}
            type="button"
            size="sm"
            variant={query === example ? "secondary" : "outline"}
            aria-pressed={query === example}
            onClick={() => setQuery(example)}
          >
            {example}
          </Button>
        ))}
      </div>
      <div className="bg-muted text-muted-foreground rounded-lg p-3 font-mono text-sm whitespace-pre">
        {JSON.stringify(result, null, 2)}
      </div>
    </div>
  );
}
