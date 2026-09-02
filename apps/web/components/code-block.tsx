import type { BundledLanguage } from "shiki";
import { codeToHtml } from "shiki";

export async function CodeBlock({
  children,
  language,
}: {
  children: string;
  language: BundledLanguage;
}) {
  const out = await codeToHtml(children, {
    lang: language,
    theme: "github-light",
  });

  return (
    <div
      className="text-sm [&>pre]:overflow-scroll [&>pre]:rounded-lg [&>pre]:border [&>pre]:px-4 [&>pre]:py-4"
      dangerouslySetInnerHTML={{ __html: out }}
    />
  );
}
