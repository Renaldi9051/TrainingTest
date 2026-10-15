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

Buka http://localhost:3000. Urutannya otomatis: Postgres siap → `migrate` menerapkan migrasi + seed → BE sehat → FE. Seed hanya membuat yang belum ada: pengaturan yang sudah ada tidak ditimpa, dan katalog contoh hanya dibuat kalau katalog masih kosong.

Seed juga memasang cover contoh dari `BE/prisma/seed-data/covers/<slug-pelatihan>.jpg` ke pelatihan dengan slug yang sama. Hanya pelatihan yang belum punya cover yang diisi, dan cover yang dilepas admin tidak dipasang lagi. Untuk mengganti gambar secara massal, timpa file JPG dengan nama yang sama (berlaku untuk database baru); untuk satu pelatihan, ganti lewat panel admin.

Container berjalan dalam mode produksi. Selalu pakai `--build` setelah menarik atau mengubah kode, karena `docker compose up` tanpa `--build` memakai image lama, termasuk seed versi lama. Saat start, FE membuat halaman publik dari data BE dulu (sekitar 10–20 detik). Kalau langkah ini gagal, container FE berhenti dengan error dan dicoba lagi. Halaman tidak pernah disajikan dengan data kosong.

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
npm run db:seed          # data placeholder + admin pertama dari ADMIN_* di .env (aman diulang)
npm run db:seed:bulk     # opsional, khusus dev: ~70 kategori + 1.200 pelatihan dummy
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

## Panel admin

Buka http://localhost:3000/admin/login dan masuk dengan `ADMIN_EMAIL` / `ADMIN_PASSWORD` dari `.env`. Seed hanya membuat admin kalau email tersebut belum ada; password admin yang sudah ada tidak ditimpa.

- Login dibatasi 5 kali gagal per 15 menit per IP + email (in-memory, reset saat BE restart).
- Request mutasi (POST/PATCH/PUT/DELETE) wajib membawa header `Origin` yang terdaftar di `ALLOWED_ORIGINS`. Browser mengirimnya otomatis; untuk curl tambahkan `-H "Origin: http://localhost:3000"`.
- File upload disimpan di `UPLOAD_DIR` (dev: folder `uploads/` di root, gitignored) dan dilayani BE di `/uploads/*`. Di Docker, file ada di volume `uploads`.
- Halaman pratinjau komponen: http://localhost:3000/admin/dev/ui (hanya saat `npm run dev`).

## Halaman publik & cache

| URL | Isi |
|---|---|
| `/pelatihan` | Katalog: hasil pencarian dari kolom cari (`?q=`), urutan, 24 per halaman. Tanpa panel filter: kategori hanya dipilih lewat dropdown menu Pelatihan di header. State di URL: `?q=&urut=&hal=` |
| `/pelatihan/kategori/<slug>` | Landing kategori: deskripsi + 24 pelatihan terbaru, tautan ke katalog terfilter |
| `/pelatihan/<slug>` | Detail, jadwal terdekat, CTA WhatsApp, pelatihan terkait, JSON-LD Course/Event |
| `/jadwal` | Daftar sesi, filter bulan/kota/kategori |

- Data publik di-cache di FE (`"use cache"` + tag). Setelah admin menyimpan, BE memanggil `POST /api/revalidate` FE, sehingga perubahan tampil dalam hitungan detik tanpa redeploy.
- Pelatihan dengan waktu tayang di masa depan ditayangkan otomatis oleh scheduler di BE (cek setiap 30 detik). Scheduler menyala bersama server BE; setelah mengubah `BE/src/instrumentation.ts`, restart BE.
- Halaman detail & landing kategori statis penuh: slug yang tidak ada mendapat HTTP 404.
- **Build FE (`next build`) butuh BE yang bisa dihubungi** di `BE_INTERNAL_URL`, karena halaman publik di-prerender dengan data dari BE. Jalankan BE (dan database) sebelum build.
- Pratinjau draf: tombol "Pratinjau" di form pelatihan (draft mode Next, hanya untuk sesi admin).

## Import jadwal (CSV)

Admin → Jadwal → Import CSV. Unduh template, isi, unggah, periksa pratinjau per baris, lalu simpan. Semua baris disimpan sekaligus atau tidak sama sekali.

| Kolom | Format |
|---|---|
| `training_slug` | slug pelatihan yang ada (wajib) |
| `start_date`, `end_date` | `YYYY-MM-DD` (wajib) |
| `city`, `venue` | teks, opsional |
| `method` | `online` / `offline` / `hybrid` (wajib) |
| `price` | Rupiah tanpa desimal, mis. `4500000` atau `4.500.000`, opsional |
| `status` | `DIBUKA` / `PENUH` / `SELESAI`, kosong = `DIBUKA` |

