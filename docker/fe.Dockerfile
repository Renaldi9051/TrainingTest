# syntax=docker/dockerfile:1
# Image FE (Next.js publik + admin, port 3000). Context build: root repo (lihat compose.yaml).

FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY FE/package.json FE/package-lock.json ./
RUN npm ci

FROM base AS build
# Dipakai saat build: tujuan rewrite /api dan /uploads ikut dibakar ke hasil build,
# dan NEXT_PUBLIC_* di-inline ke kode client. Keduanya bukan secret.
ARG BE_INTERNAL_URL=http://be:4000
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV BE_INTERNAL_URL=$BE_INTERNAL_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY FE/ ./
RUN npx next build

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
