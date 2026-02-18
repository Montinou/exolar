/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 *
 * Required by MCP spec for client discovery.
 * URL: /.well-known/oauth-authorization-server
 */

import { getPublicOrigin, metadataCorsOptionsRequestHandler } from "mcp-handler"

export async function GET(request: Request) {
  try {
    const origin = getPublicOrigin(request)

    const metadata = {
      // Required fields
      issuer: origin,
      authorization_endpoint: `${origin}/api/mcp/oauth/authorize`,
      token_endpoint: `${origin}/api/mcp/oauth/token`,

      // Optional but recommended
      registration_endpoint: `${origin}/api/mcp/oauth/register`,

      // OAuth 2.1 / PKCE support
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"], // Public clients only

      // Scopes
      scopes_supported: ["read:tests", "read:metrics"],

      // Service documentation
      service_documentation: `${origin}/docs/mcp`,
    }

    return new Response(JSON.stringify(metadata), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    })
  } catch (error) {
    console.error("[oauth-as-metadata] Error generating metadata:", error)

    // Fallback with hardcoded origin
    const fallbackOrigin = "https://exolar.triqual.dev"
    const metadata = {
      issuer: fallbackOrigin,
      authorization_endpoint: `${fallbackOrigin}/api/mcp/oauth/authorize`,
      token_endpoint: `${fallbackOrigin}/api/mcp/oauth/token`,
      registration_endpoint: `${fallbackOrigin}/api/mcp/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["read:tests", "read:metrics"],
    }

    return new Response(JSON.stringify(metadata), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    })
  }
}

export const OPTIONS = metadataCorsOptionsRequestHandler()
