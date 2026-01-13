/**
 * Cluster all executions with failures
 *
 * Usage: npx tsx scripts/cluster-all-executions.ts
 */

import { config } from "dotenv"
import { resolve } from "path"
import { getCachedClusters } from "@/lib/db/cluster-cache"
import { getSql } from "@/lib/db/connection"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

async function clusterAllExecutions() {
  const sql = getSql()

  console.log("🔍 Finding executions with failures...\n")

  // Get all executions with failures that have embeddings
  const executions = await sql`
    SELECT
      te.id as execution_id,
      COUNT(tr.id) as failed_count
    FROM test_executions te
    JOIN test_results tr ON tr.execution_id = te.id
    WHERE tr.status IN ('failed', 'timedout')
      AND tr.error_embedding_v2 IS NOT NULL
    GROUP BY te.id
    ORDER BY te.id DESC
  `

  if (executions.length === 0) {
    console.log("✅ No executions with embedded failures found!")
    return
  }

  console.log(`Found ${executions.length} executions with failures\n`)
  console.log("🔄 Generating clusters...\n")

  let totalClusters = 0
  let totalMembers = 0

  for (const exec of executions) {
    const executionId = exec.execution_id as number
    const failedCount = exec.failed_count as number

    try {
      const clusters = await getCachedClusters(executionId)
      const memberCount = clusters.reduce((sum, c) => sum + c.tests.length, 0)

      totalClusters += clusters.length
      totalMembers += memberCount

      console.log(
        `  ✅ Execution ${executionId}: ${failedCount} failures → ${clusters.length} clusters`
      )
    } catch (error) {
      console.log(`  ❌ Execution ${executionId}: Error - ${(error as Error).message}`)
    }
  }

  console.log("\n✅ Clustering complete!\n")
  console.log("📊 Stats:")
  console.log(`  Executions processed: ${executions.length}`)
  console.log(`  Total clusters: ${totalClusters}`)
  console.log(`  Total members: ${totalMembers}`)
}

clusterAllExecutions().catch((error) => {
  console.error("❌ Error:", error)
  process.exit(1)
})
