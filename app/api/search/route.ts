import { searchTests } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q") || ""
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)

    if (query.length < 2) {
      return NextResponse.json({
        tests: [],
        message: "Query must be at least 2 characters",
      })
    }

    const tests = await searchTests(query, limit)

    return NextResponse.json({ tests })
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json({ error: "Failed to search tests" }, { status: 500 })
  }
}
