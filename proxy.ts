import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Next.js 16 Proxy Convention
 * Handles network-boundary request interception, session token refresh,
 * and route protection across all CRM pages and API endpoints.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const pathname = request.nextUrl.pathname;

  // 1. Always pass through static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/icon.png') ||
    pathname.startsWith('/icon-cropped.png') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt|woff|woff2)$/)
  ) {
    return response;
  }

  // 2. WhatsApp Webhook must remain accessible to Meta without user session cookie
  // (Security is handled cryptographically via HMAC-SHA256 x-hub-signature-256 verification)
  if (pathname === '/api/webhook/whatsapp') {
    return response;
  }

  // 3. Initialize Supabase SSR client with request cookies for session validation
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // In test environment or unconfigured dev environments without credentials, allow pass-through
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
    return response;
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    // Validates the JWT and refreshes expired tokens
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const hasBearerToken = Boolean(authHeader && authHeader.toLowerCase().startsWith('bearer '));

    const isPublicAuthRoute = 
      pathname === '/login' || 
      pathname.startsWith('/auth/') ||
      pathname.startsWith('/api/auth/');

    // 4. Protect CRM pages & API routes from unauthenticated access
    if (!user && !isPublicAuthRoute && !hasBearerToken) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Unauthorized: Staff authentication required' },
          { status: 401 }
        );
      }
      const redirectUrl = new URL('/login', request.url);
      if (pathname !== '/') {
        redirectUrl.searchParams.set('next', pathname);
      }
      return NextResponse.redirect(redirectUrl);
    }

    // 5. If user is already authenticated and visits /login, redirect to /
    if (user && pathname === '/login') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return response;
  } catch {
    // In case of cookie parsing error or transient failure, pass through to let page handle
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files, images, favicon, and icon
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.png|icon-cropped.png).*)',
  ],
};
