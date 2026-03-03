import { neonAuthMiddleware } from "@neondatabase/auth/next"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const authMiddleware = neonAuthMiddleware({
  loginUrl: "/auth/sign-in",
})

export default function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || ""
  const pathname = request.nextUrl.pathname

  if (hostname.includes("e2e-test-dashboard") && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  if (pathname === "/") {
    return NextResponse.next()
  }

  return authMiddleware(request)
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/admin/:path*", "/account/:path*", "/settings/:path*"],
}
