/**
 * Migration Script: Populate Global Error Patterns
 *
 * This script backfills the error_patterns and error_pattern_occurrences tables
 * from existing test_results with v2 embeddings.
 *
 * Usage: npx tsx scripts/migrate-to-global-patterns.ts [--dry-run]
 */

import "dotenv/config"
import { neon } from "@neondatabase/serverless"
import { parseVectorString, toVectorString, cosineSimilarity } from "@/lib/ai"

const SIMILARITY_THRESHOLD = 0.25 // ~75% similarity

function inferCategory(errorMessage: string): string {
  const msg = errorMessage.toLowerCase()

  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("waiting for") ||
    msg.includes("exceeded") ||
    msg.includes("deadline")
  ) {
    return "timeout"
  }

  if (
    msg.includes("auth") ||
    msg.includes("login") ||
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("unauthorized") ||
    msg.includes("forbidden") ||
    msg.includes("permission")
  ) {
    return "auth"
  }

  if (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("connection") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("socket") ||
    msg.includes("dns")
  ) {
    return "network"
  }

  if (
    msg.includes("not found") ||
    msg.includes("no element") ||
    msg.includes("selector") ||
    msg.includes("locator") ||
    msg.includes("could not find") ||
    msg.includes("does not exist")
  ) {
    return "element"
  }

  if (
    msg.includes("expect") ||
    msg.includes("assert") ||
    msg.includes("tobe") ||
    msg.includes("toequal") ||
    msg.includes("tohave") ||
    msg.includes("tomatch") ||
    msg.includes("tocontain")
  ) {
    return "assertion"
  }

  return "other"
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run")

  console.log("🚀 Starting migration to global error patterns...")
  console.log(`   Mode: ${isDryRun ? "DRY RUN (no changes)" : "LIVE"}\n`)

  const sql = neon(process.env.DATABASE_URL!)

  // Get all failures with v2 embeddings, grouped by organization
  console.log("📊 Fetching failures with embeddings...")

  const failures = await sql`
    SELECT
      tr.id as test_result_id,
      tr.test_name,
      tr.test_file,
      tr.error_message,
      tr.error_embedding_v2::text as embedding,
      tr.execution_id,
      tr.created_at,
      te.organization_id
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE tr.status IN ('failed', 'timedout')
      AND tr.error_embedding_v2 IS NOT NULL
      AND tr.error_message IS NOT NULL
    ORDER BY te.organization_id, tr.created_at ASC
  `

  console.log(`   Found ${failures.length} failures to process\n`)

  if (failures.length === 0) {
    console.log("✅ No failures to migrate. Done!")
    return
  }

  // Group by organization
  const orgFailures = new Map<number, typeof failures>()
  for (const f of failures) {
    const orgId = f.organization_id as number
    if (!orgFailures.has(orgId)) {
      orgFailures.set(orgId, [])
    }
    orgFailures.get(orgId)!.push(f)
  }

  console.log(`📁 Processing ${orgFailures.size} organization(s)...\n`)

  let totalPatternsCreated = 0
  let totalOccurrencesLinked = 0

  for (const [orgId, orgFailureList] of orgFailures) {
    console.log(`\n🏢 Organization ${orgId}: ${orgFailureList.length} failures`)

    // In-memory pattern registry for this org
    const patterns: Array<{
      id?: number
      canonicalError: string
      embedding: number[]
      category: string
      occurrences: typeof orgFailureList
    }> = []

    // Process each failure
    for (const failure of orgFailureList) {
      const embedding = parseVectorString(failure.embedding as string)
      const errorMessage = failure.error_message as string

      // Find best matching pattern
      let bestPattern: (typeof patterns)[0] | null = null
      let bestDistance = Infinity

      for (const pattern of patterns) {
        const similarity = cosineSimilarity(embedding, pattern.embedding)
        const distance = 1 - similarity

        if (distance < bestDistance) {
          bestDistance = distance
          bestPattern = pattern
        }
      }

      if (bestPattern && bestDistance < SIMILARITY_THRESHOLD) {
        // Add to existing pattern
        bestPattern.occurrences.push(failure)
        // Update centroid (simple average)
        bestPattern.embedding = averageVectors([
          bestPattern.embedding,
          embedding,
        ])
      } else {
        // Create new pattern
        patterns.push({
          canonicalError: errorMessage,
          embedding,
          category: inferCategory(errorMessage),
          occurrences: [failure],
        })
      }
    }

    console.log(`   Created ${patterns.length} patterns`)

    if (isDryRun) {
      // Just show stats
      for (const pattern of patterns.slice(0, 5)) {
        console.log(
          `   - [${pattern.category}] ${pattern.occurrences.length} occurrences: "${pattern.canonicalError.slice(0, 60)}..."`
        )
      }
      if (patterns.length > 5) {
        console.log(`   ... and ${patterns.length - 5} more patterns`)
      }
      totalPatternsCreated += patterns.length
      totalOccurrencesLinked += orgFailureList.length
      continue
    }

    // Insert patterns and occurrences into database
    for (const pattern of patterns) {
      const vectorStr = toVectorString(pattern.embedding)

      // Insert pattern
      const [newPattern] = await sql`
        INSERT INTO error_patterns (
          organization_id, canonical_error, centroid_embedding, category,
          total_occurrences, affected_executions, affected_tests,
          first_seen, last_seen
        ) VALUES (
          ${orgId},
          ${pattern.canonicalError},
          ${vectorStr}::vector,
          ${pattern.category},
          ${pattern.occurrences.length},
          ${new Set(pattern.occurrences.map((o) => o.execution_id)).size},
          ${new Set(pattern.occurrences.map((o) => `${o.test_file}:${o.test_name}`)).size},
          ${pattern.occurrences[0].created_at},
          ${pattern.occurrences[pattern.occurrences.length - 1].created_at}
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `

      if (!newPattern) continue

      pattern.id = newPattern.id as number
      totalPatternsCreated++

      // Insert occurrences
      for (const occ of pattern.occurrences) {
        const occEmbedding = parseVectorString(occ.embedding as string)
        const distance = 1 - cosineSimilarity(occEmbedding, pattern.embedding)

        await sql`
          INSERT INTO error_pattern_occurrences (
            pattern_id, test_result_id, execution_id, distance_to_centroid, created_at
          ) VALUES (
            ${pattern.id},
            ${occ.test_result_id},
            ${occ.execution_id},
            ${distance},
            ${occ.created_at}
          )
          ON CONFLICT (test_result_id) DO NOTHING
        `
        totalOccurrencesLinked++
      }
    }

    console.log(`   ✅ Inserted ${patterns.length} patterns`)
  }

  // Now populate test_failure_stats
  console.log("\n📊 Building test failure statistics...")

  if (!isDryRun) {
    // Get all test results grouped by test signature
    await sql`
      INSERT INTO test_failure_stats (
        organization_id, test_signature, test_file, test_title,
        total_failures, total_runs, first_failure, last_failure
      )
      SELECT
        te.organization_id,
        tr.test_file || ':' || tr.test_name as test_signature,
        tr.test_file,
        tr.test_name,
        COUNT(*) FILTER (WHERE tr.status IN ('failed', 'timedout')) as total_failures,
        COUNT(*) as total_runs,
        MIN(tr.created_at) FILTER (WHERE tr.status IN ('failed', 'timedout')) as first_failure,
        MAX(tr.created_at) FILTER (WHERE tr.status IN ('failed', 'timedout')) as last_failure
      FROM test_results tr
      JOIN test_executions te ON tr.execution_id = te.id
      GROUP BY te.organization_id, tr.test_file, tr.test_name
      ON CONFLICT (organization_id, test_signature) DO UPDATE SET
        total_failures = EXCLUDED.total_failures,
        total_runs = EXCLUDED.total_runs,
        first_failure = EXCLUDED.first_failure,
        last_failure = EXCLUDED.last_failure
    `
    console.log("   ✅ Test failure stats populated")
  }

  console.log("\n" + "=".repeat(50))
  console.log("📈 Migration Summary:")
  console.log(`   Patterns created: ${totalPatternsCreated}`)
  console.log(`   Occurrences linked: ${totalOccurrencesLinked}`)
  console.log(`   Mode: ${isDryRun ? "DRY RUN" : "COMPLETED"}`)
  console.log("=".repeat(50))
}

function averageVectors(vectors: number[][]): number[] {
  if (vectors.length === 0) return []

  const dims = vectors[0].length
  const result = new Array(dims).fill(0)

  for (const vec of vectors) {
    for (let i = 0; i < dims; i++) {
      result[i] += vec[i]
    }
  }

  for (let i = 0; i < dims; i++) {
    result[i] /= vectors.length
  }

  return result
}

main().catch((err) => {
  console.error("❌ Migration failed:", err)
  process.exit(1)
})
