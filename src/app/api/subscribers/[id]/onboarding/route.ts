import { NextRequest, NextResponse } from 'next/server';
import { buildOnboardingDocument } from '@/services/onboarding';
import { htmlToPdf } from '@/services/pdf';

// GET /api/subscribers/:id/onboarding          -> styled HTML document
// GET /api/subscribers/:id/onboarding?format=pdf -> PDF export
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const doc = await buildOnboardingDocument(params.id);
  if (!doc) return NextResponse.json({ error: 'subscriber not found' }, { status: 404 });

  if (request.nextUrl.searchParams.get('format') === 'pdf') {
    try {
      const pdf = await htmlToPdf(doc.html);
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': `attachment; filename="onboarding-${params.id}.pdf"`,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `PDF export failed: ${message}` }, { status: 500 });
    }
  }

  return new NextResponse(doc.html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
