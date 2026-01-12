/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728)
 *
 * Required by MCP clients to discover authorization servers.
 * URL: /.well-known/oauth-protected-resource
 */

import { protectedResourceHandler, metadataCorsOptionsRequestHandler } from "mcp-handler"

// Get the auth server URL from environment or use the same origin
const getAuthServerUrl = (request: Request) => {
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

export async function GET(request: Request) {
  const authServerUrl = getAuthServerUrl(request)

  const handler = protectedResourceHandler({
    authServerUrls: [authServerUrl],
    // resourceUrl will be auto-detected from request
  })

  return handler(request)
}

export const OPTIONS = metadataCorsOptionsRequestHandler()
