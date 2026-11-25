import { execFileSync } from "node:child_process"
import { test } from "vitest"

test("initializing MCP leaves Next.js route responses valid", () => {
  // The transport can mutate process-wide Web APIs and owns a cleanup timer.
  // Run it in a child process so neither can affect the rest of the suite.
  execFileSync(process.execPath, ["--input-type=commonjs", "-e", `
    const assert = require("node:assert/strict")
    const { NextResponse } = require("next/server")
    const { createMcpHandler } = require("mcp-handler")

    async function verify() {
      const { Request: NativeRequest, Response: NativeResponse } = globalThis
      const handler = createMcpHandler(() => {}, {}, { basePath: "/api/mcp" })

      const response = await handler(new NativeRequest("http://localhost/api/mcp/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-11-25",
            capabilities: {},
            clientInfo: { name: "exolar-runtime-test", version: "1.0.0" },
          },
        }),
      }))
      assert.equal(response.status, 200)
      assert.match(await response.text(), /"protocolVersion"/)

      const routeResponse = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      assert.ok(routeResponse instanceof Response, "Next.js must recognize its route response")
      assert.equal(globalThis.Response, NativeResponse)
      assert.equal(globalThis.Request, NativeRequest)
    }

    verify().then(
      () => process.exit(0),
      (error) => {
        console.error(error)
        process.exit(1)
      },
    )
  `], { stdio: "pipe" })
})
