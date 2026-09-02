"use client";

import { CheckIcon, CopyIcon } from "lucide-react";

import { useClipboard } from "@/hooks/use-clipboard";

const command = "npm install @nicholasdly/subscript";

export function InstallButton() {
  const { copy, copied } = useClipboard();

  const Icon = copied ? CheckIcon : CopyIcon;

  return (
    <button
      className="hover:bg-muted inline-flex w-full items-center justify-between rounded-lg border px-3 py-2 text-start font-mono text-sm transition-all hover:cursor-copy"
      onClick={() => copy(command)}
    >
      {command} <Icon className="size-4" />
    </button>
  );
}
