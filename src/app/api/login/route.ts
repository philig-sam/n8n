import { NextRequest, NextResponse } from 'next/server';
import { checkPassword, createSessionValue, SESSION_COOKIE } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const password = String(form.get('password') ?? '');

  if (!checkPassword(password)) {
    return NextResponse.redirect(new URL('/login?error=1', request.url), 303);
  }

  const response = NextResponse.redirect(new URL('/', request.url), 303);
  response.cookies.set(SESSION_COOKIE, await createSessionValue(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}
