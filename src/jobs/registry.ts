import { pollSources } from '@/services/pollSources';
import { processItems } from '@/services/processItems';
import { sendAlerts } from '@/services/sendAlerts';
import { sendQuarterlyDigests } from '@/services/sendDigests';
import { env } from '@/lib/env';

export const JOB_NAMES = ['pollSources', 'processItems', 'sendAlerts', 'sendDigests'] as const;
export type JobName = (typeof JOB_NAMES)[number];

export interface JobInfo {
  name: JobName;
  cronExpression: string;
  lastRunAt: Date | null;
  lastResult: string | null;
  lastError: string | null;
  running: boolean;
}

interface JobState {
  lastRunAt: Date | null;
  lastResult: string | null;
  lastError: string | null;
  running: boolean;
}

// Survives Next.js dev hot-reloads, shared with the cron scheduler.
const globalState = globalThis as unknown as { __jobState?: Map<JobName, JobState> };
const state: Map<JobName, JobState> =
  globalState.__jobState ??
  new Map(JOB_NAMES.map((n) => [n, { lastRunAt: null, lastResult: null, lastError: null, running: false }]));
globalState.__jobState = state;

const runners: Record<JobName, () => Promise<unknown>> = {
  pollSources,
  processItems,
  sendAlerts,
  sendDigests: () => sendQuarterlyDigests(),
};

export function isJobName(name: string): name is JobName {
  return (JOB_NAMES as readonly string[]).includes(name);
}

/** Run a job now (used by both cron and the admin UI). Serialized per job. */
export async function runJob(name: JobName): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const s = state.get(name)!;
  if (s.running) return { ok: false, error: 'already running' };
  s.running = true;
  try {
    const result = await runners[name]();
    s.lastRunAt = new Date();
    s.lastResult = JSON.stringify(result);
    s.lastError = null;
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    s.lastRunAt = new Date();
    s.lastError = message;
    console.error(`[jobs] ${name} failed: ${message}`);
    return { ok: false, error: message };
  } finally {
    s.running = false;
  }
}

export function jobCronExpression(name: JobName): string {
  const cron = env.cron;
  switch (name) {
    case 'pollSources':
      return cron.pollSources;
    case 'processItems':
      return cron.processItems;
    case 'sendAlerts':
      return cron.sendAlerts;
    case 'sendDigests':
      return cron.sendDigests;
  }
}

export function getJobInfos(): JobInfo[] {
  return JOB_NAMES.map((name) => ({
    name,
    cronExpression: jobCronExpression(name),
    ...state.get(name)!,
  }));
}
