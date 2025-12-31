/**
 * E2E Dashboard MCP Server - HTTP Entry Point
 *
 * This is a hosted MCP server using Hono for HTTP transport.
 * It validates Neon Auth tokens and provides org-scoped access to test data.
 */

import { Hono } from "hono"
import { cors } from "hono/cors"
import { streamSSE } from "hono/streaming"
import { validateNeonAuthToken, type AuthContext } from "./auth/neon-auth.js"
import { authMiddleware } from "./auth/middleware.js"

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
    timestamp: new Date().toISOString(),
  })
})

// Apply auth middleware to MCP routes
app.use("/mcp/*", authMiddleware)
app.use("/mcp", authMiddleware)

// MCP endpoint with SSE transport (POST for requests)
app.post("/mcp", async (c) => {
  const authContext = c.get("authContext")

  // Parse MCP request
  const body = await c.req.json()

  // TODO: Batch 4 - Create org-scoped MCP server and handle request
  // For now, return a placeholder response with auth info
  return c.json({
    jsonrpc: "2.0",
    id: body.id,
    result: {
      message: "MCP server authenticated successfully. Full tool implementation in Batch 4.",
      receivedMethod: body.method,
      organization: authContext.organizationSlug,
      user: authContext.email,
    },
  })
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

    // Send initial connection confirmation with org info
    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({
        message: "SSE connection established",
        version: "2.0.0",
        organization: authContext.organizationSlug,
        user: authContext.email,
      }),
    })

    // TODO: Batch 4 - Handle MCP messages over SSE

    // Keep connection open (will be managed by MCP SDK in Batch 4)
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

export default app
