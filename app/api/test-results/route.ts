import { NextResponse } from "next/server"
import { validateApiKey } from "@/lib/auth"
import { validateIngestRequest } from "@/lib/validation"
import { getQueriesForOrg, insertArtifacts, generateTestSignature, setServiceAccountContext } from "@/lib/db"
import { uploadToR2, generateArtifactKey, isR2Configured } from "@/lib/r2"
import { validateOrgApiKey, isExolarApiKey } from "@/lib/api-keys"
import type { IngestResponse, ArtifactRequest } from "@/lib/types"

export const dynamic = "force-dynamic"

// Fallback org ID for legacy API key (DASHBOARD_API_KEY env var)
const LEGACY_ORG_ID = 1

/**
 * Get MIME type based on artifact type and filename
 */
function getMimeType(type: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase()

  switch (type) {
    case "screenshot":
      return "image/png"
    case "video":
      return "video/webm"
    case "trace":
      return "application/zip"
    default:
      // Fallback based on extension
      switch (ext) {
        case "png":
          return "image/png"
        case "jpg":
        case "jpeg":
          return "image/jpeg"
        case "webm":
          return "video/webm"
        case "mp4":
          return "video/mp4"
        case "zip":
          return "application/zip"
        default:
          return "application/octet-stream"
      }
  }
}

/**
 * POST /api/test-results
 *
 * Receives test execution data from Playwright custom reporter.
 * Supports two authentication methods:
 *   1. Organization API key (exolar_...) - data goes to the org owning the key
 *   2. Legacy DASHBOARD_API_KEY env var - data goes to LEGACY_ORG_ID
 *
 * Request body:
 * {
 *   execution: ExecutionRequest,
 *   results: TestResultRequest[],
 *   artifacts?: ArtifactRequest[]
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   execution_id?: number,
 *   results_count?: number,
 *   artifacts_count?: number,
 *   error?: string
 * }
 */
export async function POST(request: Request): Promise<NextResponse<IngestResponse>> {
  // 1. Validate API key - try org key first, then legacy
  const authHeader = request.headers.get("authorization")
  let organizationId: number

  // Check if it's an exolar_ prefixed org API key
  if (isExolarApiKey(authHeader)) {
    const validatedKey = await validateOrgApiKey(authHeader)
    if (!validatedKey) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired API key" },
        { status: 401 }
      )
    }
    organizationId = validatedKey.organizationId
    console.log(`[POST /api/test-results] Authenticated with org API key "${validatedKey.name}" for org ${organizationId}`)
  } else if (validateApiKey(authHeader)) {
    // Legacy DASHBOARD_API_KEY authentication
    organizationId = LEGACY_ORG_ID
    console.log(`[POST /api/test-results] Authenticated with legacy API key for org ${organizationId}`)
  } else {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    )
  }

  // 2. Parse request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON in request body" },
      { status: 400 }
    )
  }

  // 3. Validate request schema
  const validation = validateIngestRequest(body)
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: validation.error },
      { status: 400 }
    )
  }

  const { execution, results, artifacts } = validation.data

  try {
    // Set service account context for RLS bypass (this route uses API key auth, not user sessions)
    await setServiceAccountContext()

    // Use org-bound queries with the authenticated organization
    const db = getQueriesForOrg(organizationId)

    // 4. Insert execution record (auto-registers suite if provided)
    const { executionId, suiteId } = await db.insertExecution(execution)

    // 5. Insert test results (auto-registers tests in suite_tests table)
    const signatureToIdMap = await db.insertTestResults(executionId, results, suiteId)

    // 6. Upload artifacts to R2 and insert records (if any)
    let artifactsCount = 0
    if (artifacts && artifacts.length > 0) {
      // Check if R2 is configured
      if (!isR2Configured()) {
        console.warn("[POST /api/test-results] R2 not configured, skipping artifact upload")
      } else {
        // Upload each artifact to R2 and prepare for DB insertion
        const uploadedArtifacts: ArtifactRequest[] = []

        for (const artifact of artifacts) {
          try {
            // Decode base64 data
            const buffer = Buffer.from(artifact.data, "base64")

            // Generate unique R2 key
            const testSignature = generateTestSignature(artifact.test_file, artifact.test_name)
            const r2Key = generateArtifactKey(
              executionId,
              testSignature,
              artifact.type,
              artifact.filename
            )

            // Determine content type
            const contentType = artifact.mime_type || getMimeType(artifact.type, artifact.filename)

            // Upload to R2
            await uploadToR2(r2Key, buffer, contentType)

            // Add to uploaded artifacts (with r2_key instead of data)
            uploadedArtifacts.push({
              test_name: artifact.test_name,
              test_file: artifact.test_file,
              type: artifact.type,
              filename: artifact.filename,
              r2_key: r2Key,
              mime_type: contentType,
              size_bytes: buffer.length,
            })

            console.log(`[POST /api/test-results] Uploaded artifact: ${r2Key}`)
          } catch (uploadError) {
            console.error(`[POST /api/test-results] Failed to upload artifact ${artifact.filename}:`, uploadError)
            // Continue with other artifacts even if one fails
          }
        }

        // Insert successfully uploaded artifacts into DB
        if (uploadedArtifacts.length > 0) {
          artifactsCount = await insertArtifacts(signatureToIdMap, uploadedArtifacts)
        }
      }
    }

    // 7. Return success response
    return NextResponse.json({
      success: true,
      execution_id: executionId,
      results_count: results.length,
      artifacts_count: artifactsCount,
    })
  } catch (error) {
    // Log the full error for debugging
    console.error("[POST /api/test-results] Database error:", error)

    // Return generic error to client
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
