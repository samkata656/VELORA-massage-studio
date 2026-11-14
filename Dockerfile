# syntax=docker/dockerfile:1

# ---- deps: full install (dev deps are needed for the build, Prisma CLI and seed) ----
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: generate the Prisma client and build the standalone Next.js server ----
# Also used by the one-shot `migrate` service in docker-compose (prisma migrate deploy + seed).
FROM node:26-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma.config.ts reads DATABASE_URL; generate/build never connect, so a placeholder is enough.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate \
 && DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build

# ---- runner: minimal image with only the traced standalone output ----
FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S velora && adduser -S velora -G velora
COPY --from=builder --chown=velora:velora /app/.next/standalone ./
COPY --from=builder --chown=velora:velora /app/.next/static ./.next/static
COPY --from=builder --chown=velora:velora /app/public ./public
USER velora
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
