import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function safeNextPath(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//')
    ? value
    : '/scrims';
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const nextPath = safeNextPath(requestUrl.searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
      }
    }
  }

  const loginUrl = new URL('/login', requestUrl.origin);
  loginUrl.searchParams.set('next', nextPath);
  return NextResponse.redirect(loginUrl);
}
