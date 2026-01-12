/**
 * MCP Server Route - Using Vercel mcp-handler
 *
 * Supports HTTP Streamable transport (new standard).
 * Uses custom JWT validation for authentication.
 *
 * URL: /api/mcp/mcp (for Claude Code config)
 */

import { createMcpHandler, experimental_withMcpAuth } from "mcp-handler"
import { z } from "zod"
import { validateMCPToken } from "@/lib/mcp/auth"
import { allTools, handleToolCall } from "@/lib/mcp/tools"
import type { MCPAuthContext } from "@/lib/mcp/auth"

// Use AsyncLocalStorage for request-scoped auth context (fixes race condition)
import { AsyncLocalStorage } from "node:async_hooks"

const authContextStorage = new AsyncLocalStorage<MCPAuthContext>()

/**
 * Get auth context for current request (thread-safe)
 */
export function getAuthContext(): MCPAuthContext | undefined {
  return authContextStorage.getStore()
}

const baseHandler = createMcpHandler(
  (server) => {
    // Register all consolidated tools
    for (const tool of allTools) {
      server.registerTool(
        tool.name,
        {
          title: tool.name,
          description: tool.description,
          inputSchema: convertToZodSchema(tool.inputSchema),
        },
        async (args) => {
          const authContext = getAuthContext()
          if (!authContext) {
            console.error("[mcp-handler] No auth context available for tool call:", tool.name)
            return {
              content: [{ type: "text", text: JSON.stringify({ error: "Unauthorized - no auth context" }) }],
              isError: true,
            }
          }

          const result = await handleToolCall(tool.name, args as Record<string, unknown>, authContext)
          return result
        }
      )
    }
  },
  {
    // Server options
  },
  {
    basePath: "/api/mcp",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === "development",
  }
)

/**
 * Auth verifier function for MCP handler
 * Returns AuthInfo if valid, undefined otherwise
 */
async function verifyToken(_req: Request, bearerToken?: string) {
  if (!bearerToken) {
    console.log("[mcp-auth] No bearer token provided")
    return undefined
  }

  const authContext = await validateMCPToken(`Bearer ${bearerToken}`)

  if (!authContext) {
    console.error("[mcp-auth] Token validation failed")
    return undefined
  }

  console.log("[mcp-auth] Token valid for user:", authContext.userId, "org:", authContext.organizationSlug)

  // Store context for this request (will be used via AsyncLocalStorage)
  // The AuthInfo is what mcp-handler expects for its auth system
  return {
    token: bearerToken,
    clientId: `user-${authContext.userId}`,
    scopes: ["read:tests", "read:metrics"],
    // Store our full context for later retrieval
    extra: authContext,
  }
}

/**
 * Wrap with MCP auth middleware
 * This validates the Bearer token before processing
 */
const authedHandler = experimental_withMcpAuth(
  baseHandler,
  verifyToken,
  {
    required: true,
    resourceMetadataPath: "/.well-known/oauth-protected-resource",
  }
)

/**
 * Final handler that injects auth context into AsyncLocalStorage
 * This ensures thread-safe context access in tool handlers
 */
async function wrappedHandler(request: Request) {
  // Pre-validate to get the auth context for AsyncLocalStorage
  const authHeader = request.headers.get("Authorization")
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined

  if (!bearerToken) {
    // Let the auth middleware handle the error
    return authedHandler(request)
  }

  const authContext = await validateMCPToken(authHeader)

  if (!authContext) {
    // Let the auth middleware handle the error
    return authedHandler(request)
  }

  // Run handler within AsyncLocalStorage context
  return authContextStorage.run(authContext, () => authedHandler(request))
}

export { wrappedHandler as GET, wrappedHandler as POST, wrappedHandler as DELETE }

/**
 * Convert our tool inputSchema to Zod schema for mcp-handler
 */
function convertToZodSchema(inputSchema: {
  type: string
  properties?: Record<string, unknown>
  required?: string[]
}): Record<string, z.ZodType> {
  const zodSchema: Record<string, z.ZodType> = {}

  if (!inputSchema.properties) {
    return zodSchema
  }

  const required = inputSchema.required || []

  for (const [key, prop] of Object.entries(inputSchema.properties)) {
    const propDef = prop as {
      type?: string
      enum?: string[]
      description?: string
      properties?: Record<string, unknown>
      default?: unknown
    }

    let zodType: z.ZodType

    // Handle enum types
    if (propDef.enum && propDef.enum.length > 0) {
      zodType = z.enum(propDef.enum as [string, ...string[]])
    }
    // Handle nested objects
    else if (propDef.type === "object" && propDef.properties) {
      zodType = z.object(convertToZodSchema({
        type: "object",
        properties: propDef.properties,
      })).passthrough()
    }
    // Handle object without defined properties (any object)
    else if (propDef.type === "object") {
      zodType = z.record(z.unknown())
    }
    // Handle basic types
    else {
      switch (propDef.type) {
        case "string":
          zodType = z.string()
          break
        case "number":
        case "integer":
          zodType = z.number()
          break
        case "boolean":
          zodType = z.boolean()
          break
        case "array":
          zodType = z.array(z.unknown())
          break
        default:
          zodType = z.unknown()
      }
    }

    // Add description if available
    if (propDef.description) {
      zodType = zodType.describe(propDef.description)
    }

    // Make optional if not required
    if (!required.includes(key)) {
      zodType = zodType.optional()
    }

    // Add default if available
    if (propDef.default !== undefined && !required.includes(key)) {
      zodType = (zodType as z.ZodOptional<z.ZodType>).default(propDef.default)
    }

    zodSchema[key] = zodType
  }

  return zodSchema
}
