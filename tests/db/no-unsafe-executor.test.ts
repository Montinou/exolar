import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "fs"
import path from "path"

/**
 * Regression guard for a bug class that is invisible at runtime and at type-check
 * time, and that unit-test mocks actively hide.
 *
 * In `@neondatabase/serverless`, `sql.unsafe(rawSQL)` returns an `UnsafeRawSql`
 * MARKER meant to be interpolated inside a tagged template:
 *
 *     await sql`SELECT * FROM t ${sql.unsafe(whereClause)}`   // ✅ executes
 *
 * It is NOT an executor. Calling it directly runs no query at all, and because
 * the returned marker is not a thenable, `await` yields the marker object
 * itself rather than rows:
 *
 *     const rows = await sql.unsafe(query)                     // ❌ never runs
 *     Array.isArray(rows) === false                            // → silently []
 *
 * That semantic belongs to the `postgres` (porsager) package, where
 * `sql.unsafe()` does execute. Code ported from it keeps type-checking (the
 * return type is `any`-ish once awaited) and keeps passing tests that mock
 * `unsafe` as a row-returning function — while returning empty data forever in
 * production. Eight call sites across lib/ and app/ shipped exactly this way,
 * which made the `failures`, `error_analysis` and `trends` MCP datasets read as
 * "no failures" and made an INSERT into `ci_analysis_results` a no-op.
 *
 * The correct executor for a dynamically-built query string is
 * `sql.query(text, params?)`.
 */

const ROOTS = ["lib", "app"]
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", ".git"])

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, acc)
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      acc.push(full)
    }
  }
  return acc
}

/**
 * Matches `sql.unsafe(` used as an EXECUTOR — awaited, assigned, or returned —
 * while allowing the legitimate `${sql.unsafe(...)}` template interpolation.
 * The receiver is matched loosely (`\w+\.unsafe`) so a renamed sql binding is
 * still caught.
 */
const EXECUTOR_USE = /(?:await|=|return)\s+\w+\.unsafe\s*\(/

describe("sql.unsafe is never used as a query executor", () => {
  const repoRoot = process.cwd()

  it("finds no `await/= /return sql.unsafe(...)` in lib/ or app/", () => {
    const offenders: string[] = []

    for (const root of ROOTS) {
      const abs = path.join(repoRoot, root)
      for (const file of collectSourceFiles(abs)) {
        const lines = readFileSync(file, "utf8").split("\n")
        lines.forEach((line, i) => {
          // `${sql.unsafe(...)}` is the supported interpolation form.
          if (line.includes("${") && line.includes(".unsafe(")) return
          if (EXECUTOR_USE.test(line)) {
            offenders.push(`${path.relative(repoRoot, file)}:${i + 1}: ${line.trim()}`)
          }
        })
      }
    }

    expect(
      offenders,
      `sql.unsafe() does not execute queries in @neondatabase/serverless — it returns a marker for template interpolation. Use sql.query(text, params) instead.\n\n${offenders.join("\n")}`,
    ).toEqual([])
  })
})
