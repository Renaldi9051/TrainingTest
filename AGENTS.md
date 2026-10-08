# AGENTS.md

Panduan untuk AI coding agent (Claude Code) di repo ini. Baca sampai habis sebelum mulai kerja.

## Konteks proyek

Website training provider (adaptasi struktur dari diotraining.com) dengan **panel admin CMS** yang bisa mengubah seluruh konten website (teks, gambar, menu, section beranda, katalog pelatihan, jadwal, dll.).

Dokumen acuan (wajib dibaca sesuai tugas):
- `PRD.md`: ruang lingkup, fitur, model data, API, tahapan. **Sumber kebenaran untuk "apa" yang dibangun.**
- `DESIGN.md`: aturan visual & interaksi. **Wajib diikuti untuk setiap perubahan UI.**

Kalau permintaan bertentangan dengan PRD/DESIGN, berhenti dan tanyakan, jangan menebak.

## Struktur repo

```
BE/      Next.js API-only (Route Handlers), Prisma, PostgreSQL. Port 4000.
FE/      Next.js App Router: halaman publik + panel admin (/admin). Port 3000.
env/     be.env.example, fe.env.example (file asli be.env / fe.env di-gitignore)
docker/  BELUM DIPAKAI. Jangan buat/ubah apa pun di sini sampai diminta.
```

Pembagian tanggung jawab:
- **BE** satu-satunya yang boleh akses database & disk uploads. Semua validasi (Zod), auth, otorisasi role, dan logika bisnis ada di BE.
- **FE** tidak pernah import Prisma atau baca env database. FE ambil data lewat HTTP ke BE.
- FE me-rewrite `/api/*` dan `/uploads/*` ke BE (lihat `FE/next.config.ts`), jadi dari browser semuanya satu origin.

## Tech stack

TypeScript (strict) di semua tempat. Next.js App Router, React, Tailwind CSS, shadcn/ui (admin), Motion, Tiptap, TanStack Query & Table, React Hook Form, Zod, Prisma, PostgreSQL 16, sharp, Vitest, Playwright, lucide-react.

Jangan menambah dependency baru tanpa menyebutkan alasannya di ringkasan perubahan. Jangan mengganti library yang sudah dipilih di atas.

## Perintah

Jalankan dari folder masing-masing (`BE/` atau `FE/`). Env dimuat dari `../env/*.env` lewat `dotenv-cli` di script npm.

```bash
# BE
npm run dev            # dev server :4000
npm run build
npm run lint
npm run typecheck
npm run test           # vitest
npm run db:migrate     # prisma migrate dev (HANYA ke DB dev)
npm run db:seed
npm run db:studio

# FE
npm run dev            # dev server :3000
npm run build
npm run lint
npm run typecheck
npm run test           # vitest
npm run test:e2e       # playwright
```

Kalau script di atas belum ada, buat dengan nama yang sama persis.

## Database (PostgreSQL di VPS)

- DB berjalan di VPS, hanya listen di `127.0.0.1`. Akses dari lokal lewat SSH tunnel ke `localhost:5433` (lihat PRD 7.4).
- `DATABASE_URL` dev menunjuk ke `training_dev`. **Jangan pernah** menjalankan migrasi, seed, reset, atau query tulis ke `training_prod`.
- Perubahan skema selalu lewat `prisma migrate dev --name <deskripsi_singkat>`. Jangan edit file migrasi yang sudah ada. Jangan pakai `db push` kecuali diminta.
- Perintah destruktif (`migrate reset`, `DROP`, `TRUNCATE`, hapus massal) wajib minta izin dulu.
- Seed (`BE/prisma/seed.ts`) berisi konten **placeholder** yang realistis. Jangan menyalin teks panjang, logo, atau foto dari website referensi.

## Env

- File asli: `env/be.env`, `env/fe.env` (gitignored). Contoh: `env/*.env.example` (di-commit).
- Setiap menambah variabel env: tambahkan juga ke file `.example` dengan nilai dummy + komentar singkat, dan validasi di `BE/src/lib/env.ts` / `FE/src/lib/env.ts` pakai Zod.
- Jangan pernah menulis secret asli ke kode, log, commit, atau pesan.

