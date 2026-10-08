"use client";

import { InboxIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { FormField } from "@/components/admin/form-field";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";

export function AdminComponentsPreview() {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3">
        <Button>Simpan</Button>
        <Button variant="outline">Batal</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Hapus
        </Button>
        <Button variant="outline" onClick={() => toast.success("Perubahan disimpan.")}>
          Toast sukses
        </Button>
        <Button variant="outline" onClick={() => toast.error("Gagal menyimpan.")}>
          Toast gagal
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge>Default</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="outline" className="text-status-warning">
          Tanpa alt
        </Badge>
      </div>

      <div className="grid max-w-md gap-5">
        <FormField id="preview-title" label="Judul" required description="Tampil di halaman publik.">
          <Input placeholder="Judul pelatihan" />
        </FormField>
        <FormField id="preview-slug" label="Slug" error="Slug sudah dipakai.">
          <Input defaultValue="analisis-laporan" />
        </FormField>
      </div>

      <EmptyState
        icon={InboxIcon}
        title="Belum ada data"
        description="Data yang ditambahkan akan tampil di sini."
        action={<Button>Tambah</Button>}
      />

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Hapus item ini?"
        description="Item dipindahkan ke Sampah dan bisa dipulihkan dalam 30 hari."
        confirmLabel="Hapus"
        destructive
        onConfirm={() => setOpen(false)}
      />
    </div>
  );
}
