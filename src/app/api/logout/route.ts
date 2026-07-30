import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';

export async function GET() {
  // Relative Location: see the note in api/login/route.ts.
  const response = new NextResponse(null, { status: 303, headers: { Location: '/login' } });
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
