// Central, typed access to configuration. Read lazily so tests can set
// process.env before use.

function str(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v !== undefined && v !== '') return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env var ${name}`);
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return v === 'true' || v === '1';
}

export const env = {
  get anthropicApiKey() {
    return str('ANTHROPIC_API_KEY');
  },
  get anthropicModel() {
    return str('ANTHROPIC_MODEL', 'claude-sonnet-4-5');
  },
  get smtp() {
    return {
      host: str('SMTP_HOST', ''),
      port: Number(str('SMTP_PORT', '587')),
      user: str('SMTP_USER', ''),
      pass: str('SMTP_PASS', ''),
      from: str('SMTP_FROM', 'Vendor Intelligence <noreply@localhost>'),
    };
  },
  get appBaseUrl() {
    return str('APP_BASE_URL', 'http://localhost:3000');
  },
  get adminPassword() {
    return str('ADMIN_PASSWORD');
  },
  get sessionSecret() {
    // Fall back to ADMIN_PASSWORD so a single secret works, but allow a
    // dedicated SESSION_SECRET.
    return str('SESSION_SECRET', process.env.ADMIN_PASSWORD ?? '');
  },
  get dryRun() {
    return bool('DRY_RUN', true);
  },
  get skipEmptyDigests() {
    return bool('SKIP_EMPTY_DIGESTS', true);
  },
  get cron() {
    return {
      pollSources: str('CRON_POLL_SOURCES', '0 */6 * * *'),
      processItems: str('CRON_PROCESS_ITEMS', '15 */6 * * *'),
      sendAlerts: str('CRON_SEND_ALERTS', '0 * * * *'),
      sendDigests: str('CRON_SEND_DIGESTS', '0 7 1 1,4,7,10 *'),
    };
  },
};
