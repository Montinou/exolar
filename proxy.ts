import { neonAuthMiddleware } from "@neondatabase/neon-js/auth/next"

export default neonAuthMiddleware({
  loginUrl: "/auth/sign-in",
})

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - auth routes (sign-in, sign-up, sign-out)
     * - api/auth routes (auth API handlers)
     * - api/test-results (test data ingestion endpoint - uses API key auth)
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.*|apple-icon.*|auth|api/auth|api/test-results).*)",
  ],
}
