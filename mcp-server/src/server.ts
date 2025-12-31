/**
 * MCP Server Implementation
 *
 * Handles MCP JSON-RPC protocol over HTTP.
 * Does NOT use the MCP SDK Server class directly since we manage HTTP transport ourselves.
 */

import type { AuthContext } from "./auth/neon-auth.js"
import { allTools, handleToolCall } from "./tools/index.js"

/**
 * Process an MCP JSON-RPC request and return the response.
 * This is used for HTTP POST requests to /mcp
 */
export async function handleMCPRequest(
  authContext: AuthContext,
  request: {
    jsonrpc: string
    id?: string | number
    method: string
    params?: Record<string, unknown>
  }
): Promise<{
  jsonrpc: string
  id?: string | number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}> {
  try {
    // Handle MCP methods for HTTP transport
    switch (request.method) {
      case "initialize": {
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: "e2e-dashboard",
              version: "2.0.0",
            },
          },
        }
      }

      case "tools/list": {
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            tools: allTools,
          },
        }
      }

      case "tools/call": {
        const params = request.params as { name: string; arguments?: Record<string, unknown> }
        if (!params?.name) {
          return {
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32602,
              message: "Missing tool name",
            },
          }
        }

        const toolResult = await handleToolCall(
          params.name,
          params.arguments || {},
          authContext
        )

        return {
          jsonrpc: "2.0",
          id: request.id,
          result: toolResult,
        }
      }

      case "ping": {
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {},
        }
      }

      case "notifications/initialized": {
        // Client notification that initialization is complete
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {},
        }
      }

      default: {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`,
          },
        }
      }
    }
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id: request.id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : "Internal error",
      },
    }
  }
}
