import cron from 'node-cron';
import { JOB_NAMES, jobCronExpression, runJob } from './registry';

// Guard against double-scheduling across dev hot reloads.
const globalState = globalThis as unknown as { __schedulerStarted?: boolean };

export function startScheduler(): void {
  if (globalState.__schedulerStarted) return;
  globalState.__schedulerStarted = true;

  for (const name of JOB_NAMES) {
    const expression = jobCronExpression(name);
    if (!cron.validate(expression)) {
      console.error(`[scheduler] invalid cron expression for ${name}: "${expression}" - job NOT scheduled`);
      continue;
    }
    cron.schedule(expression, () => {
      console.log(`[scheduler] cron fired: ${name}`);
      void runJob(name);
    });
    console.log(`[scheduler] scheduled ${name} @ "${expression}"`);
  }
}
