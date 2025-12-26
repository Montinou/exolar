# Phase 01: Data Ingestion Endpoint

> **Priority:** Critical | **Complexity:** Medium | **Dependencies:** None
>
> Creates the POST endpoint for receiving test results from Playwright reporter.

---

## Objective

1. Create POST `/api/test-results` endpoint for data ingestion
2. Add database insert functions for executions, results, and artifacts
3. Implement API key authentication
4. Handle artifact uploads to Cloudflare R2

---

## Prerequisites

- Dashboard deployed to Vercel
- Neon PostgreSQL database configured
- (Optional) Cloudflare R2 configured for artifacts

---

## Database Changes

**No new migrations required** - uses existing tables from `scripts/001_create_test_tables.sql`.

Existing tables:
- `test_executions` - Workflow run metadata
- `test_results` - Individual test outcomes
- `test_artifacts` - R2 file references

---

## Backend Implementation

### 1. Add Request Types (`lib/types.ts`)

```typescript
// === REQUEST TYPES FOR DATA INGESTION ===

export interface TestResultsRequest {
  execution: ExecutionRequest;
  results: TestResultRequest[];
  artifacts?: ArtifactRequest[];
}

export interface ExecutionRequest {
  run_id: string;
  branch: string;
  commit_sha: string;
  commit_message?: string;
  triggered_by: string;
  workflow_name: string;
  status: 'success' | 'failure' | 'running';
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  started_at: string;        // ISO 8601
  completed_at?: string;     // ISO 8601
}

export interface TestResultRequest {
  test_name: string;
  test_file: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedout';
  duration_ms: number;
  is_critical?: boolean;
  error_message?: string;
  stack_trace?: string;
  browser: string;
  retry_count: number;
  started_at: string;
  completed_at?: string;
  logs?: LogEntry[];         // Structured logs from TestLogger
}

export interface LogEntry {
  timestamp: number;         // ms since test start
  level: 'debug' | 'info' | 'warn' | 'error' | 'metric';
  source: string;            // e.g., 'page-object:PO_CaseV2'
  message: string;
  data?: Record<string, unknown>;
}

export interface ArtifactRequest {
  test_name: string;
  test_file: string;
  type: 'screenshot' | 'trace' | 'video';
  filename: string;
  mime_type: string;
  data: string;              // Base64 encoded content
}

export interface TestResultsResponse {
  success: boolean;
  execution_id?: number;
  results_count?: number;
  artifacts_count?: number;
  error?: string;
}
```

### 2. Add Database Insert Functions (`lib/db.ts`)

