import { neonAuthMiddleware } from "@neondatabase/auth/next"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const authMiddleware = neonAuthMiddleware({
  loginUrl: "/auth/sign-in",
})

export default function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || ""
  const pathname = request.nextUrl.pathname

  // e2e-test-dashboard domain → redirect root to sign-in (internal dashboard URL)
  if (hostname.includes("e2e-test-dashboard") && pathname === "/") {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url))
  }

  // Public domains (exolar.vercel.app, etc) → pass through root "/" to show landing page
  // The landing page itself handles session check and redirects to /dashboard if authenticated
  if (pathname === "/") {
    return NextResponse.next()
  }

  // For protected routes (/dashboard, /admin, /account, /settings), use Neon auth middleware
  return authMiddleware(request)
}

export const config = {
  matcher: [
    // Root path for domain-based redirect logic
    "/",
    // Protected routes that require authentication
    "/dashboard/:path*",
    "/admin/:path*",
    "/account/:path*",
    "/settings/:path*",
  ],
}
