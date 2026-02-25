import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const STAFF_ACTIVE_CACHE_TTL_SECONDS = 60;
const STAFF_ACTIVE_COOKIE = 'staff_active_cache';
const STAFF_ACTIVE_UID_COOKIE = 'staff_active_uid';
const STAFF_ACTIVE_TS_COOKIE = 'staff_active_ts';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session - IMPORTANT: do not remove this getUser() call
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes - redirect to login if not authenticated
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/forgot-password');

  if (user && !isAuthPage) {
    const now = Date.now();
    const cachedUid = request.cookies.get(STAFF_ACTIVE_UID_COOKIE)?.value;
    const cachedActive = request.cookies.get(STAFF_ACTIVE_COOKIE)?.value;
    const cachedTsRaw = request.cookies.get(STAFF_ACTIVE_TS_COOKIE)?.value;
    const cachedTs = cachedTsRaw ? Number(cachedTsRaw) : 0;
    const hasFreshCache =
      cachedUid === user.id &&
      !!cachedActive &&
      Number.isFinite(cachedTs) &&
      now - cachedTs < STAFF_ACTIVE_CACHE_TTL_SECONDS * 1000;

    if (hasFreshCache) {
      if (cachedActive === '0') {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('error', 'account_inactive');
        return NextResponse.redirect(url);
      }
    } else {
      const { data: staff } = await supabase
        .from('staff')
        .select('is_active')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      const isActive = staff?.is_active !== false;

      const cookieOptions = {
        path: '/',
        maxAge: STAFF_ACTIVE_CACHE_TTL_SECONDS,
        httpOnly: true,
        sameSite: 'lax' as const,
      };

      supabaseResponse.cookies.set(STAFF_ACTIVE_UID_COOKIE, user.id, cookieOptions);
      supabaseResponse.cookies.set(STAFF_ACTIVE_COOKIE, isActive ? '1' : '0', cookieOptions);
      supabaseResponse.cookies.set(STAFF_ACTIVE_TS_COOKIE, String(now), cookieOptions);

      if (!isActive) {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('error', 'account_inactive');
        return NextResponse.redirect(url);
      }
    }
  }

  if (!user && !isAuthPage && request.nextUrl.pathname !== '/') {
    // For API routes, return JSON error instead of HTML redirect
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized: Please log in.' } },
        { status: 401 }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
