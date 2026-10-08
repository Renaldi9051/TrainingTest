# TrainingTest

Website training provider + panel admin CMS. Dua app Next.js yang berdiri sendiri:

| Folder | Isi | Port |
|---|---|---|
| `BE/` | API (Route Handlers), satu-satunya yang akses DB & uploads | 4000 |
| `FE/` | Halaman publik + panel admin (`/admin`) | 3000 |

FE me-rewrite `/api/*` dan `/uploads/*` ke BE, jadi browser cukup bicara ke `localhost:3000`.

Dokumen kerja (`PRD.md`, `DESIGN.md`, `AGENTS.md`, `CLAUDE.md`) hanya disimpan di lokal dan tidak ada di repo ini.

## Prasyarat

- Node.js 24 (lihat `.nvmrc`)
- npm

## Setup env

BE dan FE memakai satu file `.env` di root repo. Salin dari contoh lalu isi nilainya:

```bash
cp .env.example .env
```

`.env` tidak di-commit. Script npm di kedua app memuatnya lewat `dotenv-cli`, dan masing-masing app hanya memvalidasi variabel miliknya.

## Menjalankan

Buka dua terminal:

```bash
# terminal 1
cd BE
npm install
npm run dev        # http://localhost:4000

# terminal 2
cd FE
npm install
npm run dev        # http://localhost:3000
```

Cek koneksi FE ke BE:

```bash
curl http://localhost:3000/api/health
# {"data":{"status":"ok"}}
```

## Script

Dijalankan dari `BE/` atau `FE/`:

| Script | Fungsi |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Build produksi |
| `npm run lint` | ESLint |
| `npm run typecheck` | Cek tipe TypeScript |
| `npm run test` | Vitest |
| `npm run db:migrate`, `db:seed`, `db:studio` | BE, belum diimplementasikan |
| `npm run test:e2e` | FE, belum diimplementasikan |
