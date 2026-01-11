/**
 * MCP SSE Transport Route
 *
 * Implements legacy SSE transport for backward compatibility.
 * Uses a simple ReadableStream-based approach that works on Vercel without Redis.
 *
 * URL: /api/mcp/sse
 *
 * Authentication:
 * - Query param: ?token=exolar_xxx (recommended for MCP clients)
 * - Header: Authorization: Bearer exolar_xxx
 *
 * Flow:
 * 1. Client opens GET /api/mcp/sse?token=xxx → SSE stream opens, receives `endpoint` event
 * 2. Client sends POST /api/mcp/sse/message?sessionId=xxx → Response sent via SSE
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { validateMCPToken } from "@/lib/mcp/auth"
import { allTools, handleToolCall } from "@/lib/mcp/tools"
import type { MCPAuthContext } from "@/lib/mcp/auth"

// In-memory session store (works for single Vercel function invocation)
// For production with persistent SSE, you'd need Redis or similar
const sessions = new Map<string, {
  authContext: MCPAuthContext
  controller: ReadableStreamDefaultController<Uint8Array>
  server: McpServer
}>()

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
 * Send SSE event
 */
function sendSSE(controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown) {
  const encoder = new TextEncoder()
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  controller.enqueue(encoder.encode(payload))
}

/**
 * Create configured MCP server instance
 */
function createMcpServer(authContext: MCPAuthContext, sendMessage: (data: unknown) => void): McpServer {
  const server = new McpServer({
    name: "exolar-qa",
    version: "2.0.0",
  })

  // Register all tools
  for (const tool of allTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema as Record<string, unknown>,
      async (args) => {
        const result = await handleToolCall(tool.name, args as Record<string, unknown>, authContext)
        return result
      }
    )
  }

  return server
}

/**
 * GET: Open SSE stream
 * Client connects here to receive server-to-client messages
 */
export async function GET(request: Request) {
  // Authenticate
  const authHeader = extractToken(request)
  const authContext = await validateMCPToken(authHeader)

  if (!authContext) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Generate session ID
  const sessionId = crypto.randomUUID()

  // Get the base URL for the message endpoint
  const url = new URL(request.url)
  const origin = url.origin
  const messageEndpoint = `${origin}/api/mcp/sse/message?sessionId=${sessionId}`

  // Create SSE stream
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Create MCP server
      const server = createMcpServer(authContext, (data) => {
        sendSSE(controller, "message", data)
      })

      // Store session
      sessions.set(sessionId, { authContext, controller, server })

      // Send initial endpoint event (MCP SSE protocol)
      sendSSE(controller, "endpoint", messageEndpoint)

      // Keep-alive ping every 30 seconds
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": ping\n\n"))
        } catch {
          clearInterval(pingInterval)
        }
      }, 30000)

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        clearInterval(pingInterval)
        sessions.delete(sessionId)
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  })
}
