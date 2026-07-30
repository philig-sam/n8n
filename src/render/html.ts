import { EVENT_TYPE_LABELS, EventType } from '@/lib/domain';

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function typeLabel(type: string): string {
  return EVENT_TYPE_LABELS[type as EventType] ?? type;
}

export function formatDate(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

export function typeBadge(type: string): string {
  return `<span style="display:inline-block;padding:1px 8px;border-radius:10px;background:#e8eef7;color:#1a4480;font-size:12px;font-weight:600;">${escapeHtml(typeLabel(type))}</span>`;
}

export function severityBadge(severity: string): string {
  const isHigh = severity === 'high';
  const bg = isHigh ? '#fdeaea' : '#eef2ee';
  const color = isHigh ? '#b02a2a' : '#3d5c3d';
  return `<span style="display:inline-block;padding:1px 8px;border-radius:10px;background:${bg};color:${color};font-size:12px;font-weight:600;">${isHigh ? 'HIGH' : 'normal'}</span>`;
}

/**
 * Minimal Markdown-to-HTML for vendor profiles (headings, bullets, links,
 * bold/italic, paragraphs). Input is our own LLM-generated profile structure,
 * and all text is HTML-escaped first.
 */
export function markdownToHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  const inline = (s: string): string => {
    let html = escapeHtml(s);
    html = html.replace(
      /\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
      '<a href="$2" style="color:#1a4480;">$1</a>',
    );
    html = html.replace(
      /(?<!["=\w])(https?:\/\/[^\s<]+)/g,
      '<a href="$1" style="color:#1a4480;word-break:break-all;">$1</a>',
    );
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    return html;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level + 1}>${inline(heading[2])}</h${level + 1}>`);
      continue;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline(trimmed.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inline(trimmed)}</p>`);
  }
  closeList();
  return out.join('\n');
}
