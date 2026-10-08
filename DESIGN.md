# DESIGN.md: Aturan Desain

Dokumen ini adalah **aturan wajib** untuk semua UI di FE (halaman publik & admin). Kalau ada konflik antara selera pribadi dan dokumen ini, ikuti dokumen ini. Kalau butuh pengecualian, tanyakan dulu.

## 1. Prinsip

1. **Monokrom total.** Hanya putih, hitam, dan abu. Warna tidak dipakai untuk dekorasi.
2. **Tipografi adalah visual utama.** Hierarki dibangun dari ukuran, ketebalan, dan ruang kosong, bukan dari warna, kotak, atau bayangan.
3. **Sedikit elemen, banyak ruang.** Kalau ragu, hapus. Setiap elemen harus punya alasan.
4. **Interaktif tapi tenang.** Setiap gerakan memberi informasi (hover, fokus, transisi state). Tidak ada animasi yang hanya hiasan atau mengganggu baca.
5. **Berbeda dari referensi.** Jangan meniru layout diotraining.com (header logo kiri + mega dropdown, kartu ikon berwarna, slider). Ambil isi & alurnya saja.

## 2. Warna (design tokens)

Definisikan sebagai CSS variables di `:root` dan petakan ke Tailwind. **Jangan pakai hex langsung di komponen.**

| Token | Nilai | Pemakaian |
|---|---|---|
| `--bg` | `#FFFFFF` | Latar utama |
| `--bg-subtle` | `#F5F5F5` | Latar section selang-seling, input |
| `--bg-muted` | `#EBEBEB` | Hover baris, skeleton |
| `--border` | `#E5E5E5` | Garis pemisah, border kartu |
| `--border-strong` | `#D4D4D4` | Border input, garis aktif |
| `--fg-subtle` | `#A3A3A3` | Placeholder, teks nonaktif |
| `--fg-muted` | `#737373` | Teks sekunder, caption, meta |
| `--fg` | `#171717` | Teks utama |
| `--fg-strong` | `#0A0A0A` | Judul, tombol primer, section gelap |
| `--inverse-bg` | `#0A0A0A` | Section terbalik (CTA, footer) |
| `--inverse-fg` | `#FAFAFA` | Teks di section terbalik |

Aturan:
- Teks body minimal `--fg-muted` di atas `--bg` (kontras ≥ 4.5:1). `--fg-subtle` **tidak boleh** untuk teks yang harus dibaca.
- Section terbalik (hitam) maksimal 2 per halaman: biasanya CTA penutup dan footer.
- **Pengecualian warna hanya di admin**, untuk status yang wajib dibedakan: error `#B91C1C`, sukses `#15803D`, peringatan `#A16207`. Dipakai kecil (teks/ikon/titik status), tidak sebagai latar besar. Halaman publik tetap 100% monokrom.
- Gambar foto di publik ditampilkan **grayscale** (`filter: grayscale(1)`), boleh kembali berwarna saat hover di kartu tertentu (portofolio, testimoni). Logo klien selalu grayscale + opacity 60%, hover jadi 100%.
- Dark mode: **tidak** di MVP.

## 3. Tipografi

- Font: **Geist Sans** (teks) dan **Geist Mono** (angka, label kecil, kode, nomor urut), via `next/font`.
- Skala (desktop / mobile):

| Token | Ukuran | Line height | Weight | Pemakaian |
|---|---|---|---|---|
| `display` | 88 / 48 px | 0.95 | 600 | Headline hero |
| `h1` | 56 / 36 px | 1.05 | 600 | Judul halaman |
| `h2` | 40 / 28 px | 1.1 | 600 | Judul section |
| `h3` | 24 / 20 px | 1.25 | 500 | Judul kartu/sub-section |
| `body-lg` | 18 px | 1.6 | 400 | Lead paragraph |
| `body` | 16 px | 1.6 | 400 | Teks umum |
| `small` | 14 px | 1.5 | 400 | Meta, caption |
| `label` | 12 px mono | 1.4 | 500 | Eyebrow, tag, nomor (UPPERCASE, letter-spacing 0.08em) |

- Letter-spacing judul besar: `-0.03em` sampai `-0.04em`.
- Lebar baca paragraf maks `65ch`.
- Maksimal 2 weight dalam satu komponen.
- Pola **eyebrow**: label mono kecil di atas judul section, contoh `01 / LAYANAN`.

## 4. Layout & Spasi

- Skala spasi kelipatan 4 px (pakai skala Tailwind default).
- Container: maks `1280px`, padding samping 24 px (mobile 16 px).
- Grid 12 kolom di desktop, 4 kolom di mobile.
- Jarak antar section: 128 px desktop, 80 px mobile.
- Pemisah antar konten pakai **garis 1 px `--border`**, bukan kartu berlatar.
- Breakpoint: `sm 640`, `md 768`, `lg 1024`, `xl 1280`.

