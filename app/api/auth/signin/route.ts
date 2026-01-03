import { NextRequest, NextResponse } from "next/server"

/**
 * Redirect handler for /api/auth/signin
 *
 * This route exists to handle NextAuth.js-style URLs that Neon Auth's
 * internal flows may generate. It redirects to the actual Neon Auth
 * sign-in page at /auth/sign-in while preserving the callback URL.
 */

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const callbackUrl = searchParams.get("callbackUrl")

  // Build redirect URL to Neon Auth sign-in page
  const signInUrl = new URL("/auth/sign-in", request.nextUrl.origin)

  // Preserve callback URL if provided
  if (callbackUrl) {
    signInUrl.searchParams.set("callbackUrl", callbackUrl)
  }

  return NextResponse.redirect(signInUrl)
}

export async function POST(request: NextRequest) {
  // Forward POST requests to GET redirect
  return GET(request)
}
