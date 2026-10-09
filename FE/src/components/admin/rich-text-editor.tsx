"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BoldIcon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  Redo2Icon,
  Undo2Icon,
  UnlinkIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/admin/ui/popover";
import type { RichTextDoc } from "@/lib/api/types";
import { EMPTY_DOC, isAllowedHref, isRichTextEmpty } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

type RichTextEditorProps = {
  id?: string;
  value: RichTextDoc | null;
  onChange: (value: RichTextDoc | null) => void;
  onBlur?: () => void;
  // Label aksesibel untuk area edit (label visual dipasang lewat FormField).
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  minHeight?: number;
};

// Ekstensi dibatasi sesuai allowlist rich text BE: paragraph, heading 2-3, bold, italic, list,
// blockquote, link (http/https/mailto/tel), hard break. Node lain dimatikan.
function createExtensions() {
  return [
    StarterKit.configure({
      code: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      underline: false,
      heading: { levels: [2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        protocols: ["mailto", "tel"],
        isAllowedUri: (url) => isAllowedHref(url),
      },
    }),
  ];
}

export function RichTextEditor({
  id,
  value,
  onChange,
  onBlur,
  minHeight = 160,
  ...aria
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: createExtensions(),
    content: value ?? EMPTY_DOC,
    // Next merender komponen client di server juga; editor baru dibuat di browser.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        role: "textbox",
        "aria-multiline": "true",
        ...(aria["aria-label"] ? { "aria-label": aria["aria-label"] } : {}),
        ...(aria["aria-labelledby"] ? { "aria-labelledby": aria["aria-labelledby"] } : {}),
        ...(aria["aria-describedby"] ? { "aria-describedby": aria["aria-describedby"] } : {}),
        ...(aria["aria-invalid"] ? { "aria-invalid": "true" } : {}),
        class: "rich-text min-h-[var(--editor-min-height)] px-3 py-3 outline-none",
      },
    },
    onUpdate: ({ editor: current }) => {
      const doc = current.getJSON() as RichTextDoc;
      onChange(isRichTextEmpty(doc) ? null : doc);
    },
    onBlur: () => onBlur?.(),
  });

  // Nilai dari luar berubah (mis. reset form): samakan isi editor tanpa memicu onUpdate.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getJSON() as RichTextDoc;
    const next = value ?? EMPTY_DOC;
    if (isRichTextEmpty(current) && isRichTextEmpty(next)) return;
    if (JSON.stringify(current) !== JSON.stringify(next)) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-bg focus-within:border-ring focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        aria["aria-invalid"] && "border-destructive",
      )}
      style={{ ["--editor-min-height" as string]: `${minHeight}px` }}
    >
      {editor ? <Toolbar editor={editor} /> : <div className="h-10 border-b border-border" />}
      {editor ? (
        <EditorContent editor={editor} />
      ) : (
        <div className="px-3 py-3 text-small text-fg-muted" style={{ minHeight }}>
          Memuat editor...
        </div>
      )}
    </div>
  );
}

type ToolbarButtonProps = {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function ToolbarButton({ icon: Icon, label, active, disabled, onClick }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-8", active && "bg-bg-muted text-fg-strong")}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon strokeWidth={1.5} aria-hidden />
    </Button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      h2: current.isActive("heading", { level: 2 }),
      h3: current.isActive("heading", { level: 3 }),
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      blockquote: current.isActive("blockquote"),
      link: current.isActive("link"),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div
      role="toolbar"
      aria-label="Format teks"
      className="flex flex-wrap items-center gap-0.5 border-b border-border px-1 py-1"
    >
      <ToolbarButton icon={Heading2Icon} label="Judul 2" active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()} />
      <ToolbarButton icon={Heading3Icon} label="Judul 3" active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()} />
      <Divider />
      <ToolbarButton icon={BoldIcon} label="Tebal" active={state.bold} onClick={() => chain().toggleBold().run()} />
      <ToolbarButton icon={ItalicIcon} label="Miring" active={state.italic} onClick={() => chain().toggleItalic().run()} />
      <Divider />
      <ToolbarButton icon={ListIcon} label="Daftar butir" active={state.bulletList} onClick={() => chain().toggleBulletList().run()} />
      <ToolbarButton icon={ListOrderedIcon} label="Daftar bernomor" active={state.orderedList} onClick={() => chain().toggleOrderedList().run()} />
      <ToolbarButton icon={QuoteIcon} label="Kutipan" active={state.blockquote} onClick={() => chain().toggleBlockquote().run()} />
      <Divider />
      <LinkButton editor={editor} active={state.link} />
      <ToolbarButton icon={UnlinkIcon} label="Hapus tautan" disabled={!state.link} onClick={() => chain().extendMarkRange("link").unsetLink().run()} />
      <Divider />
      <ToolbarButton icon={Undo2Icon} label="Urungkan" disabled={!state.canUndo} onClick={() => chain().undo().run()} />
      <ToolbarButton icon={Redo2Icon} label="Ulangi" disabled={!state.canRedo} onClick={() => chain().redo().run()} />
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border" />;
}

function LinkButton({ editor, active }: { editor: Editor; active: boolean }) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setHref((editor.getAttributes("link").href as string | undefined) ?? "");
      setError(null);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const value = href.trim();
    if (!isAllowedHref(value)) {
      setError("Gunakan URL lengkap: https://..., mailto:..., atau tel:...");
      return;
    }
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !active) {
      chain.insertContent({ type: "text", text: value, marks: [{ type: "link", attrs: { href: value } }] }).run();
    } else {
      chain.setLink({ href: value }).run();
    }
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-8", active && "bg-bg-muted text-fg-strong")}
          aria-label="Tautan"
          title="Tautan"
          aria-pressed={active}
        >
          <LinkIcon strokeWidth={1.5} aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        {/* Bukan <form> karena editor biasanya berada di dalam form lain. */}
        <div
          className="space-y-2"
          onKeyDown={(event) => {
            if (event.key === "Enter") onSubmit(event);
          }}
        >
          <Label htmlFor={inputId}>URL tautan</Label>
          <Input
            id={inputId}
            value={href}
            placeholder="https://contoh.com"
            onChange={(event) => setHref(event.target.value)}
            aria-invalid={error ? true : undefined}
            autoFocus
          />
          {error ? <p className="text-small text-status-error">{error}</p> : null}
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={onSubmit}>
              Pasang tautan
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
