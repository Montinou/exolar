#!/usr/bin/env node
/**
 * Run Phase 04 search migration - creates pg_trgm extension and indexes
 */

import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Error: DATABASE_URL_UNPOOLED or DATABASE_URL required');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function runMigration() {
  console.log('Running Phase 04 search migration...\n');

  // 1. Enable pg_trgm extension
  console.log('1. Creating pg_trgm extension...');
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
    console.log('   OK - pg_trgm extension created/exists');
  } catch (error) {
    console.error('   Error:', error.message);
  }

  // 2. Create trigram index on test_name
  console.log('2. Creating trigram index on test_name...');
  try {
    await sql`
      CREATE INDEX IF NOT EXISTS idx_test_results_name_trgm
      ON test_results USING gin (test_name gin_trgm_ops)
    `;
    console.log('   OK - idx_test_results_name_trgm created/exists');
  } catch (error) {
    console.error('   Error:', error.message);
  }

  // 3. Create trigram index on test_file
  console.log('3. Creating trigram index on test_file...');
  try {
    await sql`
      CREATE INDEX IF NOT EXISTS idx_test_results_file_trgm
      ON test_results USING gin (test_file gin_trgm_ops)
    `;
    console.log('   OK - idx_test_results_file_trgm created/exists');
  } catch (error) {
    console.error('   Error:', error.message);
  }

  // 4. Create composite index for signature + status
  console.log('4. Creating signature + status index...');
  try {
    await sql`
      CREATE INDEX IF NOT EXISTS idx_test_results_signature_status
      ON test_results(test_signature, status)
    `;
    console.log('   OK - idx_test_results_signature_status created/exists');
  } catch (error) {
    console.error('   Error:', error.message);
  }

  // 5. Create index for signature + started_at
  console.log('5. Creating signature + started_at index...');
  try {
    await sql`
      CREATE INDEX IF NOT EXISTS idx_test_results_signature_started_at
      ON test_results(test_signature, started_at DESC)
    `;
    console.log('   OK - idx_test_results_signature_started_at created/exists');
  } catch (error) {
    console.error('   Error:', error.message);
  }

  // Verify
  console.log('\n--- Verification ---');

  const ext = await sql`SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`;
  console.log('pg_trgm extension:', ext.length > 0 ? 'INSTALLED' : 'NOT INSTALLED');

  const indexes = await sql`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'test_results'
    AND (indexname LIKE '%trgm%' OR indexname LIKE '%signature%')
  `;
  console.log('Search indexes:');
  indexes.forEach(idx => console.log('  -', idx.indexname));

  console.log('\nMigration completed!');
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
