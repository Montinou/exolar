
import { config } from "dotenv"
import path from "path"
import { getSql } from "@/lib/db"
import { deleteFromR2, isR2Configured } from "@/lib/r2"

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), ".env.local") })

async function deleteExecutionHistory(targetId: number) {
  if (!targetId || isNaN(targetId)) {
    console.error("Please provide a valid execution ID as an argument.")
    process.exit(1)
  }

  const sql = getSql()
  console.log(`Starting cleanup for execution ID ${targetId} and prior...`)

  try {
    // 1. Identify all executions to delete (<= targetId)
    const executionsToDelete = await sql`
      SELECT id FROM test_executions 
      WHERE id <= ${targetId}
    `

    const executionIds = executionsToDelete.map(row => row.id)
    
    if (executionIds.length === 0) {
      console.log("No executions found to delete.")
      process.exit(0)
    }

    console.log(`Found ${executionIds.length} executions to delete: ${executionIds.join(", ")}`)

    // 2. Find all associated artifacts in R2
    // We can join test_artifacts -> test_results -> test_executions
    if (isR2Configured()) {
      console.log("Fetching associated artifacts from R2...")
      const artifactsToDelete = await sql`
        SELECT ta.r2_key
        FROM test_artifacts ta
        JOIN test_results tr ON ta.test_result_id = tr.id
        JOIN test_executions te ON tr.execution_id = te.id
        WHERE te.id <= ${targetId}
      `

      const keys = artifactsToDelete.map(row => row.r2_key as string)
      
      if (keys.length > 0) {
        console.log(`Found ${keys.length} artifacts to delete from R2.`)
        await deleteFromR2(keys)
        console.log("Successfully deleted artifacts from R2.")
      } else {
        console.log("No artifacts found in R2 for these executions.")
      }
    } else {
      console.warn("R2 is not configured. Skipping artifact deletion.")
    }

    // 3. Delete executions from Database
    // ON DELETE CASCADE will handle test_results and test_artifacts records
    console.log("Deleting executions from database...")
    await sql`
      DELETE FROM test_executions
      WHERE id <= ${targetId}
    `
    
    console.log("Database cleanup complete.")

  } catch (error) {
    console.error("Error during cleanup:", error)
    process.exit(1)
  } finally {
    // Close database connection if needed (neon uses http, so not strictly necessary, but good practice if pooling)
    // sql.end() not needed for serverless driver usually
  }
}

// Get ID from command line arg
const idArg = process.argv[2]
const targetId = parseInt(idArg)

deleteExecutionHistory(targetId)
