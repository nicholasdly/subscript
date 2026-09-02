import { useCallback, useEffect, useRef, useState } from "react";

import { toast } from "@/components/ui/toast";

export function useClipboard() {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number>(0);

  const copy = useCallback(
    async (text: string) => {
      if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
        toast.add({
          type: "error",
          description: "Clipboard API is unavailable.",
          priority: "high",
        });
      }

      try {
        if (copied) return;
        await navigator.clipboard.writeText(text);

        setCopied(true);
        timeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error(error);

        toast.add({
          type: "error",
          description: "Unable to copy to clipboard.",
          priority: "high",
        });
      }
    },
    [copied, setCopied],
  );

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  return { copy, copied };
}
