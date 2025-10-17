import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from 'firebase-admin';

const PROTECTED_ROUTES = ['/', '/members', '/donations', '/cerfa'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname === route || (route !== '/' && pathname.startsWith(route)));

  if (pathname === '/logout') {
    const response = NextResponse.redirect(new URL('/login', request.url));
    // Instruct Firebase Auth to sign out on the client
    response.headers.set('X-Firebase-SignOut', 'true');
    return response;
  }
  
  // The actual auth check will be handled client-side by Firebase listeners
  // This middleware is now mainly for logging or other non-auth purposes if needed.
  // We can add logic to check for a cookie set by the client after login if we want server-side protection.

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/members/:path*', '/donations/:path*', '/cerfa/:path*', '/login', '/logout'],
};
