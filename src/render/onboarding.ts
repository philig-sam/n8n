import { escapeHtml, markdownToHtml } from './html';

export interface OnboardingVendorView {
  name: string;
  profileMarkdown: string;
}

/**
 * Full styled HTML onboarding document: one section per tracked vendor,
 * each rendered from its profileMarkdown (positioning headline, playbook &
 * timeline, product & licensing changes, sources). Used for the browser
 * view, the PDF export, and the onboarding email.
 */
export function renderOnboardingDocument(
  subscriberName: string,
  vendors: OnboardingVendorView[],
  generatedAt: Date = new Date(),
): string {
  const toc = vendors
    .map((v, i) => `<li><a href="#vendor-${i}" style="color:#1a4480;">${escapeHtml(v.name)}</a></li>`)
    .join('\n');

  const sections = vendors
    .map(
      (v, i) => `
  <section id="vendor-${i}" class="vendor">
    ${markdownToHtml(v.profileMarkdown || `# ${v.name}\n\n_No profile available yet._`)}
  </section>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Vendor Intelligence Onboarding - ${escapeHtml(subscriberName)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1c1c1c; max-width: 800px; margin: 0 auto; padding: 40px 32px; line-height: 1.6; }
  .cover { border-bottom: 3px solid #1a4480; padding-bottom: 24px; margin-bottom: 32px; }
  .cover h1 { font-size: 28px; margin: 0 0 8px 0; color: #1a4480; }
  .cover p { color: #555; margin: 4px 0; }
  h2 { font-size: 22px; color: #1a4480; border-bottom: 2px solid #1a4480; padding-bottom: 6px; margin-top: 48px; }
  h3 { font-size: 16px; text-transform: uppercase; letter-spacing: 0.06em; color: #444; margin-top: 28px; }
  ul { padding-left: 22px; }
  li { margin: 6px 0; }
  a { color: #1a4480; }
  .vendor { page-break-before: always; }
  .vendor:first-of-type { page-break-before: auto; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="cover">
    <h1>Vendor Licensing Intelligence</h1>
    <p><strong>Onboarding briefing for ${escapeHtml(subscriberName)}</strong></p>
    <p>Generated ${generatedAt.toISOString().slice(0, 10)} &middot; ${vendors.length} vendor${
      vendors.length === 1 ? '' : 's'
    } tracked</p>
    <p style="margin-top:12px;">This document summarizes the current state of each vendor you track: positioning, recent playbook and timeline, product and licensing changes, and sources. You will receive quarterly digests and immediate alerts for high-severity events going forward.</p>
    <ul>${toc}</ul>
  </div>
  ${sections}
</body>
</html>`;
}
