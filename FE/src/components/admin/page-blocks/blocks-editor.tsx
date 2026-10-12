"use client";

import { ChevronDownIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SortableList } from "@/components/admin/sortable-list";
import { Button } from "@/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { useScopedId } from "@/hooks/use-scoped-id";
import type { Media, PageBlock, PageBlockType } from "@/lib/api/types";
import {
  addBlock,
  blockIndexesFromFormErrors,
  blockSummary,
  createBlock,
  PAGE_BLOCK_DESCRIPTIONS,
  PAGE_BLOCK_LABELS,
  PAGE_BLOCK_TYPES,
  PAGE_BLOCKS_MAX,
  removeBlock,
  reorderBlocks,
  restoreBlock,
  updateBlock,
} from "@/lib/page-blocks";
import { cn } from "@/lib/utils";
import { BlockFields, type BlockErrors } from "./block-fields";

type BlocksEditorProps = {
  value: PageBlock[];
  onChange: (blocks: PageBlock[]) => void;
  // errors.blocks dari React Hook Form (validasi form + error BE blocks.N.field).
  errors: unknown;
  // Bertambah setiap simpan gagal: kartu yang punya error dibuka dan di-scroll ke tampilan.
  errorSignal: number;
  // Struktur berubah (tambah/hapus/urutkan): error ber-index lama tidak berlaku lagi.
  onStructureChange: () => void;
  media: Record<string, Media>;
};

