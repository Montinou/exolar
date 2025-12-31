/**
 * E2E Dashboard MCP Server - HTTP Entry Point
 *
 * This is a hosted MCP server using Hono for HTTP transport.
 * It validates Neon Auth tokens and provides org-scoped access to test data.
 *
 * The server implements the MCP protocol over HTTP:
 * - POST /mcp - JSON-RPC requests (tools/list, tools/call, etc.)
 * - GET /mcp/sse - Server-Sent Events for streaming (future)
 */

import { Hono } from "hono"
import { cors } from "hono/cors"
import { streamSSE } from "hono/streaming"
import { validateNeonAuthToken, type AuthContext } from "./auth/neon-auth.js"
import { authMiddleware } from "./auth/middleware.js"
import { handleMCPRequest } from "./server.js"
import { allTools } from "./tools/index.js"

// Re-export AuthContext type for external use
export type { AuthContext }

const app = new Hono()

// Enable CORS for Claude Code clients
app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  })
)

// Health check endpoint (no auth required)
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    version: "2.0.0",
    transport: "http-sse",
    tools: allTools.length,
    timestamp: new Date().toISOString(),
  })
})

// Apply auth middleware to MCP routes
app.use("/mcp/*", authMiddleware)
app.use("/mcp", authMiddleware)

// MCP endpoint - handles JSON-RPC requests
app.post("/mcp", async (c) => {
  const authContext = c.get("authContext")

  // Parse MCP JSON-RPC request
  const body = await c.req.json()

  // Handle the MCP request with org context
  const response = await handleMCPRequest(authContext, body)

  return c.json(response)
})

// SSE endpoint for streaming responses
app.get("/mcp/sse", async (c) => {
  const authContext = c.get("authContext")

  return streamSSE(c, async (stream) => {
    // Keep connection alive with heartbeat
    const heartbeat = setInterval(async () => {
      await stream.writeSSE({
        event: "heartbeat",
        data: JSON.stringify({ timestamp: new Date().toISOString() }),
      })
    }, 30000)

    // Send initial connection confirmation with capabilities
    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({
        jsonrpc: "2.0",
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "e2e-dashboard",
            version: "2.0.0",
          },
          organization: authContext.organizationSlug,
          user: authContext.email,
        },
      }),
    })

    // Keep connection open
    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        clearInterval(heartbeat)
        resolve()
      })
    })
  })
})

// For local development
import { serve } from "@hono/node-server"

const port = Number(process.env.PORT) || 3001

serve({
  fetch: app.fetch,
  port,
})

console.log(`🚀 MCP Server running on http://localhost:${port}`)
console.log(`   Health check: http://localhost:${port}/health`)
console.log(`   Tools available: ${allTools.length}`)

export default app
