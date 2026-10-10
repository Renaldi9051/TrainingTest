# syntax=docker/dockerfile:1
# Image FE (Next.js publik + admin, port 3000). Context build: root repo (lihat compose.yaml).
#
# Build dua tahap: image hanya mengompilasi kode (tanpa BE). Prerender halaman publik butuh data
# dari BE, jadi dijalankan saat container start oleh docker/fe-entrypoint.sh, setelah be sehat.

FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY FE/package.json FE/package-lock.json ./
RUN npm ci

FROM base AS runner
# Dipakai saat build: tujuan rewrite /api dan /uploads ikut dibakar ke hasil build,
# dan NEXT_PUBLIC_* di-inline ke kode client. Keduanya bukan secret.
ARG BE_INTERNAL_URL=http://be:4000
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV BE_INTERNAL_URL=$BE_INTERNAL_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY FE/ ./
RUN npx next build --experimental-build-mode=compile
COPY docker/fe-entrypoint.sh /usr/local/bin/fe-entrypoint.sh
# sed: buang CRLF kalau repo di-checkout dengan autocrlf (Windows), supaya sh tidak gagal.
# Tahap generate menulis ke .next (dan next-env.d.ts di /app) saat start, sebagai user node.
RUN sed -i 's/\r$//' /usr/local/bin/fe-entrypoint.sh \
  && chmod +x /usr/local/bin/fe-entrypoint.sh \
  && chown node:node /app \
  && chown -R node:node /app/.next
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
USER node
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/fe-entrypoint.sh"]
