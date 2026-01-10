/**
 * MCP Server Route - Using Vercel mcp-handler
 *
 * Supports HTTP Streamable transport (new standard).
 * Uses Neon Auth JWT validation for authentication.
 *
 * URL: /api/mcp/mcp (for Claude Code config)
 */

import { createMcpHandler } from "mcp-handler"
import { z } from "zod"
import { validateMCPToken } from "@/lib/mcp/auth"
import { allTools, handleToolCall } from "@/lib/mcp/tools"
import type { MCPAuthContext } from "@/lib/mcp/auth"

// Store auth context for tool calls (per-request)
let currentAuthContext: MCPAuthContext | null = null

const handler = createMcpHandler(
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
          if (!currentAuthContext) {
            return {
              content: [{ type: "text", text: JSON.stringify({ error: "Unauthorized" }) }],
              isError: true,
            }
          }

          const result = await handleToolCall(tool.name, args as Record<string, unknown>, currentAuthContext)
          return result
        }
      )
    }
  },
  {
    // Context object - available in tool handlers
  },
  {
    basePath: "/api/mcp",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === "development",
    capabilities: {
      tools: {},
    },
    // Custom auth handler
    authenticate: async (request) => {
      const authHeader = request.headers.get("Authorization")
      const authContext = await validateMCPToken(authHeader)

      if (!authContext) {
        throw new Error("Invalid or expired token. Please re-authenticate via the dashboard.")
      }

      // Store for tool calls
      currentAuthContext = authContext

      return {
        userId: authContext.userId,
        organizationId: authContext.organizationId,
        organizationSlug: authContext.organizationSlug,
      }
    },
  }
)

export { handler as GET, handler as POST, handler as DELETE }

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
