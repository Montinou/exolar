/**
 * HTTP Client for E2E Dashboard MCP API
 *
 * Makes authenticated requests to the dashboard's MCP endpoint
 */

import type { MCPConfig } from "./config.js"

interface MCPRequest {
  jsonrpc: "2.0"
  id: number
  method: string
  params?: Record<string, unknown>
}

interface MCPResponse {
  jsonrpc: "2.0"
  id: number
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

export class MCPClient {
  private config: MCPConfig
  private requestId = 0

  constructor(config: MCPConfig) {
    this.config = config
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<{
    content: Array<{ type: "text"; text: string }>
    isError?: boolean
  }> {
    const request: MCPRequest = {
      jsonrpc: "2.0",
      id: ++this.requestId,
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    }

    const response = await this.makeRequest(request)

    if (response.error) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: response.error.message }) }],
        isError: true,
      }
    }

    const result = response.result as { content?: Array<{ type: "text"; text: string }>; isError?: boolean }
    return {
      content: result.content || [{ type: "text", text: JSON.stringify(result) }],
      isError: result.isError,
    }
  }

  async listTools(): Promise<Array<{
    name: string
    description: string
    inputSchema: Record<string, unknown>
  }>> {
    const request: MCPRequest = {
      jsonrpc: "2.0",
      id: ++this.requestId,
      method: "tools/list",
    }

    const response = await this.makeRequest(request)

    if (response.error) {
      throw new Error(response.error.message)
    }

    const result = response.result as { tools?: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> }
    return result.tools || []
  }

  private async makeRequest(request: MCPRequest): Promise<MCPResponse> {
    const url = `${this.config.dashboardUrl}/api/mcp`

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.config.token}`,
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Authentication expired. Please run with --login to re-authenticate.")
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json() as MCPResponse
    } catch (error) {
      if (error instanceof Error && error.message.includes("fetch")) {
        throw new Error(`Failed to connect to dashboard at ${url}. Please check your internet connection.`)
      }
      throw error
    }
  }
}
