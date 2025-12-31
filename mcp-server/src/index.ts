/**
 * E2E Dashboard MCP Server - HTTP Entry Point
 *
 * This is a hosted MCP server using Hono for HTTP transport.
 * It validates Neon Auth tokens and provides org-scoped access to test data.
 */

import { Hono } from "hono"
import { cors } from "hono/cors"
import { streamSSE } from "hono/streaming"

// Types for auth context (full implementation in Batch 2)
export interface AuthContext {
  userId: number
  email: string
  organizationId: number
  organizationSlug: string
  orgRole: "owner" | "admin" | "viewer"
  userRole: "admin" | "viewer"
}

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

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    version: "2.0.0",
    transport: "http-sse",
    timestamp: new Date().toISOString(),
  })
})

// MCP endpoint with SSE transport (POST for requests)
app.post("/mcp", async (c) => {
  // 1. Validate Authorization header
  const authHeader = c.req.header("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401)
  }

  const token = authHeader.slice(7)

  // TODO: Batch 2 - Implement validateNeonAuthToken(token)
  // For now, just check token exists
  if (!token) {
    return c.json({ error: "Invalid or expired token" }, 401)
  }

  // 2. Parse MCP request
  const body = await c.req.json()

  // TODO: Batch 4 - Create org-scoped MCP server and handle request
  // For now, return a placeholder response
  return c.json({
    jsonrpc: "2.0",
    id: body.id,
    result: {
      message: "MCP server is running. Full implementation coming in Batch 4.",
      receivedMethod: body.method,
    },
  })
})

// SSE endpoint for streaming responses
app.get("/mcp/sse", async (c) => {
  const authHeader = c.req.header("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const token = authHeader.slice(7)

  // TODO: Batch 2 - Implement validateNeonAuthToken(token)
  if (!token) {
    return c.json({ error: "Invalid token" }, 401)
  }

  return streamSSE(c, async (stream) => {
    // Keep connection alive with heartbeat
    const heartbeat = setInterval(async () => {
      await stream.writeSSE({
        event: "heartbeat",
        data: JSON.stringify({ timestamp: new Date().toISOString() }),
      })
    }, 30000)

    // Send initial connection confirmation
    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({
        message: "SSE connection established",
        version: "2.0.0",
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
