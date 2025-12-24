import { NextResponse } from "next/server"
import { getTrendData } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const days = Number(searchParams.get("days")) || 7

    const trends = await getTrendData(days)
    return NextResponse.json(trends)
  } catch (error) {
    console.error("[v0] Error fetching trends:", error)
    return NextResponse.json({ error: "Failed to fetch trends" }, { status: 500 })
  }
}
