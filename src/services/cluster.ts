// Near-duplicate clustering: the same announcement often lands via several
// sources with slightly different headlines. Before creating a new pending
// Event we check whether an existing recent event for the same vendor looks
// like the same story.

export interface ClusterCandidate {
  vendorId: string;
  type: string;
  title: string;
  createdAt: Date;
  occurredAt?: Date | null;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'at', 'by',
  'with', 'its', 'is', 'are', 'as', 'from', 'that', 'this', 'it', 'be',
  'has', 'have', 'will', 'announces', 'announced', 'announcement',
]);

export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

/** Jaccard similarity of significant title tokens, 0..1. */
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  const union = ta.size + tb.size - intersection;
  return intersection / union;
}

const SIMILARITY_THRESHOLD = 0.5;
const TIME_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * True when `candidate` is about the same story as `existing`: same vendor,
 * same event type, similar title, and close in time.
 */
export function isSameEvent(candidate: ClusterCandidate, existing: ClusterCandidate): boolean {
  if (candidate.vendorId !== existing.vendorId) return false;
  if (candidate.type !== existing.type) return false;

  const candidateTime = candidate.occurredAt ?? candidate.createdAt;
  const existingTime = existing.occurredAt ?? existing.createdAt;
  if (Math.abs(candidateTime.getTime() - existingTime.getTime()) > TIME_WINDOW_MS) return false;

  return titleSimilarity(candidate.title, existing.title) >= SIMILARITY_THRESHOLD;
}

/** Find the first existing event that clusters with the candidate, if any. */
export function findClusterMatch<T extends ClusterCandidate>(
  candidate: ClusterCandidate,
  existing: T[],
): T | undefined {
  return existing.find((e) => isSameEvent(candidate, e));
}
