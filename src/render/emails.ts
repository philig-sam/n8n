import { DigestData } from '@/services/assembly';
import { escapeHtml, formatDate, severityBadge, typeBadge } from './html';

const BASE_STYLE =
  'font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#222;max-width:640px;margin:0 auto;padding:16px;';

export interface AlertEventView {
  vendorName: string;
  type: string;
  severity: string;
  title: string;
  summary: string;
  sourceUrl: string;
  occurredAt: Date | null;
}

/** Short immediate alert for one high-severity event. */
export function renderAlertEmail(subscriberName: string, event: AlertEventView): string {
  return `<div style="${BASE_STYLE}">
  <p style="margin-top:0;">Hello ${escapeHtml(subscriberName)},</p>
  <p>A high-severity vendor event was just confirmed for <strong>${escapeHtml(event.vendorName)}</strong>:</p>
  <div style="border:1px solid #ddd;border-left:4px solid #b02a2a;border-radius:4px;padding:12px 16px;margin:16px 0;">
    <p style="margin:0 0 6px 0;">${typeBadge(event.type)} ${severityBadge(event.severity)}${
      event.occurredAt ? ` <span style="color:#777;font-size:12px;">${formatDate(event.occurredAt)}</span>` : ''
    }</p>
    <p style="margin:0 0 6px 0;font-size:16px;font-weight:bold;">${escapeHtml(event.title)}</p>
    <p style="margin:0 0 8px 0;">${escapeHtml(event.summary)}</p>
    <p style="margin:0;"><a href="${escapeHtml(event.sourceUrl)}" style="color:#1a4480;">Source</a></p>
  </div>
  <p style="color:#777;font-size:12px;">You receive these alerts because you track ${escapeHtml(
    event.vendorName,
  )}. Vendor Licensing Intelligence.</p>
</div>`;
}

/** Quarterly digest grouped by vendor. */
export function renderDigestEmail(subscriberName: string, digest: DigestData): string {
  const period = `${formatDate(digest.periodStart)} to ${formatDate(digest.periodEnd)}`;

  const vendorSections = digest.groups
    .map((group) => {
      const rows = group.events
        .map(
          (e) => `
      <div style="padding:10px 0;border-bottom:1px solid #eee;">
        <p style="margin:0 0 4px 0;">${typeBadge(e.type)} ${severityBadge(e.severity)}${
          e.occurredAt ? ` <span style="color:#777;font-size:12px;">${formatDate(e.occurredAt)}</span>` : ''
        }</p>
        <p style="margin:0 0 4px 0;font-weight:bold;">${escapeHtml(e.title)}</p>
        <p style="margin:0 0 4px 0;">${escapeHtml(e.summary)}</p>
        <p style="margin:0;"><a href="${escapeHtml(e.sourceUrl)}" style="color:#1a4480;font-size:13px;">Source</a></p>
      </div>`,
        )
        .join('');
      return `
  <h2 style="font-size:17px;border-bottom:2px solid #1a4480;padding-bottom:4px;margin:24px 0 4px 0;">${escapeHtml(
    group.vendorName,
  )}</h2>
  ${rows}`;
    })
    .join('');

  return `<div style="${BASE_STYLE}">
  <h1 style="font-size:20px;margin:0 0 4px 0;">Vendor Licensing Intelligence - Quarterly Digest</h1>
  <p style="color:#777;margin:0 0 16px 0;">Reporting period: ${escapeHtml(period)}</p>
  <p>Hello ${escapeHtml(subscriberName)}, here are the approved vendor events for the vendors you track this quarter.</p>
  ${vendorSections || '<p>No new events this period.</p>'}
  <p style="color:#777;font-size:12px;margin-top:24px;">Vendor Licensing Intelligence. Reply to this email to reach your consultant.</p>
</div>`;
}
