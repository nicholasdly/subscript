"use client";

import { evaluate } from "@nicholasdly/subscript";
import { BracesIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

export default function Page() {
  const [query, setQuery] = useState("2 lbs in grams");
  const [isOpen, setIsOpen] = useState(true);

  const result = evaluate(query);

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
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex gap-2">
            <InputGroup>
              <InputGroupInput value={query} onChange={(e) => setQuery(e.target.value)} />
              {result.ok && (
                <InputGroupAddon className="font-normal" align="inline-end">
                  {result.text}
                </InputGroupAddon>
              )}
            </InputGroup>
            <CollapsibleTrigger
              render={
                <Button variant="outline" size="icon">
                  <BracesIcon />
                </Button>
              }
            />
          </div>
          <CollapsibleContent className="mt-4">
            <div className="bg-muted overflow-scroll rounded-lg px-3 py-2">
              <pre className="text-muted-foreground font-mono text-sm whitespace-pre">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </main>
  );
}
