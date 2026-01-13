/**
 * Run migration 018: Add is_representative column to failure_cluster_members
 */

import { config } from "dotenv"
import { resolve } from "path"
import { neon } from "@neondatabase/serverless"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const sql = neon(process.env.DATABASE_URL!)

async function runMigration() {
  console.log("Running migration 018: Add is_representative column...\n")

  try {
    // Execute migration steps one by one
    console.log("Adding is_representative column...")
    await sql`
      ALTER TABLE failure_cluster_members
      ADD COLUMN IF NOT EXISTS is_representative BOOLEAN DEFAULT FALSE
    `

    console.log("Creating index...")
    await sql`
      CREATE INDEX IF NOT EXISTS idx_cluster_members_representative
      ON failure_cluster_members(cluster_id, is_representative)
    `

    console.log("Marking representative failures in existing data...")
    await sql`
      WITH ranked_members AS (
        SELECT
          id,
          cluster_id,
          ROW_NUMBER() OVER (PARTITION BY cluster_id ORDER BY distance_to_centroid ASC NULLS LAST) as rank
        FROM failure_cluster_members
      )
      UPDATE failure_cluster_members
      SET is_representative = TRUE
      FROM ranked_members
      WHERE failure_cluster_members.id = ranked_members.id
        AND ranked_members.rank = 1
    `

    console.log("✅ Migration completed successfully!\n")

    // Verify the column was added
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'failure_cluster_members'
      ORDER BY ordinal_position
    `

    console.log("Updated schema for failure_cluster_members:")
    for (const col of columns) {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`)
    }

    // Check if any representative failures were marked
    const [stats] = await sql`
      SELECT
        COUNT(*) as total_members,
        COUNT(*) FILTER (WHERE is_representative = TRUE) as representative_count
      FROM failure_cluster_members
    `

    console.log(`\nRepresentative failures marked: ${stats.representative_count} out of ${stats.total_members} total members`)

  } catch (error) {
    console.error("❌ Migration failed:", error)
    process.exit(1)
  }
}

runMigration().catch(console.error)
