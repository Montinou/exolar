#!/usr/bin/env tsx
/**
 * Migration runner for SQL files
 *
 * Usage: tsx scripts/run-migration.ts <migration-file.sql>
 */

import { config } from "dotenv"
import { neon } from "@neondatabase/serverless"
import { readFileSync } from "fs"
import { resolve } from "path"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

async function runMigration(migrationFile: string) {
  const sql = neon(process.env.DATABASE_URL!)

  // Read migration file
  const migrationPath = resolve(process.cwd(), migrationFile)
  const migrationSQL = readFileSync(migrationPath, "utf-8")

  console.log(`\n📦 Running migration: ${migrationFile}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  try {
    // Remove SQL comments (-- and /* */)
    const cleanSQL = migrationSQL
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .replace(/\/\*[\s\S]*?\*\//g, "") // Remove block comments

    // Split on semicolons but preserve DO blocks and other multi-line statements
    const statements: string[] = []
    let currentStatement = ""
    let inDoBlock = false

    for (const line of cleanSQL.split("\n")) {
      const trimmed = line.trim()

      // Track DO blocks
      if (trimmed.match(/DO\s+\$\$/i)) {
        inDoBlock = true
      }

      currentStatement += line + "\n"

      // End of DO block
      if (inDoBlock && trimmed.match(/END\s+\$\$/i)) {
        inDoBlock = false
        statements.push(currentStatement.trim())
        currentStatement = ""
        continue
      }

      // Regular statement end (semicolon not in DO block)
      if (!inDoBlock && trimmed.endsWith(";")) {
        statements.push(currentStatement.trim())
        currentStatement = ""
      }
    }

    // Add any remaining statement
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim())
    }

    const validStatements = statements.filter(
      (s) => s.length > 0 && !s.match(/^\s*$/)
    )

    console.log(`Executing ${validStatements.length} statements...\n`)

    // Execute each statement
    for (let i = 0; i < validStatements.length; i++) {
      const statement = validStatements[i]

      console.log(`[${i + 1}/${validStatements.length}] Executing...`)

      try {
        // Use unsafe method for raw SQL (migrations are trusted)
        await sql.unsafe(statement)
        console.log(`✓ Success\n`)
      } catch (error: any) {
        // Ignore "already exists" errors for idempotency
        if (
          error.message?.includes("already exists") ||
          error.message?.includes("duplicate") ||
          error.message?.includes("does not exist")
        ) {
          console.log(`⊘ Skipped (already exists or optional)\n`)
        } else {
          console.error(`Statement:\n${statement.substring(0, 200)}...\n`)
          throw error
        }
      }
    }

    console.log(`✅ Migration completed successfully\n`)
  } catch (error) {
    console.error(`❌ Migration failed:`, error)
    process.exit(1)
  }
}

// Get migration file from command line
const migrationFile = process.argv[2]

if (!migrationFile) {
  console.error("Usage: tsx scripts/run-migration.ts <migration-file.sql>")
  process.exit(1)
}

runMigration(migrationFile)
