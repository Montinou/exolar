import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || ""

  // Internal domain → redirect root to sign-in
  if (hostname.includes("e2e-test-dashboard") && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url))
  }

  // All other domains (exolar-qa.vercel.app, localhost, etc.) → normal behavior
  return NextResponse.next()
}

export const config = {
  matcher: "/",
}
