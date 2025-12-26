#!/usr/bin/env node
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Error: DATABASE_URL required');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function verify() {
  // Check if indexes exist
  const indexes = await sql`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'test_results'
    AND (indexname LIKE '%trgm%' OR indexname LIKE '%signature%')
  `;

  console.log('Search indexes found:');
  if (indexes.length === 0) {
    console.log('  (none)');
  } else {
    indexes.forEach(idx => console.log('  -', idx.indexname));
  }

  // Check if pg_trgm extension exists
  const ext = await sql`
    SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'
  `;
  console.log('\npg_trgm extension:', ext.length > 0 ? 'INSTALLED' : 'NOT INSTALLED');
}

verify().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