const FIELD_SELECTOR = "input:not([type=hidden]):not([disabled]), textarea, [contenteditable=true], button[role=combobox]";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Editor blok halaman. Hapus blok tidak memakai dialog konfirmasi karena belum tersimpan sampai
// Simpan ditekan; toast menyediakan "Urungkan". Unsaved guard halaman tetap berlaku.
export function BlocksEditor({ value, onChange, errors, errorSignal, onStructureChange, media }: BlocksEditorProps) {
  const sid = useScopedId("blocks");
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  // Blok baru yang field pertamanya perlu difokus setelah menu "Tambah blok" tertutup. Selama menu
  // terbuka Radix menjebak fokus di menu, jadi fokus baru bisa dipindah saat menu menutup.
  const pendingFocusId = useRef<string | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  // Nilai terbaru untuk aksi "Urungkan" yang dijalankan setelah render lain.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const errorIndexes = blockIndexesFromFormErrors(errors);
  const blockErrors = (index: number) => (errors as Record<number, BlockErrors> | undefined)?.[index];

  // Kartu bermasalah yang perlu di-scroll setelah terbuka.
  const scrollToId = useRef<string | null>(null);

  // Simpan gagal: buka semua kartu yang bermasalah, scroll ke yang pertama.
  const handledSignal = useRef(errorSignal);
  useEffect(() => {
    if (errorSignal === handledSignal.current) return;
    // Error RHF bisa tiba satu render setelah sinyal; sinyal baru dianggap selesai setelah ada
    // blok bermasalah yang dibuka.
    const ids = errorIndexes.flatMap((index) => latest.current[index]?.id ?? []);
    if (ids.length === 0) return;
    handledSignal.current = errorSignal;
    scrollToId.current = ids[0];
    setOpenIds((current) => new Set([...current, ...ids]));
  }, [errorSignal, errorIndexes]);

  // Setelah kartu bermasalah terbuka (dirender): scroll ke pesan error pertama di dalamnya.
  useEffect(() => {
    const id = scrollToId.current;
    if (!id || !openIds.has(id)) return;
    scrollToId.current = null;
    const card = cardRefs.current.get(id);
    const target = card?.querySelector<HTMLElement>("[id$='-error'], [role=alert]") ?? card;
    target?.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [openIds]);

  function focusBlock(id: string) {
    const card = cardRefs.current.get(id);
    card?.querySelector<HTMLElement>(FIELD_SELECTOR)?.focus();
    card?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  function toggle(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function add(type: PageBlockType) {
    const block = createBlock(type);
    onStructureChange();
    onChange(addBlock(value, block));
    setOpenIds((current) => new Set([...current, block.id]));
    pendingFocusId.current = block.id;
  }

  function remove(block: PageBlock, index: number) {
    const result = removeBlock(value, block.id);
    if (!result.removed) return;
    const removed = result.removed;
    onStructureChange();
    onChange(result.blocks);
    toast.success(`Blok ${index + 1} (${PAGE_BLOCK_LABELS[block.type]}) dihapus.`, {
      description: "Belum tersimpan sampai Anda menekan Simpan.",
      action: {
        label: "Urungkan",
        onClick: () => {
          onStructureChange();
          onChange(restoreBlock(latest.current, removed));
          setOpenIds((current) => new Set([...current, removed.block.id]));
        },
      },
      duration: 10_000,
    });
  }

  const full = value.length >= PAGE_BLOCKS_MAX;

  return (
    <div className="space-y-4">
      {errorIndexes.length > 0 ? (
        <p role="alert" className="text-small text-status-error">
          {errorIndexes.length === 1
            ? `Blok ${errorIndexes[0] + 1} perlu diperbaiki.`
            : `${errorIndexes.length} blok perlu diperbaiki: ${errorIndexes.map((index) => index + 1).join(", ")}.`}
        </p>
      ) : null}

      {value.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-strong px-4 py-8 text-center text-small text-fg-muted">
          Halaman belum punya blok. Tambahkan blok pertama lewat tombol di bawah.
        </p>
      ) : (
        <SortableList
          items={value}
          itemLabel={(block) => `blok ${value.indexOf(block) + 1} (${PAGE_BLOCK_LABELS[block.type]})`}
          onReorder={(ids) => {
            onStructureChange();
            onChange(reorderBlocks(value, ids));
          }}
          renderItem={(block, handle) => {
            const index = value.indexOf(block);
            const open = openIds.has(block.id);
            const hasError = errorIndexes.includes(index);
            const bodyId = sid(`body-${block.id}`);
            const label = `Blok ${index + 1} (${PAGE_BLOCK_LABELS[block.type]})`;
            return (
              <div
                ref={(element) => {
                  if (element) cardRefs.current.set(block.id, element);
                  else cardRefs.current.delete(block.id);
                }}
                className={cn("py-2", hasError && "border-l-2 border-status-error pl-3")}
                data-block-id={block.id}
              >
                <div className="flex items-center gap-2">
                  {handle}
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1.5 text-left outline-none hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-ring"
                    aria-expanded={open}
                    aria-controls={bodyId}
                    onClick={() => toggle(block.id)}
                  >
                    <span className="font-mono text-xs text-fg-muted">{String(index + 1).padStart(2, "0")}</span>
                    <span className="shrink-0 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
                      {PAGE_BLOCK_LABELS[block.type]}
                    </span>
                    <span className="min-w-0 truncate text-sm text-fg-strong">{blockSummary(block)}</span>
                    {hasError ? <span className="shrink-0 text-small text-status-error">Perlu diperbaiki</span> : null}
                    <ChevronDownIcon
                      className={cn("ml-auto size-4 shrink-0 text-fg-muted transition-transform duration-150", open && "rotate-180")}
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    <span className="sr-only">{open ? `Lipat ${label}` : `Buka ${label}`}</span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Hapus ${label}`}
                    onClick={() => remove(block, index)}
                  >
                    <Trash2Icon strokeWidth={1.5} aria-hidden />
                  </Button>
                </div>
                <div id={bodyId} hidden={!open} className="pt-4 pb-2 pl-10">
                  {open ? (
                    <BlockFields
                      block={block}
                      onChange={(next) => onChange(updateBlock(value, next))}
                      errors={blockErrors(index)}
                      media={media}
                    />
                  ) : null}
                </div>
              </div>
            );
          }}
        />
      )}

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" disabled={full}>
              <PlusIcon aria-hidden />
              Tambah blok
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-80"
            // Menu tertutup karena blok baru dipilih: fokus pindah ke field blok itu, bukan kembali
            // ke tombol "Tambah blok".
            onCloseAutoFocus={(event) => {
              const id = pendingFocusId.current;
              if (!id) return;
              event.preventDefault();
              pendingFocusId.current = null;
              requestAnimationFrame(() => focusBlock(id));
            }}
          >
            {PAGE_BLOCK_TYPES.map((type) => (
              <DropdownMenuItem key={type} onSelect={() => add(type)} className="flex-col items-start gap-0.5">
                <span className="text-sm font-medium">{PAGE_BLOCK_LABELS[type]}</span>
                <span className="text-small text-fg-muted">{PAGE_BLOCK_DESCRIPTIONS[type]}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="font-mono text-xs text-fg-muted">
          {value.length}/{PAGE_BLOCKS_MAX} blok
        </span>
      </div>
    </div>
  );
}
