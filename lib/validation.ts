import { z } from "zod"

/**
 * Zod validation schemas for POST /api/test-results endpoint
 * These schemas validate incoming data before database insertion
 */

// Log entry schema
export const logEntrySchema = z.object({
  timestamp: z.number(),
  level: z.enum(["info", "warn", "error", "debug"]),
  source: z.string().min(1),
  message: z.string(),
})

// Execution request schema
export const executionSchema = z.object({
  run_id: z.string().min(1, "run_id is required"),
  branch: z.string().min(1, "branch is required"),
  commit_sha: z.string().min(1, "commit_sha is required"),
  commit_message: z.string().optional(),
  triggered_by: z.string().optional(),
  workflow_name: z.string().optional(),
  suite: z.string().optional(),
  status: z.enum(["success", "failure", "running"]),
  total_tests: z.number().int().min(0),
  passed: z.number().int().min(0),
  failed: z.number().int().min(0),
  skipped: z.number().int().min(0),
  duration_ms: z.number().int().min(0).optional(),
  started_at: z.string().datetime({ message: "started_at must be ISO 8601 datetime" }),
  completed_at: z.string().datetime({ message: "completed_at must be ISO 8601 datetime" }).optional(),
})

// Test result request schema
export const testResultSchema = z.object({
  test_name: z.string().min(1, "test_name is required"),
  test_file: z.string().min(1, "test_file is required"),
  status: z.enum(["passed", "failed", "skipped", "timedout"]),
  duration_ms: z.number().int().min(0),
  is_critical: z.boolean().optional().default(false),
  error_message: z.string().optional(),
  stack_trace: z.string().optional(),
  browser: z.string().optional().default("chromium"),
  retry_count: z.number().int().min(0).optional().default(0),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  logs: z.array(logEntrySchema).optional(),
})

// Artifact request schema - accepts base64 data for upload
export const artifactSchema = z.object({
  test_name: z.string().min(1, "test_name is required"),
  test_file: z.string().min(1, "test_file is required"),
  type: z.enum(["screenshot", "trace", "video"]),
  filename: z.string().min(1, "filename is required"),
  // Accept base64 data for upload (r2_key will be generated after upload)
  data: z.string().min(1, "data is required"),
  mime_type: z.string().optional(),
  size_bytes: z.number().int().min(0).optional(),
})

// Complete ingestion request schema
export const ingestRequestSchema = z.object({
  execution: executionSchema,
  results: z.array(testResultSchema).min(1, "At least one test result is required"),
  artifacts: z.array(artifactSchema).optional().default([]),
})

// Type inference from schemas
export type ExecutionRequestValidated = z.infer<typeof executionSchema>
export type TestResultRequestValidated = z.infer<typeof testResultSchema>
export type ArtifactRequestValidated = z.infer<typeof artifactSchema>
export type IngestRequestValidated = z.infer<typeof ingestRequestSchema>

/**
 * Validates the ingestion request and returns parsed data or error
 */
export function validateIngestRequest(data: unknown): {
  success: true
  data: IngestRequestValidated
} | {
  success: false
  error: string
  details?: z.ZodIssue[]
} {
  const result = ingestRequestSchema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  // Format Zod errors into a readable message
  const errorMessages = result.error.issues.map(issue => {
    const path = issue.path.join(".")
    return path ? `${path}: ${issue.message}` : issue.message
  })

  return {
    success: false,
    error: errorMessages.join("; "),
    details: result.error.issues,
  }
}
