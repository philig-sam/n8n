import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const broadcom = await prisma.vendor.upsert({
    where: { slug: 'broadcom-vmware' },
    update: {},
    create: {
      name: 'Broadcom (VMware)',
      slug: 'broadcom-vmware',
      profileMarkdown: [
        '# Broadcom (VMware)',
        '',
        '## Positioning',
        'Broadcom completed its acquisition of VMware in November 2023 and has since moved the portfolio to subscription-only licensing, consolidated thousands of SKUs into a small number of bundles (VMware Cloud Foundation, vSphere Foundation), and restructured the partner program by invitation.',
        '',
        '## Playbook & key moves',
        '- 2023-11: Acquisition of VMware closed (~$61B).',
        '- 2023-12: End of perpetual license sales announced; move to subscription bundles.',
        '- 2024-01: Partner program reset; invitation-only Broadcom Advantage program.',
        '',
        '## Product & licensing changes',
        '- Perpetual licenses and standalone SKUs discontinued; core-based subscription metric (72-core minimum initially, later revised).',
        '',
        '## Sources',
        '- https://news.broadcom.com/',
        '- https://blogs.vmware.com/cloud-foundation/',
      ].join('\n'),
      sources: {
        create: [
          {
            kind: 'rss',
            url: 'https://news.broadcom.com/rss',
            label: 'Broadcom Newsroom (RSS)',
          },
          {
            kind: 'rss',
            url: 'https://blogs.vmware.com/cloud-foundation/feed',
            label: 'VMware Cloud Foundation Blog (RSS)',
          },
          {
            kind: 'page',
            url: 'https://support.broadcom.com/web/ecx/productlifecycle',
            label: 'Broadcom product lifecycle page',
          },
        ],
      },
    },
  });

  const ptc = await prisma.vendor.upsert({
    where: { slug: 'ptc' },
    update: {},
    create: {
      name: 'PTC',
      slug: 'ptc',
      profileMarkdown: [
        '# PTC',
        '',
        '## Positioning',
        'PTC (Creo, Windchill, ThingWorx, Arena, Codebeamer) has completed its multi-year transition to subscription licensing and is positioning around SaaS delivery (Atlas platform, Creo+ and Windchill+) and AI-assisted design.',
        '',
        '## Playbook & key moves',
        '- 2018: Ended perpetual license sales for core CAD/PLM.',
        '- 2023: Acquisition of pure-play SaaS ALM vendor and continued +SaaS repackaging of Creo and Windchill.',
        '',
        '## Product & licensing changes',
        '- Subscription-only; SaaS "+" editions carry different terms than on-prem subscriptions.',
        '',
        '## Sources',
        '- https://www.ptc.com/en/news',
        '- https://investor.ptc.com/',
      ].join('\n'),
      sources: {
        create: [
          {
            kind: 'rss',
            url: 'https://www.ptc.com/en/rss-feeds/news-releases',
            label: 'PTC News Releases (RSS)',
          },
          {
            kind: 'page',
            url: 'https://www.ptc.com/en/support/lifecycle',
            label: 'PTC product lifecycle page',
          },
        ],
      },
    },
  });

  console.log(`Seeded vendors: ${broadcom.name}, ${ptc.name}`);

  const subscriber = await prisma.subscriber.upsert({
    where: { email: 'demo.subscriber@example.com' },
    update: {},
    create: {
      name: 'Demo Subscriber',
      email: 'demo.subscriber@example.com',
      subscriptions: {
        create: [{ vendorId: broadcom.id }, { vendorId: ptc.id }],
      },
    },
  });
  console.log(`Seeded subscriber: ${subscriber.email} (tracks both vendors)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
