/**
 * OAuth-style authentication flow for MCP server
 *
 * Opens browser for user to authenticate, then receives token via local callback
 */

import * as http from "http"
import * as url from "url"
import { exec } from "child_process"
import { saveConfig, type MCPConfig } from "./config.js"

const DEFAULT_DASHBOARD_URL = process.env.EXOLAR_DASHBOARD_URL || "https://exolar-qa.vercel.app"

interface AuthResult {
  success: boolean
  config?: MCPConfig
  error?: string
}

export async function authenticate(dashboardUrl?: string): Promise<AuthResult> {
  const baseUrl = dashboardUrl || DEFAULT_DASHBOARD_URL

  return new Promise((resolve) => {
    // Create a local server to receive the callback
    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url || "", true)

      if (parsedUrl.pathname === "/callback") {
        const { token, dashboardUrl: returnedUrl, organizationId, organizationSlug, expiresAt } = parsedUrl.query

        if (token && organizationId) {
          const config: MCPConfig = {
            token: token as string,
            dashboardUrl: (returnedUrl as string) || baseUrl,
            organizationId: parseInt(organizationId as string, 10),
            organizationSlug: organizationSlug as string,
            expiresAt: expiresAt as string,
          }

          try {
            saveConfig(config)

            res.writeHead(200, { "Content-Type": "text/html" })
            res.end(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>Authentication Successful</title>
                <style>
                  body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: #fafafa; }
                  .container { text-align: center; padding: 2rem; }
                  .success { color: #22c55e; font-size: 3rem; margin-bottom: 1rem; }
                  h1 { margin: 0 0 0.5rem; }
                  p { color: #a1a1aa; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="success">✓</div>
                  <h1>Authentication Successful!</h1>
                  <p>You can close this window and return to your terminal.</p>
                </div>
              </body>
              </html>
            `)

            server.close()
            resolve({ success: true, config })
          } catch (error) {
            res.writeHead(500, { "Content-Type": "text/html" })
            res.end(`
              <!DOCTYPE html>
              <html>
              <head><title>Error</title></head>
              <body>
                <h1>Failed to save configuration</h1>
                <p>${error instanceof Error ? error.message : "Unknown error"}</p>
              </body>
              </html>
            `)
            server.close()
            resolve({ success: false, error: "Failed to save configuration" })
          }
        } else {
          res.writeHead(400, { "Content-Type": "text/html" })
          res.end(`
            <!DOCTYPE html>
            <html>
            <head><title>Error</title></head>
            <body>
              <h1>Authentication Failed</h1>
              <p>Missing required parameters</p>
            </body>
            </html>
          `)
          server.close()
          resolve({ success: false, error: "Missing required parameters from callback" })
        }
      } else {
        res.writeHead(404)
        res.end("Not found")
      }
    })

    // Find an available port
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        server.close()
        resolve({ success: false, error: "Failed to start local server" })
        return
      }

      const port = address.port
      const authUrl = `${baseUrl}/auth/mcp?port=${port}`

      console.error(`\nOpening browser for authentication...`)
      console.error(`If browser doesn't open, visit: ${authUrl}\n`)

      // Open browser
      openBrowser(authUrl)

      // Set timeout for auth (5 minutes)
      setTimeout(() => {
        server.close()
        resolve({ success: false, error: "Authentication timed out" })
      }, 5 * 60 * 1000)
    })

    server.on("error", (error) => {
      resolve({ success: false, error: `Server error: ${error.message}` })
    })
  })
}

function openBrowser(url: string): void {
  const platform = process.platform

  let command: string
  if (platform === "darwin") {
    command = `open "${url}"`
  } else if (platform === "win32") {
    command = `start "" "${url}"`
  } else {
    command = `xdg-open "${url}"`
  }

  exec(command, (error: Error | null) => {
    if (error) {
      console.error("Failed to open browser automatically.")
      console.error(`Please open this URL manually: ${url}`)
    }
  })
}
