/**
 * MCP Server Route - Using Vercel mcp-handler
 *
 * Supports HTTP Streamable transport (new standard).
 * Uses custom JWT validation for authentication.
 *
 * URL: /api/mcp/mcp (for Claude Code config)
 *
 * Architecture: Matches Quoth's proven pattern —
 * creates a fresh MCP handler per-request with auth context injected,
 * using withMcpAuth directly (no wrapper layer).
 */

import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { z } from "zod"
import { validateMCPToken } from "@/lib/mcp/auth"
import { allTools, handleToolCall } from "@/lib/mcp/tools"
import type { MCPAuthContext } from "@/lib/mcp/auth"
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://exolar.ai-innovation.site"

/**
 * Token verification: validates Bearer token and returns AuthInfo
 */
async function verifyToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken) {
    return undefined
  }

  const authContext = await validateMCPToken(`Bearer ${bearerToken}`)

  if (!authContext) {
    return undefined
  }

  return {
    token: bearerToken,
    clientId: `user-${authContext.userId}`,
    scopes: ["read:tests", "read:metrics"],
    extra: authContext,
  }
}

/**
 * Extract MCPAuthContext from the authenticated request
 */
function getAuthContextFromRequest(req: Request): MCPAuthContext {
  const authInfo = (req as Request & { auth?: AuthInfo }).auth
  if (!authInfo?.extra) {
    // Default fallback (shouldn't happen with required auth)
    return {
      userId: 0,
      email: "anonymous@exolar.local",
      organizationId: 0,
      organizationSlug: "unknown",
      orgRole: "viewer",
      userRole: "viewer",
    }
  }

  return authInfo.extra as MCPAuthContext
}

/**
 * Register all tools on the MCP server with the given auth context
 */
function setupServer(server: Parameters<Parameters<typeof createMcpHandler>[0]>[0], authContext: MCPAuthContext) {
  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      {
        title: tool.name,
        description: tool.description,
        inputSchema: convertToZodSchema(tool.inputSchema),
      },
      async (args) => {
        return handleToolCall(tool.name, args as Record<string, unknown>, authContext)
      }
    )
  }
}

/**
 * Create MCP handler for a specific auth context
 */
function createHandlerWithContext(authContext: MCPAuthContext) {
  return createMcpHandler(
    (server) => setupServer(server, authContext),
    {},
    {
      basePath: "/api/mcp",
      maxDuration: 60,
      verboseLogs: process.env.NODE_ENV === "development",
    }
  )
}

/**
 * OAuth-wrapped handler that extracts auth context and creates MCP handler
 */
const oauthHandler = withMcpAuth(
  async (req: Request) => {
    const authContext = getAuthContextFromRequest(req)
    const handler = createHandlerWithContext(authContext)
    return handler(req)
  },
  verifyToken,
  {
    required: true,
    resourceMetadataPath: "/.well-known/oauth-protected-resource",
    resourceUrl: APP_URL,
  }
)

export { oauthHandler as GET, oauthHandler as POST, oauthHandler as DELETE }

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