## 5. Bentuk

- Radius: `0` untuk section & gambar besar, `6px` untuk tombol, input, kartu kecil, `9999px` hanya untuk chip & avatar.
- Border: 1 px. Tidak ada border 2 px kecuali indikator fokus.
- **Tidak ada drop shadow** di halaman publik. Admin boleh `shadow-sm` hanya untuk popover, dropdown, dialog.
- Tidak ada gradient, glassmorphism, atau ilustrasi berwarna.

## 6. Ikon

- **lucide-react**, stroke 1.5, ukuran 16/20/24.
- Ikon selalu monokrom mengikuti `currentColor`.
- Ikon tidak menggantikan label teks di navigasi utama.

## 7. Komponen

### Tombol
| Varian | Gaya | Hover |
|---|---|---|
| Primer | bg `--fg-strong`, teks putih | bg `#262626`, panah ikut bergeser 4 px ke kanan |
| Sekunder | border `--border-strong`, teks `--fg` | bg `--bg-subtle` |
| Ghost / link | teks + garis bawah tipis | garis bawah memanjang dari kiri ke kanan |

Tinggi 40 px (sm 32, lg 48). Tombol CTA utama boleh membawa ikon panah `→`.

### Input
Tinggi 40 px, border `--border-strong`, fokus: border `--fg-strong` + ring 2 px `--fg-strong` dengan offset 2 px. Label di atas input, bukan placeholder sebagai label.

### Kartu pelatihan
Tanpa latar. Struktur: gambar (rasio 4:3, grayscale) → label kategori mono → judul `h3` → meta (durasi, metode) → garis bawah. Hover: gambar zoom 1.03 dan kembali berwarna, judul mendapat garis bawah.

### Baris layanan (beranda)
List bernomor besar (`01`, `02`, ...) dengan judul di kiri dan ringkasan di kanan, dipisah garis. Hover baris: gambar layanan muncul mengikuti kursor (desktop saja), teks bergeser 8 px.

### Chip kategori
Border 1 px, radius penuh, `small`. Aktif: bg hitam teks putih. Perubahan filter memakai animasi layout (posisi chip/kartu berpindah halus).

### Tabel jadwal
Tanpa garis vertikal. Header label mono. Baris hover `--bg-subtle`. Status ditulis teks (`DIBUKA`, `PENUH`, `SELESAI`) dengan label mono, tanpa warna.

### Command palette (search)
Dialog tengah layar, input besar, hasil dikelompokkan (Pelatihan, Kategori, Layanan), navigasi panah + Enter, shortcut `Ctrl/Cmd + K` ditampilkan di header.

### Floating contact
Tombol bulat hitam 56 px pojok kanan bawah, ikon chat. Klik membuka panel (sheet dari bawah di mobile, popover di desktop) berisi daftar marketing: foto grayscale, nama, nomor, tombol "Chat WA".

## 8. Interaksi & Animasi

Library: **Motion** (framer-motion). Semua nilai di bawah adalah default.

| Token | Nilai |
|---|---|
| Durasi cepat | 150 ms (hover, fokus) |
| Durasi normal | 300 ms (buka/tutup, transisi state) |
| Durasi lambat | 600 ms (reveal saat scroll) |
| Easing standar | `cubic-bezier(0.22, 1, 0.36, 1)` |

### 8.1 Prinsip variasi

Karena warnanya monokrom, gerak jadi sumber "hidup"-nya halaman. Supaya tidak monoton:

1. **Setiap jenis elemen punya gerak sendiri.** Jangan pakai fade-naik untuk semuanya. Judul, gambar, garis, daftar, dan angka masing-masing punya pola (lihat 8.2).
2. **Variasikan arah dan ritme.** Dalam satu layar, campur arah (atas, kiri, wipe) dan durasi. Stagger tidak selalu 60 ms: daftar 40 ms, kartu 80 ms, kata judul 50 ms.
3. **Satu momen utama per halaman.** Hero punya gerak paling kuat. Section lain lebih tenang, supaya ada kontras.
4. **Gerak mengikuti user.** Sebagian efek merespons scroll (kecepatan, progres) dan kursor, bukan sekadar diputar sekali.

### 8.2 Kosakata gerak

