# Vendor Licensing Intelligence Service - single persistent Node process.
# The in-app node-cron scheduler starts with the server (instrumentation.ts),
# so this container must run continuously (no serverless).

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-bookworm-slim AS build
WORKDIR /app
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
# Prisma CLI for running migrations on boot
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# SQLite lives on a volume
ENV DATABASE_URL="file:/data/app.db"
VOLUME /data

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

# Apply migrations and the idempotent seed, then start the persistent server
# (which boots the in-process scheduler)
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node prisma/seed.js && node server.js"]
