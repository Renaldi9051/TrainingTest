#!/bin/sh
# Entrypoint image FE. Halaman publik di-prerender dengan data dari BE, padahal saat `docker build`
# container be belum ada. Image hanya mengompilasi (--experimental-build-mode=compile); pembuatan
# halaman (generate) dijalankan di sini, setelah compose memastikan be sehat (depends_on).
# Gagal = exit non-zero sebelum server menyala, jadi tidak ada halaman kosong yang ikut ter-cache.
# Sementara sampai Fase 6 (image produksi siap pakai tanpa build saat start, lihat BACKLOG).
set -eu

# Cache data dari start sebelumnya (stop/start container) ikut dipakai generate dan membuat halaman
# berisi data basi. Selalu ambil data segar dari BE.
rm -rf .next/cache/fetch-cache

npx next build --experimental-build-mode=generate

# Server standalone mencari aset statis di sebelahnya.
rm -rf .next/standalone/.next/static
cp -R .next/static .next/standalone/.next/static

exec node .next/standalone/server.js