```typescript
import { generateTestSignature } from './db'; // If Phase 04 is implemented
import crypto from 'crypto';

// Generate test signature if not imported from Phase 04
function generateSignature(testFile: string, testName: string): string {
  return crypto.createHash('md5').update(`${testFile}::${testName}`).digest('hex');
}

// Insert a new test execution
export async function insertExecution(
  execution: ExecutionRequest
): Promise<number> {
  const sql = getSql();

  const result = await sql`
    INSERT INTO test_executions (
      run_id,
      branch,
      commit_sha,
      commit_message,
      triggered_by,
      workflow_name,
      status,
      total_tests,
      passed,
      failed,
      skipped,
      duration_ms,
      started_at,
      completed_at
    ) VALUES (
      ${execution.run_id},
      ${execution.branch},
      ${execution.commit_sha},
      ${execution.commit_message || null},
      ${execution.triggered_by},
      ${execution.workflow_name},
      ${execution.status},
      ${execution.total_tests},
      ${execution.passed},
      ${execution.failed},
      ${execution.skipped},
      ${execution.duration_ms},
      ${execution.started_at}::timestamptz,
      ${execution.completed_at ? execution.completed_at + '::timestamptz' : null}
    )
    RETURNING id
  `;

  return result[0].id;
}

// Insert test results for an execution
export async function insertTestResults(
  executionId: number,
  results: TestResultRequest[]
): Promise<number[]> {
  const sql = getSql();
  const insertedIds: number[] = [];

  for (const result of results) {
    const signature = generateSignature(result.test_file, result.test_name);

    const inserted = await sql`
      INSERT INTO test_results (
        execution_id,
        test_signature,
        test_name,
        test_file,
        status,
        duration_ms,
        is_critical,
        error_message,
        stack_trace,
        browser,
        retry_count,
        started_at,
        completed_at
      ) VALUES (
        ${executionId},
        ${signature},
        ${result.test_name},
        ${result.test_file},
        ${result.status},
        ${result.duration_ms},
        ${result.is_critical || false},
        ${result.error_message || null},
        ${result.stack_trace || null},
        ${result.browser},
        ${result.retry_count},
        ${result.started_at}::timestamptz,
        ${result.completed_at ? result.completed_at + '::timestamptz' : null}
      )
      RETURNING id
    `;

    insertedIds.push(inserted[0].id);
  }

  return insertedIds;
}

// Insert artifact reference (after upload to R2)
export async function insertArtifact(
  testResultId: number,
  artifact: {
    type: 'screenshot' | 'trace' | 'video';
    r2_key: string;
    r2_url: string;
    file_size_bytes: number;
    mime_type: string;
  }
): Promise<number> {
  const sql = getSql();

  const result = await sql`
    INSERT INTO test_artifacts (
      test_result_id,
      type,
      r2_key,
      r2_url,
      file_size_bytes,
      mime_type
    ) VALUES (
      ${testResultId},
      ${artifact.type},
      ${artifact.r2_key},
      ${artifact.r2_url},
      ${artifact.file_size_bytes},
      ${artifact.mime_type}
    )
    RETURNING id
  `;

  return result[0].id;
}

// Find test result ID by test name and file within an execution
export async function findTestResultId(
  executionId: number,
  testName: string,
  testFile: string
): Promise<number | null> {
  const sql = getSql();

  const result = await sql`
    SELECT id FROM test_results
    WHERE execution_id = ${executionId}
      AND test_name = ${testName}
      AND test_file = ${testFile}
    LIMIT 1
  `;

  return result[0]?.id || null;
}
```

### 3. Add R2 Upload Function (`lib/r2.ts`)

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Existing getR2Client and getSignedUrl functions...

// Upload artifact to R2
export async function uploadArtifact(
  key: string,
  data: Buffer,
  contentType: string
): Promise<{ r2_key: string; r2_url: string; size: number }> {
  const client = getR2Client();

  if (!client) {
    throw new Error('R2 client not configured');
  }

  const bucketName = process.env.R2_BUCKET_NAME;

  await client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: data,
    ContentType: contentType,
  }));

  return {
    r2_key: key,
    r2_url: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName}/${key}`,
    size: data.length
  };
}

// Generate unique key for artifact
export function generateArtifactKey(
  executionId: number,
  testName: string,
  type: string,
  filename: string
): string {
  const sanitizedTestName = testName.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 50);
  const timestamp = Date.now();
  return `artifacts/${executionId}/${sanitizedTestName}/${type}-${timestamp}-${filename}`;
}
```

### 4. Create API Route (`app/api/test-results/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import {
  insertExecution,
  insertTestResults,
  insertArtifact,
  findTestResultId,
} from '@/lib/db';
import { uploadArtifact, generateArtifactKey } from '@/lib/r2';
import type {
  TestResultsRequest,
  TestResultsResponse,
} from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for large payloads

// Validate API key
function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '');
  const expectedKey = process.env.API_SECRET_KEY;

  if (!expectedKey) {
    console.warn('API_SECRET_KEY not configured - allowing all requests');
    return true;
  }

  return apiKey === expectedKey;
}

