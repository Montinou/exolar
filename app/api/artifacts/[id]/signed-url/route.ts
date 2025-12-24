import { NextResponse } from "next/server"
import { sql } from "@neondatabase/serverless"
import { getSignedR2Url, isR2Configured } from "@/lib/r2"

export const dynamic = "force-dynamic"

const neonSql = sql(process.env.DATABASE_URL!)

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
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

    // Fetch artifact from database
    const result = await neonSql("SELECT * FROM test_artifacts WHERE id = $1", [artifactId])

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
