# TrainingTest

Website training provider + panel admin CMS. Dua app Next.js yang berdiri sendiri:

| Folder | Isi | Port |
|---|---|---|
| `BE/` | API (Route Handlers), satu-satunya yang akses DB & uploads | 4000 |
| `FE/` | Halaman publik + panel admin (`/admin`) | 3000 |
| `docker/` | Postgres 16 untuk development lokal (`compose.dev.yml`) | 5433 |

FE me-rewrite `/api/*` dan `/uploads/*` ke BE, jadi browser cukup bicara ke `localhost:3000`.

Dokumen kerja (`PRD.md`, `DESIGN.md`, `AGENTS.md`, `CLAUDE.md`) hanya disimpan di lokal dan tidak ada di repo ini.

## Prasyarat

- Node.js 24 (lihat `.nvmrc`)
- npm
- Docker Desktop (untuk Postgres dev)

## Setup env

BE dan FE memakai satu file `.env` di root repo. Salin dari contoh lalu isi nilainya:

```bash
cp .env.example .env
```

`.env` tidak di-commit. Script npm di kedua app memuatnya lewat `dotenv-cli`, Prisma memuatnya lewat `BE/prisma.config.ts`, dan masing-masing app hanya memvalidasi variabel miliknya. User, password, dan nama DB di `DATABASE_URL` harus sama dengan `POSTGRES_*`.

## Menjalankan dari nol

```bash
# 1. Database + skema + data contoh (dari BE/)
cd BE
npm install              # sekaligus generate Prisma Client
npm run db:up            # start Postgres di Docker, tunggu sampai healthy
npm run db:migrate       # terapkan migrasi
npm run db:seed          # isi data placeholder (aman diulang)
npm run dev              # http://localhost:4000

# 2. Terminal lain
cd FE
npm install
npm run dev              # http://localhost:3000
```

Cek koneksi FE → BE → database:

```bash
curl http://localhost:3000/api/health
# {"data":{"status":"ok","db":"ok"}}       (HTTP 200)
# {"error":{"code":"DB_UNAVAILABLE",...}}  (HTTP 503 kalau database mati)
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
| `npm run db:up` / `db:down` / `db:logs` | BE: start, stop, dan log container Postgres. `db:down` tidak menghapus data |
| `npm run db:generate` | BE: generate Prisma Client |
| `npm run db:migrate` | BE: `prisma migrate dev`. Perubahan skema: `npm run db:migrate -- --name <nama>` |
| `npm run db:seed` | BE: isi data placeholder |
| `npm run db:studio` | BE: Prisma Studio |
| `npm run test:e2e` | FE: belum diimplementasikan |