export async function POST(request: NextRequest): Promise<NextResponse<TestResultsResponse>> {
  try {
    // Validate API key
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: TestResultsRequest = await request.json();

    // Validate required fields
    if (!body.execution || !body.results) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: execution, results' },
        { status: 400 }
      );
    }

    // Insert execution
    const executionId = await insertExecution(body.execution);
    console.log(`Created execution ${executionId} for run ${body.execution.run_id}`);

    // Insert test results
    const resultIds = await insertTestResults(executionId, body.results);
    console.log(`Inserted ${resultIds.length} test results`);

    // Handle artifacts if present
    let artifactsCount = 0;
    if (body.artifacts && body.artifacts.length > 0) {
      for (const artifact of body.artifacts) {
        try {
          // Find the test result this artifact belongs to
          const testResultId = await findTestResultId(
            executionId,
            artifact.test_name,
            artifact.test_file
          );

          if (!testResultId) {
            console.warn(`Test result not found for artifact: ${artifact.test_name}`);
            continue;
          }

          // Decode base64 data
          const buffer = Buffer.from(artifact.data, 'base64');

          // Generate unique key
          const key = generateArtifactKey(
            executionId,
            artifact.test_name,
            artifact.type,
            artifact.filename
          );

          // Upload to R2
          const uploaded = await uploadArtifact(buffer, key, artifact.mime_type);

          // Insert artifact record
          await insertArtifact(testResultId, {
            type: artifact.type,
            r2_key: uploaded.r2_key,
            r2_url: uploaded.r2_url,
            file_size_bytes: uploaded.size,
            mime_type: artifact.mime_type,
          });

          artifactsCount++;
        } catch (artifactError) {
          console.error(`Failed to process artifact for ${artifact.test_name}:`, artifactError);
          // Continue with other artifacts
        }
      }
      console.log(`Uploaded ${artifactsCount} artifacts`);
    }

    return NextResponse.json({
      success: true,
      execution_id: executionId,
      results_count: resultIds.length,
      artifacts_count: artifactsCount,
    });

  } catch (error) {
    console.error('Error processing test results:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

// Health check / schema info
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: 'POST /api/test-results',
    version: '1.0.0',
    required_headers: {
      'Authorization': 'Bearer <API_KEY>',
      'Content-Type': 'application/json',
    },
    body_schema: {
      execution: 'ExecutionRequest (required)',
      results: 'TestResultRequest[] (required)',
      artifacts: 'ArtifactRequest[] (optional)',
    },
  });
}
```

---

## API Specification

### POST /api/test-results

**Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes | `Bearer <API_KEY>` |
| Content-Type | Yes | `application/json` |

**Request Body:**

```json
{
  "execution": {
    "run_id": "12345678",
    "branch": "main",
    "commit_sha": "abc123def456",
    "commit_message": "Fix login flow",
    "triggered_by": "github_actions",
    "workflow_name": "E2E Tests",
    "status": "failure",
    "total_tests": 50,
    "passed": 48,
    "failed": 2,
    "skipped": 0,
    "duration_ms": 180000,
    "started_at": "2025-12-26T10:00:00Z",
    "completed_at": "2025-12-26T10:03:00Z"
  },
  "results": [
    {
      "test_name": "should login successfully",
      "test_file": "tests/auth/login.spec.ts",
      "status": "passed",
      "duration_ms": 5000,
      "is_critical": true,
      "browser": "chromium",
      "retry_count": 0,
      "started_at": "2025-12-26T10:00:05Z",
      "completed_at": "2025-12-26T10:00:10Z"
    },
    {
      "test_name": "should show error on invalid credentials",
      "test_file": "tests/auth/login.spec.ts",
      "status": "failed",
      "duration_ms": 3000,
      "is_critical": false,
      "error_message": "Timeout waiting for error message",
      "stack_trace": "Error: Timeout...\n  at LoginPage.expectError...",
      "browser": "chromium",
      "retry_count": 1,
      "started_at": "2025-12-26T10:00:11Z",
      "completed_at": "2025-12-26T10:00:14Z",
      "logs": [
        {
          "timestamp": 0,
          "level": "info",
          "source": "page-object:LoginPage",
          "message": "Navigating to login page"
        },
        {
          "timestamp": 1500,
          "level": "info",
          "source": "page-object:LoginPage",
          "message": "Entering credentials",
          "data": { "email": "test@example.com" }
        },
        {
          "timestamp": 2800,
          "level": "error",
          "source": "page-object:LoginPage",
          "message": "Error message not found",
          "data": { "selector": "[data-testid='error']" }
        }
      ]
    }
  ],
  "artifacts": [
    {
      "test_name": "should show error on invalid credentials",
      "test_file": "tests/auth/login.spec.ts",
      "type": "screenshot",
      "filename": "failure.png",
      "mime_type": "image/png",
      "data": "iVBORw0KGgoAAAANSUhEUgAA..."
    }
  ]
}
```

**Response (Success):**

```json
{
  "success": true,
  "execution_id": 123,
  "results_count": 2,
  "artifacts_count": 1
}
```

**Response (Error):**

```json
{
  "success": false,
  "error": "Missing required fields: execution, results"
}
```

### GET /api/test-results

Returns endpoint documentation.

```json
{
  "endpoint": "POST /api/test-results",
  "version": "1.0.0",
  "required_headers": {
    "Authorization": "Bearer <API_KEY>",
    "Content-Type": "application/json"
  },
  "body_schema": {
    "execution": "ExecutionRequest (required)",
    "results": "TestResultRequest[] (required)",
    "artifacts": "ArtifactRequest[] (optional)"
  }
}
```

---

## Error Handling

| Status | Condition | Response |
|--------|-----------|----------|
| 200 | Success | `{ success: true, execution_id, results_count, artifacts_count }` |
| 400 | Missing fields | `{ success: false, error: "Missing required fields..." }` |
| 401 | Invalid API key | `{ success: false, error: "Unauthorized" }` |
| 500 | Server error | `{ success: false, error: "<message>" }` |

---

## Testing Checklist

- [ ] API key validation works correctly
- [ ] Missing API key returns 401
- [ ] Invalid API key returns 401
- [ ] Missing execution field returns 400
- [ ] Missing results field returns 400
- [ ] Valid request creates execution record
- [ ] All test results are inserted
- [ ] Test signatures are generated correctly
- [ ] Artifacts upload to R2 successfully
- [ ] Artifact records link to correct test results
- [ ] Large payloads (50+ tests) complete within timeout
- [ ] GET endpoint returns documentation

### Manual Testing with curl

```bash
# Test health check
curl https://your-dashboard.vercel.app/api/test-results

