# syntax=docker/dockerfile:1
# Image BE (Next.js API, port 4000). Context build: root repo (lihat compose.yaml).
# Tidak ada secret di image: semua env diberikan saat container jalan.

FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Prisma CLI (generate, migrate) butuh OpenSSL. Image runtime tidak, karena query lewat adapter pg.
FROM base AS tools
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Dependency. postinstall menjalankan `prisma generate`, jadi schema ikut disalin.
FROM tools AS deps
COPY BE/package.json BE/package-lock.json BE/prisma.config.ts ./
COPY BE/prisma ./prisma
RUN npm ci

FROM tools AS build
COPY --from=deps /app/node_modules ./node_modules
COPY BE/ ./
RUN npx prisma generate && npx next build

# Sekali jalan: terapkan migrasi lalu seed (idempotent). Dipakai service `migrate`.
FROM build AS migrate
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed"]

FROM base AS runner
ENV NODE_ENV=production \
    PORT=4000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 4000
CMD ["node", "server.js"]
