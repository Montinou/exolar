// Environment variables provided via --env-file
import path from "path"
import { neon } from "@neondatabase/serverless"
import { S3Client, DeleteObjectsCommand } from "@aws-sdk/client-s3"

// --- Inline DB Helper ---
function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set")
  }
  return neon(process.env.DATABASE_URL)
}

// --- Inline R2 Helper ---
function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucketName = process.env.R2_BUCKET_NAME

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    // If credentials missing, return null to skip R2 cleanup
    return null
  }

  return {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    }),
    bucketName
  }
}

async function deleteFromR2(keys: string | string[]): Promise<void> {
  const r2 = getR2Client()
  if (!r2) return

  const { client, bucketName } = r2
  const keysArray = Array.isArray(keys) ? keys : [keys]
  
  if (keysArray.length === 0) return

  // Delete in batches of 1000 (S3 limit)
  const batchSize = 1000
  for (let i = 0; i < keysArray.length; i += batchSize) {
    const batch = keysArray.slice(i, i + batchSize)
    
    const command = new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: {
        Objects: batch.map(key => ({ Key: key })),
        Quiet: true
      }
    })

    await client.send(command)
  }
}

// --- Main Script ---

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

    const executionIds = executionsToDelete.map((row: any) => row.id)
    
    if (executionIds.length === 0) {
      console.log("No executions found to delete.")
      process.exit(0)
    }

    console.log(`Found ${executionIds.length} executions to delete: ${executionIds.join(", ")}`)

    // 2. Find all associated artifacts in R2
    const r2 = getR2Client()
    if (r2) {
      console.log("Fetching associated artifacts from R2...")
      const artifactsToDelete = await sql`
        SELECT ta.r2_key
        FROM test_artifacts ta
        JOIN test_results tr ON ta.test_result_id = tr.id
        JOIN test_executions te ON tr.execution_id = te.id
        WHERE te.id <= ${targetId}
      `

      const keys: string[] = artifactsToDelete.map((row: any) => row.r2_key)
      
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
  }
}

// Get ID from command line arg
const idArg = process.argv[2]
const targetId = parseInt(idArg)

deleteExecutionHistory(targetId)
