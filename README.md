# Vendor Licensing Intelligence Service

Internal tool for a Software Asset Management consultancy. It tracks licensing changes and material corporate changes (M&A, leadership, strategy, pricing, product end-of-life) for software vendors and delivers curated intelligence to subscribers.

**Human-in-the-loop by design:** Claude drafts event summaries from fetched sources, a human approves them in the admin UI, and only approved events are ever sent.

## How it works

```
RSS feeds / pages ──▶ pollSources ──▶ RawItem (deduped by contentHash)
                                          │
                                    processItems ──▶ Claude classify-and-summarize
                                          │            (Zod-validated strict JSON)
                                          ▼
                                   Event (status: pending)
                                          │
                              ┌───── HUMAN APPROVAL GATE ─────┐
                              │   admin UI /review queue      │
                              └──────────────┬────────────────┘
                                     Event (approved)
                                    ┌─────────┴──────────┐
                              sendAlerts            sendQuarterlyDigests
                          (hourly, high-severity)   (quarterly, per subscriber)
```

Everything runs inside this one app as a persistent Node process: scheduling (node-cron started from `instrumentation.ts`), polling, LLM processing, assembly, and sending. No external workflow tools.

## Stack

- TypeScript, Node 20+, Next.js App Router (standalone output)
- Prisma + SQLite (single file; moving to Postgres is a `datasource` provider/connection-string change - the schema avoids SQLite-only and Postgres-only features, enums are enforced app-side with Zod)
- `@anthropic-ai/sdk` for classification/summarization, model from `ANTHROPIC_MODEL`
- `rss-parser`, native fetch, `@mozilla/readability` + `jsdom` for extraction
- `nodemailer` (SMTP) behind a `Mailer` interface (`src/services/mailer.ts`) so Resend/SES can be swapped in later; `DryRunMailer` when `DRY_RUN=true`
- `puppeteer-core` + system Chromium for the onboarding PDF export

## Setup

```bash
cp .env.example .env       # then fill in values (see below)
npm install
npx prisma migrate dev     # creates the SQLite DB and runs the seed
npm run dev                # http://localhost:3000, log in with ADMIN_PASSWORD
```

The seed creates two example vendors (Broadcom/VMware and PTC) with RSS/page sources and one demo subscriber tracking both.

### Environment variables

| Variable | Meaning | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Anthropic API key | required for processItems / profile regeneration |
| `ANTHROPIC_MODEL` | Claude model name | `claude-sonnet-4-5` |
| `DATABASE_URL` | Prisma connection string | `file:./dev.db` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | SMTP settings for the consultancy mail server | required unless `DRY_RUN=true` |
| `APP_BASE_URL` | Base URL of the app | `http://localhost:3000` |
| `ADMIN_PASSWORD` | Shared admin login password | required |
| `SESSION_SECRET` | HMAC key for the session cookie | falls back to `ADMIN_PASSWORD` |
| `DRY_RUN` | Log emails instead of sending | `true` |
| `SKIP_EMPTY_DIGESTS` | Skip subscribers with no new events in the digest run | `true` |
| `CRON_POLL_SOURCES` | pollSources schedule | `0 */6 * * *` (every 6h) |
| `CRON_PROCESS_ITEMS` | processItems schedule | `15 */6 * * *` (staggered 15min after poll) |
| `CRON_SEND_ALERTS` | sendAlerts schedule | `0 * * * *` (hourly) |
| `CRON_SEND_DIGESTS` | digest schedule | `0 7 1 1,4,7,10 *` (07:00 on Jan/Apr/Jul/Oct 1st) |

Cron expressions are standard 5-field crontab, evaluated in the server's local time. **Nothing is sent while `DRY_RUN=true`** - the DryRunMailer logs what would have gone out.

## The jobs

All four jobs are scheduled by node-cron from `src/instrumentation.ts` → `src/jobs/scheduler.ts`, and each can be run on demand from the Dashboard or via `POST /api/jobs/<name>` (`pollSources`, `processItems`, `sendAlerts`, `sendDigests`).

