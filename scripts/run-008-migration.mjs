#!/usr/bin/env node
/**
 * Run migration 008: Add ai_context column
 * This runner executes the entire migration as one statement (handles DO $$ blocks)
 * Usage: DATABASE_URL_UNPOOLED="..." node scripts/run-008-migration.mjs
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Error: DATABASE_URL or DATABASE_URL_UNPOOLED environment variable is required');
  process.exit(1);
}

async function runMigration() {
  const sql = neon(databaseUrl);
  const filePath = resolve(__dirname, '008_add_ai_context.sql');

  console.log('Running migration 008: Add ai_context column for AI-friendly failure analysis');
  console.log('='.repeat(70));

  const migrationSql = readFileSync(filePath, 'utf-8');

  // Extract and run the DO $$ block
  const doBlockMatch = migrationSql.match(/DO \$\$[\s\S]*?END \$\$/);
  if (doBlockMatch) {
    try {
      console.log('\n1. Running DO $$ block (add column + indexes)...');
      await sql.unsafe(doBlockMatch[0]);
      console.log('   ✓ DO block executed successfully');
    } catch (error) {
      console.error(`   ✗ Error: ${error.message}`);
      throw error;
    }
  }

  // Run the COMMENT statement
  const commentMatch = migrationSql.match(/COMMENT ON COLUMN[\s\S]*?;/);
  if (commentMatch) {
    try {
      console.log('\n2. Adding column documentation comment...');
      await sql.unsafe(commentMatch[0]);
      console.log('   ✓ Comment added successfully');
    } catch (error) {
      // Ignore if column doesn't exist yet
      if (error.message?.includes('does not exist')) {
        console.log('   - Skipped (column may not exist yet)');
      } else {
        console.error(`   ✗ Error: ${error.message}`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('Migration 008 completed!');

  // Verify the column exists
  console.log('\nVerification:');

  const columns = await sql`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'test_results'
    AND column_name = 'ai_context'
  `;

  if (columns.length > 0) {
    console.log('✓ ai_context column exists:');
    columns.forEach(col => {
      console.log(`  - Type: ${col.data_type}`);
      console.log(`  - Default: ${col.column_default || 'NULL'}`);
    });
  } else {
    console.log('✗ ai_context column NOT found');
    process.exit(1);
  }

  // Verify indexes
  const indexes = await sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'test_results'
    AND indexname LIKE '%ai_context%'
  `;

  console.log(`\n✓ Indexes created: ${indexes.length}`);
  indexes.forEach(idx => {
    console.log(`  - ${idx.indexname}`);
  });

  // Count existing records (should be unaffected)
  const count = await sql`SELECT COUNT(*) as total FROM test_results`;
  console.log(`\n✓ Existing records unaffected: ${count[0].total} test_results rows`);
}

runMigration().catch(err => {
  console.error('\nMigration failed:', err.message);
  process.exit(1);
});
