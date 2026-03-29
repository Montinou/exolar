/**
 * Auto-heal orchestration for CI-detected flaky tests.
 *
 * This module defines the workflow and fix strategies that the
 * exolar-sentinel agent executes when HEALABLE failures are detected.
 *
 * The actual test modification is done by Claude Code / OpenClaw agent.
 * This module provides the instructions and context for the agent.
 */

import { getSql } from "@/lib/db/connection"
import type { HealableFailure } from "./analysis-engine"

export interface HealInstruction {
  test_signature: string
  test_file: string
  test_name: string
  fix_strategy: string
  instruction: string        // Human-readable fix instruction for the agent
  context: {
    error_message: string
    error_type: string
    ai_context: Record<string, unknown> | null
    similar_fixes: Array<{ signature: string; strategy: string }>
  }
  guardrails: {
    max_attempts: number
    allowed_file_patterns: string[]
    forbidden_patterns: string[]
  }
}

export interface HealResult {
  test_signature: string
  fix_strategy: string
  status: "success" | "failed" | "skipped"
  attempts: number
  pr_url?: string
  pr_number?: number
  error_log?: string
}

/**
 * Generate fix instructions for each healable failure.
 * These instructions are consumed by Claude Code / OpenClaw agent.
 */
export function generateHealInstructions(failures: HealableFailure[]): HealInstruction[] {
  return failures.map(f => ({
    test_signature: f.test_signature,
    test_file: f.test_file,
    test_name: f.test_name,
    fix_strategy: f.fix_strategy,
    instruction: getFixInstruction(f),
    context: {
      error_message: f.error_message,
      error_type: f.error_type,
      ai_context: f.ai_context,
      similar_fixes: f.similar_past_fixes.map(pf => ({
        signature: pf.signature,
        strategy: pf.strategy,
      })),
    },
    guardrails: {
      max_attempts: 3,
      allowed_file_patterns: ["*.spec.ts", "*.test.ts", "*.spec.js", "*.test.js"],
      forbidden_patterns: ["src/**", "lib/**", "app/**", "components/**"],
    },
  }))
}

function getFixInstruction(f: HealableFailure): string {
  switch (f.fix_strategy) {
    case "selector_update":
      return `The locator in "${f.test_name}" is fragile or broken. Read the test file at ${f.test_file}, find the failing locator (likely using CSS selector or XPath), and replace it with a more robust alternative: prefer getByRole(), getByTestId(), or getByText(). If the element changed, use Playwright codegen or inspect the page to find the correct selector.`
    case "wait_adjustment":
      return `"${f.test_name}" has a timeout error. The page or element isn't ready when the test expects it. Add explicit waits: page.waitForLoadState('networkidle') before assertions, or increase the specific locator timeout. Do NOT increase global timeout — fix the specific wait.`
    case "race_condition":
      return `"${f.test_name}" passes on retry but fails on first attempt — a race condition. Add a visibility/stability guard before the failing action: await expect(locator).toBeVisible() or await expect(locator).toBeEnabled() before clicking/filling. Check if there's an animation or async state that needs settling.`
    case "api_timing":
      return `"${f.test_name}" fails due to intermittent API errors (5xx or timeout). Add page.waitForResponse() to wait for the specific API call to complete before asserting, or add a retry mechanism for the specific network call. If the API is unreliable in tests, consider mocking it.`
    case "retry_logic":
      return `"${f.test_name}" has a stale element error. The DOM changed between querying the element and acting on it. Re-query the locator immediately before the action, or use Playwright's auto-waiting by chaining actions: await page.locator('...').click() instead of storing the locator in a variable.`
    default:
      return `Investigate and fix the failing test "${f.test_name}" in ${f.test_file}. Error: ${f.error_message}`
  }
}

/**
 * Record a heal attempt result in the database.
 */
export async function recordHealAttempt(
  analysisId: number,
  result: HealResult
): Promise<void> {
  const sql = getSql()
  await sql`
    INSERT INTO ci_auto_heal_attempts (
      analysis_id, test_signature, fix_strategy, attempt_number,
      status, pr_url, pr_number, error_log, completed_at
    ) VALUES (
      ${analysisId},
      ${result.test_signature},
      ${result.fix_strategy},
      ${result.attempts},
      ${result.status},
      ${result.pr_url ?? null},
      ${result.pr_number ?? null},
      ${result.error_log ?? null},
      NOW()
    )
    ON CONFLICT (analysis_id, test_signature, attempt_number)
    DO UPDATE SET
      status = EXCLUDED.status,
      pr_url = EXCLUDED.pr_url,
      pr_number = EXCLUDED.pr_number,
      error_log = EXCLUDED.error_log,
      completed_at = EXCLUDED.completed_at
  `
}
