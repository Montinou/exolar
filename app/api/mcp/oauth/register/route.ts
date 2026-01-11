/**
 * OAuth Dynamic Client Registration (RFC 7591)
 *
 * Allows MCP clients to register themselves dynamically.
 * URL: /api/mcp/oauth/register
 */

import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Extract client metadata
    const clientName = body.client_name || "MCP Client"
    const redirectUris = body.redirect_uris || []

    // Validate redirect URIs (must be localhost or HTTPS)
    for (const uri of redirectUris) {
      const url = new URL(uri)
      if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
        return NextResponse.json(
          { error: "invalid_redirect_uri", error_description: "Redirect URIs must be HTTPS or localhost" },
          { status: 400 }
        )
      }
    }

    // Generate client ID
    const clientId = `mcp_${crypto.randomUUID().replace(/-/g, "")}`

    // Store in database (or just return if table doesn't exist)
    const sql = getSql()
    try {
      await sql`
        INSERT INTO oauth_clients (client_id, client_name, redirect_uris)
        VALUES (${clientId}, ${clientName}, ${redirectUris})
      `
    } catch {
      // Table might not exist yet, that's okay for now
      console.warn("[oauth/register] Could not store client (table may not exist)")
    }

    // Return registration response
    return NextResponse.json({
      client_id: clientId,
      client_name: clientName,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none", // Public client
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    })
  } catch (error) {
    console.error("[oauth/register] Error:", error)
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: "Failed to register client" },
      { status: 400 }
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  })
}
