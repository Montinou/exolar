/**
 * MCP SSE Message Endpoint
 *
 * Receives JSON-RPC messages from clients and processes them.
 * Part of the SSE transport flow.
 *
 * URL: /api/mcp/sse/message?sessionId=xxx
 */

import { validateMCPToken } from "@/lib/mcp/auth"
import { handleToolCall } from "@/lib/mcp/tools"
import type { MCPAuthContext } from "@/lib/mcp/auth"

/**
 * Extract token from request (query param or header)
 */
function extractToken(request: Request): string | null {
  const url = new URL(request.url)
  const queryToken = url.searchParams.get("token")
  if (queryToken) {
    return `Bearer ${queryToken}`
  }
  return request.headers.get("Authorization")
}

/**
 * POST: Handle JSON-RPC message
 */
export async function POST(request: Request) {
  // Authenticate
  const authHeader = extractToken(request)
  const authContext = await validateMCPToken(authHeader)

  if (!authContext) {
    return new Response(JSON.stringify({ 
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized" },
      id: null 
    }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Parse JSON-RPC request
  let body: { jsonrpc: string; method: string; params?: Record<string, unknown>; id?: string | number }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32700, message: "Parse error" },
      id: null
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Handle different MCP methods
  try {
    let result: unknown

    switch (body.method) {
      case "initialize":
        result = {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "exolar-qa", version: "2.0.0" }
        }
        break

      case "tools/list":
        // Import allTools dynamically to get the tool list
        const { allTools } = await import("@/lib/mcp/tools")
        result = {
          tools: allTools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }))
        }
        break

      case "tools/call":
        const { name, arguments: args } = body.params as { name: string; arguments: Record<string, unknown> }
        result = await handleToolCall(name, args || {}, authContext)
        break

      case "ping":
        result = {}
        break

      default:
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32601, message: `Method not found: ${body.method}` },
          id: body.id
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
    }

    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      result,
      id: body.id
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })

  } catch (error) {
    console.error("[mcp-sse] Error handling request:", error)
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      error: { 
        code: -32603, 
        message: error instanceof Error ? error.message : "Internal error" 
      },
      id: body.id
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
}
