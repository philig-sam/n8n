import { NextRequest, NextResponse } from 'next/server';
import { isJobName, runJob } from '@/jobs/registry';

// Manual trigger: POST /api/jobs/pollSources | processItems | sendAlerts | sendDigests
export async function POST(_request: NextRequest, { params }: { params: { job: string } }) {
  if (!isJobName(params.job)) {
    return NextResponse.json({ error: `unknown job "${params.job}"` }, { status: 404 });
  }
  const result = await runJob(params.job);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
