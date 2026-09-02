"use client";

import { evaluate } from "@nicholasdly/subscript";
import { useState } from "react";

import { InputGroup, InputGroupAddon, InputGroupInput } from "./ui/input-group";

export function Demo() {
  const [query, setQuery] = useState("6 ft in m");

  const result = evaluate(query);

  return (
    <div className="flex flex-col gap-4">
      <InputGroup>
        <InputGroupInput value={query} onChange={(e) => setQuery(e.target.value)} />
        {result.ok && <InputGroupAddon align="inline-end">{result.text}</InputGroupAddon>}
      </InputGroup>
      <div className="bg-muted text-muted-foreground rounded-lg border p-3 font-mono text-sm whitespace-pre">
        {JSON.stringify(result, null, 2)}
      </div>
    </div>
  );
}
