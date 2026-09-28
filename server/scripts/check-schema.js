require('dotenv').config();
const db = require('../services/db');

const requiredTables = [
  'audit_log',
  'expenses',
  'follow_ups',
  'members',
  'message_templates',
  'monthly_payments',
  'months',
  'sectors',
  'settings',
  'special_fund_campaigns',
  'special_fund_contributions',
  'users',
];

const tenantTables = [
  'expenses',
  'follow_ups',
  'members',
  'message_templates',
  'monthly_payments',
  'months',
  'settings',
  'special_fund_campaigns',
  'special_fund_contributions',
];

async function main() {
  const tablesResult = await db.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
    order by table_name
  `);
  const tables = new Set(tablesResult.rows.map((row) => row.table_name));
  const missingTables = requiredTables.filter((table) => !tables.has(table));
  if (missingTables.length) {
    throw new Error(`Missing required tables: ${missingTables.join(', ')}`);
  }

  const sectorColumnsResult = await db.query(`
    select table_name, is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'sector_id'
      and table_name = any($1::text[])
  `, [tenantTables]);
  const nonNullSectorTables = new Set(
    sectorColumnsResult.rows
      .filter((row) => row.is_nullable === 'NO')
      .map((row) => row.table_name),
  );
  const invalidSectorColumns = tenantTables.filter((table) => !nonNullSectorTables.has(table));
  if (invalidSectorColumns.length) {
    throw new Error(`Missing non-null sector_id columns: ${invalidSectorColumns.join(', ')}`);
  }

  const sectorForeignKeysResult = await db.query(`
    select distinct tc.table_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_schema = tc.constraint_schema
      and kcu.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_schema = tc.constraint_schema
      and ccu.constraint_name = tc.constraint_name
    where tc.constraint_schema = 'public'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'sector_id'
      and ccu.table_name = 'sectors'
      and ccu.column_name = 'id'
  `);
  const sectorForeignKeys = new Set(sectorForeignKeysResult.rows.map((row) => row.table_name));
  const missingSectorForeignKeys = tenantTables.filter((table) => !sectorForeignKeys.has(table));
  if (missingSectorForeignKeys.length) {
    throw new Error(`Missing sector foreign keys: ${missingSectorForeignKeys.join(', ')}`);
  }

  const roleConstraintResult = await db.query(`
    select pg_get_constraintdef(oid) as definition
    from pg_constraint
    where conname = 'users_role_sector_check'
  `);
  const roleConstraint = roleConstraintResult.rows[0]?.definition || '';
  for (const role of ['super_admin', 'secretary', 'read_only']) {
    if (!roleConstraint.includes(role)) {
      throw new Error(`Role constraint does not include ${role}`);
    }
  }

  const migrationResult = await db.query(
    'select filename from schema_migrations order by filename',
  );
  if (!migrationResult.rows.some((row) => row.filename === '001_initial_schema.sql')) {
    throw new Error('Initial migration is not recorded in schema_migrations');
  }

  console.log(`Verified ${requiredTables.length} required tables`);
  console.log(`Verified sector isolation columns and foreign keys on ${tenantTables.length} tenant tables`);
  console.log('Verified user role/sector constraint and migration history');
}

main()
  .catch((error) => {
    console.error(`Database schema verification failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.closePool());
