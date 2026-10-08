# TrainingTest

Website training provider + panel admin CMS. Dua app Next.js yang berdiri sendiri:

| Folder | Isi | Port |
|---|---|---|
| `BE/` | API (Route Handlers), satu-satunya yang akses DB & uploads | 4000 |
| `FE/` | Halaman publik + panel admin (`/admin`) | 3000 |
| `docker/` | Dockerfile BE & FE (dipakai `compose.yaml` di root) | |
| `compose.yaml` | Postgres 16 + migrasi/seed + BE + FE | 5433 |

FE me-rewrite `/api/*` dan `/uploads/*` ke BE, jadi browser cukup bicara ke `localhost:3000`.

Dokumen kerja (`PRD.md`, `DESIGN.md`, `AGENTS.md`, `CLAUDE.md`) hanya disimpan di lokal dan tidak ada di repo ini.

## Prasyarat

- Docker Desktop
- Node.js 24 + npm hanya perlu untuk development di host (cara B)

## Setup env

BE dan FE memakai satu file `.env` di root repo. Salin dari contoh lalu isi nilainya:

```bash
cp .env.example .env
```

`.env` tidak di-commit. Script npm di kedua app memuatnya lewat `dotenv-cli`, Prisma memuatnya lewat `BE/prisma.config.ts`, dan masing-masing app hanya memvalidasi variabel miliknya. User, password, dan nama DB di `DATABASE_URL` harus sama dengan `POSTGRES_*`.

## Menjalankan

### Cara A: semua di Docker (paling mudah)

Dari root repo:

```bash
docker compose up --build
```

Buka http://localhost:3000. Urutannya otomatis: Postgres siap → `migrate` menerapkan migrasi + seed (aman diulang) → BE → FE. Container berjalan dalam mode produksi (`next build` + `next start`), jadi setelah kode berubah jalankan ulang `docker compose up --build`.

- Berhenti: `Ctrl+C`, atau `docker compose down` kalau berjalan di background (`-d`). Data database tetap tersimpan di volume.
- Log: `docker compose logs -f be fe`.

### Cara B: development di host (hot reload)

Hanya database yang di Docker. Jangan jalankan bersamaan dengan cara A (port 3000/4000 bentrok); hentikan dulu dengan `docker compose down`.

```bash
# 1. Database + skema + data contoh (dari BE/)
cd BE
npm install              # sekaligus generate Prisma Client
npm run db:up            # start Postgres saja, tunggu sampai healthy
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
| `npm run db:up` / `db:logs` | BE: start dan lihat log container Postgres |
| `npm run db:down` | BE: hentikan semua container proyek (termasuk be/fe dari cara A). Data tidak dihapus |
| `npm run db:generate` | BE: generate Prisma Client |
| `npm run db:migrate` | BE: `prisma migrate dev`. Perubahan skema: `npm run db:migrate -- --name <nama>` |
| `npm run db:seed` | BE: isi data placeholder |
| `npm run db:studio` | BE: Prisma Studio |
| `npm run test:e2e` | FE: belum diimplementasikan |
