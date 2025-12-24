import { NextResponse } from "next/server"
import { getDashboardMetrics } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const metrics = await getDashboardMetrics()
    return NextResponse.json(metrics)
  } catch (error) {
    console.error("[v0] Error fetching metrics:", error)
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 })
  }
}
