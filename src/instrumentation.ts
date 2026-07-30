// Next.js instrumentation hook: runs once when the server boots, in both
// `next dev` and the standalone production server. This is where the
// in-process scheduler starts - no external workflow tool involved.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('@/jobs/scheduler');
    startScheduler();
  }
}
