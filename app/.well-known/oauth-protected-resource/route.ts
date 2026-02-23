/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728)
 *
 * Required by MCP clients to discover authorization servers.
 * URL: /.well-known/oauth-protected-resource
 *
 * Hardcoded URLs (not auto-detected) to avoid proxy issues on Vercel.
 */

import { NextResponse } from "next/server"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://exolar.triqual.dev"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "max-age=3600",
}

export async function GET() {
  const metadata = {
    resource: `${APP_URL}/api/mcp/mcp`,
    authorization_servers: [APP_URL],
    scopes_supported: ["read:tests", "read:metrics"],
  }

  return NextResponse.json(metadata, { headers: corsHeaders })
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  })
}
