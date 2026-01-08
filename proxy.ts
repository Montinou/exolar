import { neonAuthMiddleware } from "@neondatabase/auth/next"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const authMiddleware = neonAuthMiddleware({
  loginUrl: "/auth/sign-in",
})

export default function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") || ""

  // Internal domain → redirect root to sign-in
  if (hostname.includes("e2e-test-dashboard") && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url))
  }

  // For protected routes, use Neon auth middleware
  return authMiddleware(request)
}

export const config = {
  matcher: [
    // Root path for domain-based redirect
    "/",
    // Protected routes
    "/dashboard/:path*",
    "/admin/:path*",
    "/account/:path*",
    "/settings/:path*",
  ],
}
