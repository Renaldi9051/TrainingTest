import { cn } from "@/lib/utils";

// HTML rich text dari BE. Aman dipasang langsung: BE memvalidasi ulang JSON Tiptap dengan allowlist
// (BE/src/lib/rich-text.ts) dan meng-escape semua teks/atribut saat render.
export function RichTextHtml({ html, className }: { html: string; className?: string }) {
  return <div className={cn("rich-text", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
