import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const context = await getSessionContext()

    if (!context) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        email: context.email,
        role: context.userRole,
      },
      organization: {
        id: context.organizationId,
        name: context.organizationName,
        slug: context.organizationSlug,
        role: context.orgRole,
      },
    })
  } catch (error) {
    console.error("[auth/session] Error:", error)
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}
