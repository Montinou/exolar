/**
 * MCP Server API Route
 *
 * Handles MCP JSON-RPC requests over HTTP.
 * Uses Neon Auth JWT validation for authentication.
 */

import { NextRequest, NextResponse } from "next/server"
import { validateMCPToken, allTools, handleToolCall } from "@/lib/mcp"

// CORS headers for Claude Code clients
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
}

// OPTIONS - CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

// GET - Health check
export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      version: "2.0.0",
      transport: "http",
      tools: allTools.length,
      timestamp: new Date().toISOString(),
    },
    { headers: corsHeaders }
  )
}

// POST - MCP JSON-RPC requests
export async function POST(request: NextRequest) {
  // Validate auth
  const authContext = await validateMCPToken(request.headers.get("Authorization"))

  if (!authContext) {
    return NextResponse.json(
      {
        error: "Invalid or expired token",
        message: "Please re-authenticate via the dashboard",
      },
      { status: 401, headers: corsHeaders }
    )
  }

  // Parse JSON-RPC request
  let body: {
    jsonrpc: string
    id?: string | number
    method: string
    params?: Record<string, unknown>
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } },
      { status: 400, headers: corsHeaders }
    )
  }

  // Handle MCP methods
  const response = await handleMCPMethod(body, authContext)

  return NextResponse.json(response, { headers: corsHeaders })
}

async function handleMCPMethod(
  request: {
    jsonrpc: string
    id?: string | number
    method: string
    params?: Record<string, unknown>
  },
  authContext: Awaited<ReturnType<typeof validateMCPToken>>
) {
  if (!authContext) {
    return {
      jsonrpc: "2.0",
      id: request.id,
      error: { code: -32000, message: "Unauthorized" },
    }
  }

  switch (request.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "e2e-dashboard", version: "2.0.0" },
        },
      }

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: { tools: allTools },
      }

    case "tools/call": {
      const params = request.params as {
        name: string
        arguments?: Record<string, unknown>
      }

      if (!params?.name) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32602, message: "Missing tool name" },
        }
      }

      const result = await handleToolCall(
        params.name,
        params.arguments || {},
        authContext
      )

      return {
        jsonrpc: "2.0",
        id: request.id,
        result,
      }
    }

    case "ping":
      return { jsonrpc: "2.0", id: request.id, result: {} }

    case "notifications/initialized":
      return { jsonrpc: "2.0", id: request.id, result: {} }

    default:
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32601, message: `Method not found: ${request.method}` },
      }
  }
}
