import "server-only"
import { auth } from "@clerk/nextjs/server"

export async function getClerkAuth() {
  const { userId, orgId, sessionClaims } = await auth()
  return { userId, orgId, sessionClaims }
}
