export function Code({ children }: { children: string }) {
  return (
    <code className="bg-muted text-muted-foreground rounded-md border px-1.5 py-0.5 font-mono text-sm">
      {children}
    </code>
  );
}
