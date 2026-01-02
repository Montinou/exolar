#!/usr/bin/env node
/**
 * E2E Test Dashboard MCP Server
 *
 * A stdio-based MCP server that provides access to E2E test execution data.
 *
 * First-time setup:
 *   npx e2e-test-dashboard-mcp --login
 *
 * This will open your browser to authenticate with the dashboard.
 * After authentication, run normally:
 *   npx e2e-test-dashboard-mcp
 *
 * Or via Claude Code:
 *   claude mcp add --transport stdio e2e-dashboard -- npx -y e2e-test-dashboard-mcp
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { getConfig, clearConfig, getConfigPath } from "./config.js"
import { authenticate } from "./auth.js"
import { MCPClient } from "./client.js"

const SERVER_NAME = "e2e-test-dashboard-mcp"
const SERVER_VERSION = "1.0.0"

async function main() {
  const args = process.argv.slice(2)

  // Handle --login flag
  if (args.includes("--login") || args.includes("-l")) {
    const urlIndex = args.findIndex((a) => a === "--url" || a === "-u")
    const dashboardUrl = urlIndex !== -1 ? args[urlIndex + 1] : undefined
    console.error(`\n${SERVER_NAME} v${SERVER_VERSION}`)
    console.error("Starting authentication flow...\n")

    const result = await authenticate(dashboardUrl)

    if (result.success && result.config) {
      console.error(`\n✓ Authentication successful!`)
      console.error(`  Organization: ${result.config.organizationSlug}`)
      console.error(`  Token expires: ${new Date(result.config.expiresAt).toLocaleDateString()}`)
      console.error(`  Config saved to: ${getConfigPath()}`)
      console.error(`\nYou can now use the MCP server with Claude Code:`)
      console.error(`  claude mcp add --transport stdio e2e-dashboard -- npx -y e2e-test-dashboard-mcp\n`)
      process.exit(0)
    } else {
      console.error(`\n✗ Authentication failed: ${result.error}`)
      process.exit(1)
    }
  }

  // Handle --logout flag
  if (args.includes("--logout")) {
    clearConfig()
    console.error("Logged out successfully. Run with --login to re-authenticate.")
    process.exit(0)
  }

  // Handle --status flag
  if (args.includes("--status")) {
    const config = getConfig()
    if (config) {
      console.error(`Authenticated to: ${config.dashboardUrl}`)
      console.error(`Organization: ${config.organizationSlug}`)
      console.error(`Token expires: ${new Date(config.expiresAt).toLocaleDateString()}`)
      console.error(`Config file: ${getConfigPath()}`)
    } else {
      console.error("Not authenticated. Run with --login to authenticate.")
    }
    process.exit(0)
  }

  // Handle --help flag
  if (args.includes("--help") || args.includes("-h")) {
    console.error(`
${SERVER_NAME} v${SERVER_VERSION}

Usage: npx e2e-test-dashboard-mcp [options]

Options:
  --login, -l     Authenticate with the dashboard (opens browser)
  --logout        Clear stored authentication
  --status        Show authentication status
  --url <url>     Dashboard URL (with --login)
  --help, -h      Show this help message

First-time setup:
  npx e2e-test-dashboard-mcp --login

Add to Claude Code:
  claude mcp add --transport stdio e2e-dashboard -- npx -y e2e-test-dashboard-mcp
`)
    process.exit(0)
  }

  // Normal MCP server mode - check for existing config
  const config = getConfig()

  if (!config) {
    console.error(`
${SERVER_NAME} v${SERVER_VERSION}

Not authenticated. Please run:
  npx e2e-test-dashboard-mcp --login

This will open your browser to authenticate with the E2E Test Dashboard.
`)
    process.exit(1)
  }

  // Create HTTP client
  const client = new MCPClient(config)

  // Create the MCP server
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  )

  // Handle tools/list request - proxy to dashboard
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      const tools = await client.listTools()
      return { tools }
    } catch (error) {
      console.error("Failed to list tools:", error)
      // Return empty tools on error
      return { tools: [] }
    }
  })

  // Handle tools/call request - proxy to dashboard
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      const result = await client.callTool(name, args || {})
      return {
        content: result.content,
        isError: result.isError,
      }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: error instanceof Error ? error.message : "Tool execution failed",
          }),
        }],
        isError: true,
      }
    }
  })

  // Create stdio transport and connect
  const transport = new StdioServerTransport()
  await server.connect(transport)

  // Log startup info to stderr (stdout is reserved for MCP protocol)
  console.error(`${SERVER_NAME} v${SERVER_VERSION} started`)
  console.error(`Connected to: ${config.dashboardUrl}`)
  console.error(`Organization: ${config.organizationSlug}`)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
