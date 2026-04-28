// middleware.js (should be at root level, not proxy.js)
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

// Role constants
const ROLE_SUPERADMIN = 1;
const ROLE_AUTHOR = 2;
const ROLE_USER = 3;

export function proxy(request) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // Login page - redirect if already logged in
  if (pathname === '/login') {
    if (token) {
      try {
        const decoded = verifyToken(token);
        
        if (decoded) {
          let redirectUrl;
          switch(decoded.role_id) {
            case ROLE_SUPERADMIN:
              redirectUrl = '/dashboard/authors';
              break;
            case ROLE_AUTHOR:
              redirectUrl = '/author/books';
              break;
            case ROLE_USER:
              redirectUrl = '/dashboard/user';
              break;
            default:
              redirectUrl = '/';
          }
          
          return NextResponse.redirect(new URL(redirectUrl, request.url));
        }
      } catch (error) {
        // Invalid token - clear it and allow login
        const response = NextResponse.next();
        response.cookies.set('token', '', { maxAge: 0 });
        return response;
      }
    }
    return NextResponse.next();
  }

  // Protected dashboard routes (superadmin only)
  if (pathname.startsWith('/dashboard')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      const decoded = verifyToken(token);
      
      if (!decoded || decoded.role_id !== ROLE_SUPERADMIN) {
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.set('token', '', { maxAge: 0 });
        return response;
      }

      return NextResponse.next();
    } catch (error) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.set('token', '', { maxAge: 0 });
      return response;
    }
  }

  // Protected author routes (author role only)
  if (pathname.startsWith('/author')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      const decoded = verifyToken(token);
      
      if (!decoded || (decoded.role_id !== ROLE_AUTHOR && decoded.role_id !== ROLE_SUPERADMIN)) {
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.set('token', '', { maxAge: 0 });
        return response;
      }

      return NextResponse.next();
    } catch (error) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.set('token', '', { maxAge: 0 });
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*', 
    '/author/:path*', 
    '/login'
  ]
};
