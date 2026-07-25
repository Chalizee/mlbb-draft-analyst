import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  isSupabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from './config';

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const isLoginRoute = request.nextUrl.pathname === '/login';
  const isAuthCallbackRoute =
    request.nextUrl.pathname === '/auth/callback';
  const isPublicAuthRoute = isLoginRoute || isAuthCallbackRoute;

  if (!signedIn && !isPublicAuthRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set(
      'next',
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  if (signedIn && isLoginRoute) {
    const nextPath = request.nextUrl.searchParams.get('next');
    const destination =
      nextPath?.startsWith('/') && !nextPath.startsWith('//')
        ? nextPath
        : '/scrims';
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return response;
}
