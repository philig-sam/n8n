import { NextRequest, NextResponse } from 'next/server';
import { checkPassword, createSessionValue, SESSION_COOKIE } from '@/lib/auth';

// Relative Location headers only: behind a proxy (Railway/Render) and in
// standalone mode, `request.url` resolves to the bind address (0.0.0.0),
// which would send the browser to a dead address after login.
function redirectTo(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const password = String(form.get('password') ?? '');

  if (!checkPassword(password)) {
    return redirectTo('/login?error=1');
  }

  // The proxy terminates TLS, so the app itself sees plain http; trust the
  // forwarded protocol to decide whether the cookie may carry Secure.
  const isHttps =
    request.headers.get('x-forwarded-proto') === 'https' ||
    request.nextUrl.protocol === 'https:';

  const response = redirectTo('/');
  response.cookies.set(SESSION_COOKIE, await createSessionValue(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}
