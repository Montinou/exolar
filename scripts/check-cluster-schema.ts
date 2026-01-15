/**
 * Check failure_clusters table schema
 */

import { config } from "dotenv"
import { resolve } from "path"
import { neon } from "@neondatabase/serverless"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const sql = neon(process.env.DATABASE_URL!)

async function checkSchema() {
  console.log("Checking failure_clusters table schema...\n")

  const columns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'failure_clusters'
    ORDER BY ordinal_position
  `

  if (columns.length === 0) {
    console.log("❌ Table 'failure_clusters' does not exist!")
    return
  }

  console.log("Columns found:")
  for (const col of columns) {
    console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`)
  }
}

checkSchema().catch(console.error)