File boleh dipisah koma atau titik koma (Excel versi Indonesia), maks. 1.000 baris / 1 MB.

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
| `npm run db:down` | BE: hentikan container Postgres saja (`docker compose stop db`). Data tidak dihapus |
| `npm run stack:down` | BE: hentikan dan hapus semua container proyek (db, migrate, be, fe). Data di volume tidak dihapus |
| `npm run check` | BE/FE: lint + typecheck + test. Wajib lulus sebelum commit |
| `npm run db:generate` | BE: generate Prisma Client |
| `npm run db:migrate` | BE: `prisma migrate dev`. Perubahan skema: `npm run db:migrate -- --name <nama>` |
| `npm run db:seed` | BE: isi katalog referensi (maks. 10 pelatihan per kategori), 392 kategori dan 77 submenu Pelatihan, serta admin pertama; aman dijalankan ulang |
| `npm run db:seed:bulk` | BE, khusus dev: ~70 kategori + 1.200 pelatihan dummy + jadwal. Menolak jalan untuk database bernama `*prod*` |
| `npm run bench:search` | BE: ukur latensi search katalog (p50/p95/p99) lewat HTTP ke BE yang sedang jalan. Target p95 < 300 ms |
| `npm run db:studio` | BE: Prisma Studio |
| `npm run test:e2e` | FE: Playwright. Tidak memakai `training_dev`: menyalakan BE (:4100) dan FE (:3100) khusus e2e dengan database `training_e2e` (`DATABASE_URL_E2E`), yang di-drop, dimigrasi, dan di-seed ulang di awal setiap run. Bisa jalan bersamaan dengan `npm run dev`. Butuh container Postgres (`npm run db:up`). Sekali saja: `npx playwright install chromium` |

## Katalog pelatihan dari referensi publik

Seed standar mengisi katalog lokal dari snapshot metadata publik Diorama yang tersimpan di
`BE/prisma/seed-data/reference-catalog.json` (14 Oktober 2026). Snapshot berisi judul,
slug, tanggal, dan relasi kategori untuk 5.831 pelatihan. Seed hanya memasang paling banyak
10 pelatihan per kategori (kategori yang di snapshot lebih kecil memakai semua yang ada, jadi 614
pelatihan di 392 kategori). Pemilihannya deterministik (`selectPostsPerCategory` di
`reference-training.ts`) dan setiap pelatihan hanya ditautkan ke kategori yang memilihnya. Mengubah
batas atau aturan ini: naikkan `REFERENCE_SEED_VERSION` di `seed-reference.ts`, maka `docker compose up`
berikutnya merapikan database lama (pelatihan yang tidak lagi dipilih masuk Sampah dan tautan kategori
lamanya dilepas, hanya untuk baris yang belum disentuh admin). Naskah detail pada aplikasi
ditulis ulang oleh `reference-training.ts`; halaman Finance & Treasury memiliki materi
khusus. Jadwal, harga, foto, logo, dan informasi kontak milik situs referensi tidak
diimpor. Sesuaikan informasi operasional tersebut di admin sebelum dipublikasikan.

Setelah `git pull` pada database yang sudah ada, jalankan migrasi dan seed lagi dari
`BE/`. `git pull` hanya memperbarui berkas; data di PostgreSQL tidak berubah sampai
perintah seed dijalankan. Dengan Docker, `docker compose --env-file .env up -d --build`
dari root proyek menjalankan migrasi dan seed melalui service `migrate`.

```powershell
cd BE
npx prisma migrate deploy
npm run db:seed
```

Seed pertama melengkapi kategori, pelatihan, dan dropdown Pelatihan, serta
menyembunyikan katalog contoh lama yang belum diedit. Seed berikutnya melewati impor
besar agar data yang diubah atau dihapus admin tidak muncul kembali. Untuk impor
manual setelah snapshot diperbarui, gunakan `npm run db:seed:reference -- --hide-demo`.
Untuk memperbarui snapshot metadata dari API publik, jalankan
`npm run db:reference:fetch`, tinjau perubahannya, lalu ulangi impor.

Fitur dan kategori Evaluasi lama sudah dihapus. Pada database yang pernah memakai
versi sebelumnya, jalankan migrasi lalu `npm run db:remove:evaluation` dari `BE/`.
Perintah pembersihan lokal ini melepas kategori dari pelatihan yang terhubung,
menyembunyikan kategori/menu lama, dan merapikan teks halaman contoh tanpa
menghapus pelatihannya. Aman diulang.
