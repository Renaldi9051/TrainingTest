"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SortableListProps<TItem extends { id: string }> = {
  items: TItem[];
  // Dipanggil dengan urutan id baru setelah item dilepas di posisi lain.
  onReorder: (ids: string[]) => void;
  renderItem: (item: TItem, handle: ReactNode) => ReactNode;
  // Label item untuk pengumuman pembaca layar dan tombol grip.
  itemLabel: (item: TItem) => string;
  disabled?: boolean;
  className?: string;
};

// Daftar yang bisa diurutkan dengan drag & drop (mouse/sentuh) atau keyboard:
// fokus ke grip, Spasi untuk angkat, panah atas/bawah, Spasi lagi untuk taruh, Esc untuk batal.
export function SortableList<TItem extends { id: string }>({
  items,
  onReorder,
  renderItem,
  itemLabel,
  disabled,
  className,
}: SortableListProps<TItem>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const labelOf = (id: string | number) => {
    const item = items.find((candidate) => candidate.id === id);
    return item ? itemLabel(item) : "item";
  };

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to).map((item) => item.id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Tekan Spasi untuk mengangkat. Gunakan panah atas/bawah untuk memindahkan, Spasi untuk menaruh, Esc untuk batal.",
        },
        announcements: {
          onDragStart: ({ active }) => `${labelOf(active.id)} diangkat.`,
          onDragOver: ({ active, over }) =>
            over ? `${labelOf(active.id)} di atas posisi ${labelOf(over.id)}.` : `${labelOf(active.id)} di luar daftar.`,
          onDragEnd: ({ active, over }) =>
            over ? `${labelOf(active.id)} ditaruh di posisi ${labelOf(over.id)}.` : `${labelOf(active.id)} ditaruh.`,
          onDragCancel: ({ active }) => `Pemindahan ${labelOf(active.id)} dibatalkan.`,
        },
      }}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul className={cn("divide-y divide-border border-y border-border", className)}>
          {items.map((item) => (
            <SortableRow key={item.id} id={item.id} label={itemLabel(item)} disabled={disabled}>
              {(handle) => renderItem(item, handle)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  label,
  disabled,
  children,
}: {
  id: string;
  label: string;
  disabled?: boolean;
  children: (handle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-fg-muted outline-none hover:bg-bg-muted hover:text-fg-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={`Ubah urutan ${label}`}
      disabled={disabled}
      {...(attributes as ButtonHTMLAttributes<HTMLButtonElement>)}
      {...listeners}
    >
      <GripVerticalIcon className="size-4" strokeWidth={1.5} aria-hidden />
    </button>
  );

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative bg-bg", isDragging && "z-10 bg-bg-subtle")}
    >
      {children(handle)}
    </li>
  );
}
