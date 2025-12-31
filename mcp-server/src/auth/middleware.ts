/**
 * Hono Auth Middleware for MCP Server
 *
 * Validates Neon Auth tokens and injects auth context into requests.
 */

import { Context, Next } from "hono"
import { validateNeonAuthToken, type AuthContext } from "./neon-auth.js"

// Extend Hono context type to include authContext
declare module "hono" {
  interface ContextVariableMap {
    authContext: AuthContext
  }
}

/**
 * Middleware to validate auth and inject context.
 * Returns 401 if not authenticated.
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      {
        error: "Authorization required",
        message: "Include 'Authorization: Bearer <token>' header",
      },
      401
    )
  }

  const token = authHeader.slice(7)
  const authContext = await validateNeonAuthToken(token)

  if (!authContext) {
    return c.json(
      {
        error: "Invalid or expired token",
        message: "Please re-authenticate via the dashboard",
      },
      401
    )
  }

  // Inject auth context for handlers
  c.set("authContext", authContext)

  await next()
}
