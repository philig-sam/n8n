import { prisma } from '@/lib/prisma';
import { classifyItem } from './claude';
import { extractArticleText } from './extract';
import { findClusterMatch } from './cluster';

export interface ProcessResult {
  processed: number;
  eventsCreated: number;
  clustered: number;
  notMaterial: number;
  flaggedForReview: number;
}

const BATCH_SIZE = 25;
// RSS summaries are often a sentence or two; fetch the full article when the
// extracted text is thinner than this.
const THIN_CONTENT_CHARS = 400;

/**
 * Job 2: classify unprocessed RawItems with Claude, cluster near-duplicates,
 * create pending Events. Items whose classification fails twice are flagged
 * needsReview instead of being dropped.
 */
export async function processItems(): Promise<ProcessResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(
      '[processItems] ANTHROPIC_API_KEY is not set - skipping classification. Items stay unprocessed until a key is configured.',
    );
    return { processed: 0, eventsCreated: 0, clustered: 0, notMaterial: 0, flaggedForReview: 0 };
  }

  const items = await prisma.rawItem.findMany({
    where: { processed: false },
    include: { vendor: { select: { name: true } } },
    orderBy: { fetchedAt: 'asc' },
    take: BATCH_SIZE,
  });

  const result: ProcessResult = {
    processed: 0,
    eventsCreated: 0,
    clustered: 0,
    notMaterial: 0,
    flaggedForReview: 0,
  };

  for (const item of items) {
    let contentText = item.contentText;
    if (contentText.length < THIN_CONTENT_CHARS) {
      const fullText = await extractArticleText(item.url);
      if (fullText && fullText.length > contentText.length) {
        contentText = fullText;
        await prisma.rawItem.update({ where: { id: item.id }, data: { contentText } });
      }
    }

    try {
      const verdict = await classifyItem({
        vendorName: item.vendor.name,
        title: item.title,
        contentText,
        url: item.url,
      });

      if (!verdict.material || !verdict.type || !verdict.severity || !verdict.summary) {
        result.notMaterial++;
      } else {
        const occurredAt = verdict.occurredAt ? new Date(`${verdict.occurredAt}T00:00:00Z`) : null;

        // Cluster: same vendor + type + similar title within the recent window
        const recentEvents = await prisma.event.findMany({
          where: {
            vendorId: item.vendorId,
            type: verdict.type,
            createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
          },
        });
        const match = findClusterMatch(
          {
            vendorId: item.vendorId,
            type: verdict.type,
            title: item.title,
            createdAt: new Date(),
            occurredAt,
          },
          recentEvents,
        );

        if (match) {
          result.clustered++;
          // Upgrade severity if this take on the story is rated higher
          if (verdict.severity === 'high' && match.severity !== 'high' && match.status === 'pending') {
            await prisma.event.update({ where: { id: match.id }, data: { severity: 'high' } });
          }
        } else {
          await prisma.event.create({
            data: {
              vendorId: item.vendorId,
              type: verdict.type,
              severity: verdict.severity,
              title: item.title,
              summary: verdict.summary,
              sourceUrl: item.url,
              occurredAt,
              status: 'pending',
              rawItemId: item.id,
            },
          });
          result.eventsCreated++;
        }
      }

      await prisma.rawItem.update({ where: { id: item.id }, data: { processed: true } });
      result.processed++;
    } catch (err) {
      // classifyItem already retried once; flag for manual review, keep going.
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[processItems] item ${item.id} (${item.title}) flagged: ${message}`);
      await prisma.rawItem.update({
        where: { id: item.id },
        data: { processed: true, needsReview: true },
      });
      result.flaggedForReview++;
      result.processed++;
    }
  }

  console.log(
    `[processItems] processed=${result.processed} events=${result.eventsCreated} clustered=${result.clustered} notMaterial=${result.notMaterial} review=${result.flaggedForReview}`,
  );
  return result;
}
