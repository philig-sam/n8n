import { prisma } from '@/lib/prisma';
import { contentHashFor } from '@/lib/hash';
import { extractFromPage, extractFromRss } from './extract';

export interface PollResult {
  sourcesPolled: number;
  sourcesFailed: number;
  newItems: number;
  duplicates: number;
}

/**
 * Job 1: fetch every active source, insert new RawItems, skip duplicates via
 * the per-vendor contentHash unique constraint. Failures mark the source
 * unhealthy (lastError) but never abort the run.
 */
export async function pollSources(): Promise<PollResult> {
  const sources = await prisma.source.findMany({
    where: { active: true, vendor: { active: true } },
  });

  const result: PollResult = { sourcesPolled: 0, sourcesFailed: 0, newItems: 0, duplicates: 0 };

  for (const source of sources) {
    try {
      const items =
        source.kind === 'rss'
          ? await extractFromRss(source.url)
          : await extractFromPage(source.url, source.label);

      for (const item of items) {
        const contentHash = contentHashFor(item.title, item.url);
        const existing = await prisma.rawItem.findUnique({
          where: { vendorId_contentHash: { vendorId: source.vendorId, contentHash } },
          select: { id: true },
        });
        if (existing) {
          result.duplicates++;
          continue;
        }
        await prisma.rawItem.create({
          data: {
            sourceId: source.id,
            vendorId: source.vendorId,
            url: item.url,
            title: item.title,
            contentText: item.contentText,
            contentHash,
          },
        });
        result.newItems++;
      }

      await prisma.source.update({
        where: { id: source.id },
        data: { lastFetchedAt: new Date(), lastError: null },
      });
      result.sourcesPolled++;
    } catch (err) {
      result.sourcesFailed++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[pollSources] ${source.label} (${source.url}) failed: ${message}`);
      await prisma.source.update({
        where: { id: source.id },
        data: { lastError: message.slice(0, 500), lastFetchedAt: new Date() },
      });
    }
  }

  console.log(
    `[pollSources] polled=${result.sourcesPolled} failed=${result.sourcesFailed} new=${result.newItems} dup=${result.duplicates}`,
  );
  return result;
}
