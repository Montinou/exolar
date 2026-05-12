import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const isPublicRoute = createRouteMatcher([
  "/",
  "/auth/sign-in(.*)",
  "/auth/sign-up(.*)",
  "/auth/no-access(.*)",
  "/api/webhooks/clerk(.*)",
  "/api/test-results(.*)",
  "/api/v1/health(.*)",
  "/docs(.*)",
  "/api/mcp/(.*)",
  "/m/(.*)",
])

export default clerkMiddleware(async (auth, request: NextRequest) => {
  const hostname = request.headers.get("host") || ""
  const pathname = request.nextUrl.pathname

  if (hostname.includes("e2e-test-dashboard") && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  if (isPublicRoute(request)) {
    return NextResponse.next()
  }

  await auth.protect()
  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
}
