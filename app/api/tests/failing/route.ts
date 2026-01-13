import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getFailingTests } from "@/lib/db/patterns"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get("days") || "30", 10)
    const limit = parseInt(searchParams.get("limit") || "10", 10)

    const tests = await getFailingTests(context.organizationId, days, limit)

    return NextResponse.json({
      tests: tests.map((t) => ({
        testSignature: t.testSignature,
        testFile: t.testFile,
        testTitle: t.testTitle,
        totalFailures: t.totalFailures,
        totalRuns: t.totalRuns,
        failureRate: t.failureRate,
        firstFailure: t.firstFailure?.toISOString() || null,
        lastFailure: t.lastFailure?.toISOString() || null,
      })),
    })
  } catch (error) {
    console.error("Failed to fetch failing tests:", error)
    return NextResponse.json(
      { error: "Failed to fetch failing tests" },
      { status: 500 }
    )
  }
}
