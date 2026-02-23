/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 *
 * Required by MCP spec for client discovery.
 * URL: /.well-known/oauth-authorization-server
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
    issuer: APP_URL,
    authorization_endpoint: `${APP_URL}/api/mcp/oauth/authorize`,
    token_endpoint: `${APP_URL}/api/mcp/oauth/token`,
    registration_endpoint: `${APP_URL}/api/mcp/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["read:tests", "read:metrics"],
    service_documentation: `${APP_URL}/docs/mcp`,
  }

  return NextResponse.json(metadata, { headers: corsHeaders })
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  })
}
