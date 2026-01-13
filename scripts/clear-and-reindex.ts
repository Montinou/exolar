/**
 * Clear old embeddings and prepare for reindexing
 *
 * Usage: npx tsx scripts/clear-and-reindex.ts
 */

import { config } from "dotenv"
import { resolve } from "path"
import { neon } from "@neondatabase/serverless"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL not found")
}

async function clearOldEmbeddings() {
  const sql = neon(DATABASE_URL)

  console.log("📊 Step 1: Check current status...")
  const currentStatus = await sql`
    SELECT
      COUNT(*) as total_tests,
      COUNT(error_embedding_v2) as with_v2_embedding
    FROM test_results tr
    INNER JOIN test_executions te ON tr.execution_id = te.id
    WHERE te.organization_id = 1
  `
  console.log("Current status:", {
    totalTests: Number(currentStatus[0].total_tests),
    withV2Embedding: Number(currentStatus[0].with_v2_embedding),
  })

  console.log("\n🗑️  Step 2: Clearing ALL embeddings...")

  // Clear ALL error_embedding_v2 for organization
  const clearResult = await sql`
    UPDATE test_results
    SET error_embedding_v2 = NULL,
        embedding_chunk_hash = NULL
    WHERE error_embedding_v2 IS NOT NULL
      AND id IN (
        SELECT tr.id FROM test_results tr
        INNER JOIN test_executions te ON tr.execution_id = te.id
        WHERE te.organization_id = 1
      )
  `

  const clearedCount = clearResult.length
  console.log(`✅ Cleared ${clearedCount} embeddings`)

  console.log("\n📊 Step 3: Check how many need reindexing...")
  const needsReindex = await sql`
    SELECT COUNT(*) as needs_embedding
    FROM test_results tr
    INNER JOIN test_executions te ON tr.execution_id = te.id
    WHERE te.organization_id = 1
      AND tr.status IN ('failed', 'timedout')
      AND tr.error_embedding_v2 IS NULL
      AND (tr.error_message IS NOT NULL OR tr.stack_trace IS NOT NULL)
  `
  console.log(
    "Tests needing v2 embeddings:",
    Number(needsReindex[0].needs_embedding)
  )

  console.log("\n✅ Done! Now ready to reindex.")
  console.log("\nNext step: Use MCP to trigger reindexing:")
  console.log(
    'curl -X POST "https://exolar.ai-innovation.site/api/admin/backfill-embeddings" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"limit": 50}\''
  )
}

clearOldEmbeddings().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
