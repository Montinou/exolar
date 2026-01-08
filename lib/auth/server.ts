import "server-only"
import { createAuthServer } from "@neondatabase/auth/next/server"

const baseUrl = process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

export const authServer = createAuthServer({
  baseURL: baseUrl,
  trustedOrigins: [
    baseUrl,
    "https://exolar.vercel.app",
    "https://exolar-qa.vercel.app",
    "https://e2e-test-dashboard.vercel.app",
  ],
})
