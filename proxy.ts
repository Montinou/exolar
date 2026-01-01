import { neonAuthMiddleware } from "@neondatabase/auth/next"

export default neonAuthMiddleware({
  loginUrl: "/auth/sign-in",
})

export const config = {
  matcher: [
    // Only protect these specific routes
    "/dashboard/:path*",
    "/admin/:path*",
    "/account/:path*",
    "/settings/:path*",
  ],
}