# Test with minimal payload
curl -X POST https://your-dashboard.vercel.app/api/test-results \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "execution": {
      "run_id": "test-123",
      "branch": "main",
      "commit_sha": "abc123",
      "triggered_by": "manual",
      "workflow_name": "Test",
      "status": "success",
      "total_tests": 1,
      "passed": 1,
      "failed": 0,
      "skipped": 0,
      "duration_ms": 1000,
      "started_at": "2025-12-26T10:00:00Z"
    },
    "results": [{
      "test_name": "test 1",
      "test_file": "test.spec.ts",
      "status": "passed",
      "duration_ms": 1000,
      "browser": "chromium",
      "retry_count": 0,
      "started_at": "2025-12-26T10:00:00Z"
    }]
  }'
```

---

## Files to Create/Modify

### Create:
- `app/api/test-results/route.ts`

### Modify:
- `lib/types.ts` - Add request/response types
- `lib/db.ts` - Add insert functions
- `lib/r2.ts` - Add upload function

### Environment Variables:
- `API_SECRET_KEY` - For authenticating requests

---

## Security Considerations

1. **API Key Required** - All POST requests must include valid API key
2. **Rate Limiting** - Consider adding rate limiting for production
3. **Input Validation** - Validate all input fields before database insert
4. **Base64 Size Limits** - Artifacts should have reasonable size limits
5. **No PII in Logs** - Avoid logging sensitive test data

---

## Next Steps

After completing this phase:
1. Deploy to Vercel
2. Set `API_SECRET_KEY` environment variable
3. Test with curl/Postman
4. Proceed to [Phase 02: Playwright Reporter](./02-playwright-reporter.md)

---

*Phase 01 Complete → Proceed to Phase 02: Playwright Reporter*
