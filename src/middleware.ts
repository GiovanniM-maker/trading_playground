import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';
import { logger } from './lib/logger';

// NextAuth middleware for protecting admin routes with role-based access
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    
    // Check if user has admin role for /admin, /control, and /admin-control routes
    if ((pathname.startsWith('/admin') || pathname.startsWith('/control') || pathname.startsWith('/admin-control')) && token?.role !== 'admin') {
      // Redirect non-admin users to login
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(url);
    }
    
    // Protect /api/admin/* routes
    if (pathname.startsWith('/api/admin/') && token?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // For API routes, continue with logging
    if (pathname.startsWith('/api/')) {
      const method = req.method;
      const path = pathname;
      const startTime = Date.now();
      
      // Store start time in headers for route handlers to use
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-request-start-time', startTime.toString());
      
      // Log request
      logger.info(
        {
          service: 'api',
          method,
          path,
        },
        'API request'
      );
      
      const response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
      
      return response;
    }
    
    return NextResponse.next();
  },
  {
    pages: { signIn: '/login' },
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        
        // Allow access to /admin, /control, and /admin-control only for admin users
        if (pathname.startsWith('/admin') || pathname.startsWith('/control') || pathname.startsWith('/admin-control')) {
          return token?.role === 'admin';
        }
        
        // Protect /api/admin/* routes
        if (pathname.startsWith('/api/admin/')) {
          return token?.role === 'admin';
        }
        
        // For other protected routes, just check if token exists
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ['/admin/:path*', '/control/:path*', '/admin-control/:path*', '/api/:path*'],
};
