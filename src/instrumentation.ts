// Next.js instrumentation hook: runs once when the server boots, in both
// `next dev` and the standalone production server. This is where the
// in-process scheduler starts - no external workflow tool involved.
//
// The NEXT_RUNTIME check must wrap the dynamic import (not early-return):
// that exact shape is what lets Next exclude the Node-only scheduler and its
// jsdom dependency from the edge bundle.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Boot banner: makes a platform 502 diagnosable from the logs alone -
    // it shows the port actually bound and whether required config is present.
    console.log('[boot] ------------------------------------------------------');
    console.log('[boot] Vendor Licensing Intelligence starting');
    console.log(`[boot] listening port : ${process.env.PORT ?? '3000 (default)'}`);
    console.log(`[boot] bind hostname  : ${process.env.HOSTNAME ?? '(unset)'}`);
    console.log(`[boot] database       : ${process.env.DATABASE_URL ?? '(unset!)'}`);
    console.log(
      `[boot] admin password : ${process.env.ADMIN_PASSWORD ? 'set' : 'NOT SET - login will fail'}`,
    );
    console.log(`[boot] dry run        : ${process.env.DRY_RUN ?? 'true (default)'}`);
    console.log(
      `[boot] anthropic key  : ${process.env.ANTHROPIC_API_KEY ? 'set' : 'not set (AI step idle)'}`,
    );
    console.log('[boot] ------------------------------------------------------');

    const { startScheduler } = await import('@/jobs/scheduler');
    startScheduler();

    console.log('[boot] ready - scheduler running, server accepting requests');
  }
}
