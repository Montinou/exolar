import "server-only"
import { createAuthServer } from "@neondatabase/auth/next/server"

// Note: createAuthServer() uses NEON_AUTH_BASE_URL from environment variables
// Trusted origins are configured in the Neon Auth dashboard
export const authServer = createAuthServer()