Variabel minimal:
```
# be.env
DATABASE_URL=
SESSION_SECRET=
UPLOAD_DIR=
PUBLIC_BASE_URL=
FE_REVALIDATE_URL=
REVALIDATE_SECRET=

# fe.env
BE_INTERNAL_URL=http://localhost:4000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
REVALIDATE_SECRET=
```

## Konvensi kode

- Kode, nama variabel, nama file: **bahasa Inggris**. Teks UI & pesan error untuk user: **Bahasa Indonesia**.
- File & folder: `kebab-case`. Komponen React: `PascalCase`. Fungsi/variabel: `camelCase`. Tabel Prisma: `PascalCase` singular.
- Server Component secara default di FE. Pakai `"use client"` hanya untuk komponen yang butuh state, efek, atau event.
- BE: route handler tipis, logika di `src/services/<modul>.ts`, schema Zod di `src/lib/validators/<modul>.ts`.
- Format respons API: sukses `{ data, meta? }`, gagal `{ error: { code, message, fields? } }` dengan status HTTP yang benar.
- Setiap endpoint `/api/admin/*` wajib memanggil helper auth + cek role. Jangan mengandalkan proteksi di UI saja.
- Setiap mutasi konten publik wajib: (1) tulis `AuditLog`, (2) panggil revalidate FE dengan tag yang relevan.
- Soft delete (`deletedAt`) untuk entitas konten. Query publik selalu filter `deletedAt: null` dan `status: PUBLISHED`.
- Tipe respons API di FE ada di `FE/src/lib/api/types.ts`. Kalau mengubah bentuk respons BE, update tipe FE di perubahan yang sama.
- Tidak ada konten hardcode di halaman publik selain label UI. Semua judul, paragraf, gambar, link berasal dari BE.
- Tidak ada `any`. Tidak ada `// @ts-ignore` tanpa komentar alasan.

## UI

- Ikuti `DESIGN.md`. Pakai design tokens, jangan hex langsung.
- Komponen dasar ada di `FE/src/components/ui/`. Cek dulu sebelum membuat komponen baru yang mirip.
- Selalu tangani state loading, kosong, dan error.
- Semua animasi harus menghormati `prefers-reduced-motion`.

## Alur kerja per tugas

1. Baca bagian PRD yang relevan (dan DESIGN.md kalau ada UI).
2. Untuk tugas besar (lebih dari ~3 file atau menyentuh skema DB), tulis rencana singkat dulu dan tunggu persetujuan.
3. Kerjakan dalam langkah kecil. Ubah skema → migrasi → service + validator → route → tipe FE → UI.
4. Tulis/update test untuk service & validator BE (Vitest). Tambah e2e Playwright untuk alur kritis (login, CRUD pelatihan, inquiry).
5. Jalankan `lint`, `typecheck`, `test` di app yang diubah. Jangan klaim selesai kalau ada yang gagal.
6. Beri ringkasan: apa yang berubah, file utama, cara mengetes, hal yang belum selesai.

## Definition of Done

- [ ] Sesuai PRD & DESIGN.md
- [ ] `lint`, `typecheck`, `test` lulus
- [ ] Otorisasi role dicek di BE
- [ ] Revalidasi FE terpanggil setelah mutasi
- [ ] State loading/kosong/error ada
- [ ] Env baru tercatat di `.example`
- [ ] Tidak ada secret, `console.log` sisa debug, atau kode mati

## Git

- Commit kecil dengan format Conventional Commits: `feat(be): ...`, `fix(fe): ...`, `chore: ...`, `docs: ...`.
- Jangan commit `env/*.env`, folder `uploads/`, atau `node_modules`.
- Jangan push atau force-push tanpa diminta.

## Hal yang dilarang tanpa izin

- Menyentuh folder `docker/`
- Mengakses atau mengubah database production
- Menjalankan perintah destruktif di DB atau file system
- Mengubah PRD.md atau DESIGN.md (usulkan perubahan di ringkasan saja)
- Menyalin aset (logo, foto, teks panjang) dari website referensi
