# Vendor Licensing Intelligence Service - single persistent Node process.
# The in-app node-cron scheduler starts with the server (instrumentation.ts),
# so this container must run continuously (no serverless).

FROM node:20-bookworm-slim AS deps
WORKDIR /app
# openssl must be present wherever Prisma generates: it detects the engine
# target from the installed OpenSSL and silently falls back to the wrong one
# when the binary is missing.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npx next build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Chromium for the onboarding PDF export (puppeteer-core, no bundled browser)
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation openssl \
  && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Standalone server + static assets
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
# Prisma CLI for migrate-on-boot, plus the generated client and its query
# engine copied explicitly rather than relying on Next.js file tracing.
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# SQLite lives on a persistent volume mounted at /data by the host platform
# (Railway volume / Render disk / `docker run -v`). No VOLUME instruction:
# Railway rejects Dockerfiles that declare one.
ENV DATABASE_URL="file:/data/app.db"
RUN mkdir -p /data

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

# Apply migrations and the idempotent seed, then start the persistent server
# (which boots the in-process scheduler)
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && { node prisma/seed.js || echo '[boot] seed skipped (non-fatal)'; } && node server.js"]
