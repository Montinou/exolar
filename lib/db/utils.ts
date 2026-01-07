// lib/db/utils.ts
import { createHash } from "crypto"

/**
 * Generate MD5 hash signature for test identification
 * Format: MD5(test_file::test_name)
 */
export function generateTestSignature(testFile: string, testName: string): string {
  return createHash("md5").update(`${testFile}::${testName}`).digest("hex")
}

/**
 * Check if a test result is flaky based on retry count and status
 * A test is flaky if it passed after at least one retry
 */
export function isTestFlaky(retryCount: number, status: string): boolean {
  return retryCount > 0 && status === "passed"
}