1. **pollSources** - fetches every active source (RSS via rss-parser, pages via fetch + Readability), computes a per-vendor `contentHash` (normalized title + URL) and inserts only new `RawItem`s. Fetch failures set `Source.lastError` (shown as unhealthy on the dashboard) and never abort the run.
2. **processItems** - batches unprocessed items, asks Claude for a strict-JSON verdict (material? type, severity, 2-3 sentence grounded summary, occurred date), validates with Zod, retries once on parse failure, and flags the item for manual review instead of dropping it after a second failure. Near-duplicates (same vendor + type, similar title, within 7 days) are clustered into the existing event rather than creating a new one. New events are created as **pending**.
3. **sendAlerts** - approved + high-severity + not-yet-sent events are emailed to the vendor's subscribers, `sentAt` is set, a `SendLog` row is written per recipient.
4. **sendQuarterlyDigests** - per active subscriber: approved events for their vendors since their last digest `SendLog` (period is exclusive-start/inclusive-end so an event can never appear in two digests), rendered grouped by vendor and sent; skipped when empty if `SKIP_EMPTY_DIGESTS=true`.

## The approval flow

- `processItems` only ever creates events with `status: pending`.
- The **Review queue** (`/review`) is the gate: approve, edit (type/severity/summary), or reject inline. Keyboard-driven: `j`/`k` navigate, `a` approve, `r` reject, `e` edit.
- `sendAlerts` and the digest assembly both select `status: 'approved'` only - nothing pending or rejected can ever leave the system.
- Grounding: the classify prompt forbids inventing facts/numbers/dates, requires `material: false` for non-material content, and every event keeps its source URL through to the email.

## Admin UI

- **Dashboard** - pending-event count, unprocessed items, flagged items, source health, cron schedules with last run/result, run-now buttons per job.
- **Review queue** - the approval gate (see above), including items flagged after classification failures.
- **Vendors** - create/edit, edit `profileMarkdown`, regenerate the profile from approved events with Claude, manage sources.
- **Subscribers** - create/edit, assign vendors, view/export/send the onboarding document, preview the next digest.
- **Sends** - full `SendLog` history and per-subscriber digest preview.

## The two artifacts

- **Onboarding document** - `GET /api/subscribers/:id/onboarding` assembles the subscriber's vendor profiles (positioning headline, playbook & timeline, product & licensing changes, sources) into one styled HTML document; `?format=pdf` exports PDF via headless Chromium.
- **Digest email** - grouped by vendor; each event shows title, type badge, severity, the grounded summary, and its source link, with an intro line and the reporting period.

## Running in production (Docker)

The app must run as one persistent process - the scheduler lives in it.

```bash
docker build -t vendor-intel .
docker run -d --name vendor-intel \
  -p 3000:3000 \
  -v vendor-intel-data:/data \
  --env-file .env \
  -e DATABASE_URL="file:/data/app.db" \
  --restart unless-stopped \
  vendor-intel
```

The container applies migrations on boot (`prisma migrate deploy`) and stores the SQLite file on the `/data` volume. On a VPS without Docker: `npm ci && npx prisma migrate deploy && npm run build && npm start` under systemd/pm2, with `PUPPETEER_EXECUTABLE_PATH` pointing at an installed Chromium for PDF export.

### Moving to Postgres later

Change `provider = "sqlite"` to `postgresql` in `prisma/schema.prisma`, set `DATABASE_URL` to the Postgres connection string, run `npx prisma migrate dev` once to regenerate migrations. No model changes needed.

## Development

```bash
npm run dev          # dev server + scheduler
npm test             # vitest unit tests (hashing, clustering, assembly, LLM validation, renderers)
npx prisma studio    # inspect the DB
npm run seed         # re-run the seed (idempotent upserts)
```

Secrets live only in `.env` (gitignored, as is the SQLite file). See `.env.example` for the full list.
