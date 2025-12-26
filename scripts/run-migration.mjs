#!/usr/bin/env node
/**
 * Run SQL migrations against Neon database
 * Usage: node scripts/run-migration.mjs scripts/003_add_logs_and_signature.sql
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Error: DATABASE_URL or DATABASE_URL_UNPOOLED environment variable is required');
  process.exit(1);
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node scripts/run-migration.mjs <migration-file.sql>');
  process.exit(1);
}

async function runMigration() {
  const sql = neon(databaseUrl);
  const filePath = resolve(process.cwd(), migrationFile);

  console.log(`Running migration: ${migrationFile}`);

  const migrationSql = readFileSync(filePath, 'utf-8');

  // Split by semicolon and run each statement
  const statements = migrationSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    try {
      console.log(`Executing: ${statement.substring(0, 60)}...`);
      await sql.unsafe(statement);
      console.log('  OK');
    } catch (error) {
      // Ignore "already exists" errors for idempotent migrations
      if (error.message?.includes('already exists') || error.message?.includes('does not exist')) {
        console.log(`  Skipped (already applied or not applicable)`);
      } else {
        console.error(`  Error: ${error.message}`);
        throw error;
      }
    }
  }

  console.log('\nMigration completed successfully!');

  // Verify the columns exist
  const columns = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'test_results'
    AND column_name IN ('test_signature', 'logs')
  `;

  console.log('\nVerification - New columns in test_results:');
  columns.forEach(col => {
    console.log(`  - ${col.column_name}: ${col.data_type}`);
  });
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
