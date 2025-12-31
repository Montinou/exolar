import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getSql } from "@/lib/db"
import { getSignedR2Url, isR2Configured } from "@/lib/r2"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sql = getSql()

    const { id } = await params
    const artifactId = Number(id)

    if (isNaN(artifactId)) {
      return NextResponse.json({ error: "Invalid artifact ID" }, { status: 400 })
    }

    // Check if R2 is configured
    if (!isR2Configured()) {
      return NextResponse.json(
        {
          error: "R2 not configured",
          message: "Please add R2 credentials to use artifact downloads",
        },
        { status: 503 },
      )
    }

    // Verify artifact belongs to user's organization via JOIN to test_executions
    const result = await sql`
      SELECT ta.*
      FROM test_artifacts ta
      JOIN test_results tr ON ta.test_result_id = tr.id
      JOIN test_executions te ON tr.execution_id = te.id
      WHERE ta.id = ${artifactId}
        AND te.organization_id = ${context.organizationId}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Artifact not found" }, { status: 404 })
    }

    const artifact = result[0]

    // Generate signed URL
    const signedUrl = await getSignedR2Url(artifact.r2_key, 3600) // 1 hour expiry

    return NextResponse.json({
      signed_url: signedUrl,
      expires_in: 3600,
      artifact: {
        id: artifact.id,
        type: artifact.type,
        file_size_bytes: artifact.file_size_bytes,
        mime_type: artifact.mime_type,
      },
    })
  } catch (error) {
    console.error("[v0] Error generating signed URL:", error)
    return NextResponse.json(
      {
        error: "Failed to generate signed URL",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