| Elemen | Gerak masuk | Interaksi |
|---|---|---|
| Headline hero | Mask reveal per kata, naik dari balik garis | Satu kata kunci berganti otomatis tiap 2,2 s (slot vertikal), contoh "Ubah *judul / gambar / jadwal* tanpa kode" |
| Judul section (h2) | Mask reveal per kata, stagger 50 ms | - |
| Eyebrow label | Huruf muncul dengan efek scramble singkat (300 ms) | - |
| Garis pemisah & border tabel | Digambar dari kiri ke kanan (`scaleX` 0 → 1) | - |
| Gambar | Wipe dari bawah (`clip-path`) + zoom 1.15 → 1 | Hover: grayscale → warna, zoom 1.03 |
| Kartu grid | Stagger 80 ms, kolom kanan sedikit lebih lambat | Label "Lihat →" kecil mengikuti kursor (kursor sistem tetap tampil) |
| Daftar & baris tabel | Masuk dari kiri 16 px, stagger 40 ms | Baris bergeser 8 px saat hover |
| Swatch / ikon / chip | Scale 0.92 → 1 + fade | Chip aktif: transisi layout |
| Angka statistik | Counter berjalan 900 ms | - |
| Callout / blok penting | Wipe dari kiri (`clip-path`) | - |
| Tombol CTA besar | - | Magnetic: ikut kursor maks 6 px. Teks "roll" ke atas diganti duplikatnya |
| Link | - | Underline memanjang dari kiri |
| Tab / navigasi aktif | - | Indikator bergeser ke tab baru (shared layout), bukan muncul-hilang |
| Pergantian halaman | Konten hero stagger masuk | - |
| Teks besar berjalan (marquee) | - | Kecepatan & arah ikut kecepatan scroll, kembali pelan saat berhenti |
| Progres baca | Garis 2 px di bawah header, panjang = progres scroll | - |

Implementasi di React: `motion` (`whileInView` + `viewport={{ once: true, margin: "0px 0px -10% 0px" }}`), `layoutId` untuk indikator tab & chip, `useScroll` / `useVelocity` / `useSpring` untuk progres dan marquee. Buat komponen siap pakai di `FE/src/components/motion/` (`RevealText`, `RevealImage`, `RevealList`, `LineDraw`, `Magnetic`, `RollText`, `VelocityMarquee`, `RotatingWord`) dan pakai ulang, jangan tulis animasi ad-hoc per halaman.

### 8.3 Aturan keras

- Wajib hormati `prefers-reduced-motion`: matikan reveal, marquee, counter, rotating word, magnetic, dan efek kursor; tampilkan konten final langsung.
- Hanya animasikan `transform`, `opacity`, dan `clip-path`.
- Reveal hanya untuk elemen di bawah layar awal. Konten di layar pertama harus langsung terbaca.
- Maksimal 1 efek berbasis scroll (velocity/parallax) per section.
- Tidak ada parallax berat, autoplay carousel cepat, atau animasi yang loop terus di area baca.
- Tidak ada efek kursor kustom yang mengganti kursor sistem.
- Interaksi tidak boleh menjadi satu-satunya cara mengakses konten (semua bisa via keyboard & tanpa hover).

## 9. Gambar

- Selalu pakai `next/image` dengan `sizes` yang benar & `alt` dari CMS.
- Rasio konsisten: kartu 4:3, hero 16:9 atau tanpa gambar, avatar 1:1, logo bebas dalam kotak tinggi tetap.
- Placeholder saat loading: blok `--bg-muted`, bukan spinner.

## 10. Admin

- Tetap monokrom, berbasis shadcn/ui tema `neutral`, densitas lebih rapat dari publik.
- Layout: sidebar kiri 240 px (bisa diciutkan), topbar berisi breadcrumb + user menu, konten maks 1200 px.
- Halaman list: judul + tombol "Tambah" di kanan, toolbar (search, filter, bulk action), tabel, paginasi.
- Form: 1 kolom untuk field utama, panel kanan untuk status/publish/SEO/gambar sampul. Tombol "Simpan" sticky di bawah.
- Feedback: toast untuk sukses/gagal, konfirmasi dialog untuk hapus, skeleton saat loading, empty state dengan ajakan tindakan.
- Drag handle (ikon grip) untuk semua daftar yang bisa diurutkan.

## 11. Copy UI

- Bahasa Indonesia, kalimat pendek, kata kerja aktif di tombol ("Simpan", "Lihat pelatihan", "Hubungi kami").
- Sentence case untuk tombol & judul, UPPERCASE hanya untuk label mono.
- Hindari tanda seru dan emoji.

## 12. Checklist sebelum UI dianggap selesai

- [ ] Tidak ada warna di luar token (cek hex manual di kode).
- [ ] Kontras teks lolos AA.
- [ ] Bisa dipakai penuh dengan keyboard, fokus terlihat jelas.
- [ ] `prefers-reduced-motion` diuji.
- [ ] Tampilan benar di 360 px, 768 px, 1280 px.
- [ ] Semua teks & gambar berasal dari CMS (kecuali label UI).
- [ ] Tidak ada shadow/gradient di publik.
