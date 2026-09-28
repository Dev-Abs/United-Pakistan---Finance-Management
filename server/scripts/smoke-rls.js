require('dotenv').config();

const db = require('../services/db');

async function main() {
  const role = db._test.rlsRoleName();
  if (!role) throw new Error('DATABASE_RLS_ROLE is required');
  const sectors = await db.query('select id from sectors order by id limit 2');
  if (sectors.rowCount < 2) throw new Error('RLS smoke requires at least two sectors');
  const [first, second] = sectors.rows.map((row) => Number(row.id));

  const missingContext = await db.withSectorTransaction({}, (client) => client.query('select count(*)::int as count from months'));
  if (missingContext.rows[0].count !== 0) throw new Error('Missing context exposed tenant rows');

  const scoped = await db.withSectorTransaction({ sectorId: first, role: 'secretary' }, (client) => client.query(
    'select count(*)::int as visible, count(*) filter (where sector_id <> $1)::int as leaked from months',
    [first],
  ));
  if (scoped.rows[0].leaked !== 0) throw new Error('Sector context exposed another sector');

  const forged = await db.withSectorTransaction({ sectorId: first, role: 'secretary' }, (client) => client.query(
    'select count(*)::int as count from months where sector_id=$1',
    [second],
  ));
  if (forged.rows[0].count !== 0) throw new Error('Explicit cross-sector predicate bypassed RLS');

  const platform = await db.withSectorTransaction({ sectorId: null, role: 'super_admin' }, (client) => client.query(
    'select count(distinct sector_id)::int as sectors from months',
  ));
  if (platform.rows[0].sectors < 1) throw new Error('Super-admin policy branch returned no tenant data');

  const supportTables = await db.withSectorTransaction({ sectorId: first, role: 'secretary' }, async (client) => {
    const users = await client.query('select count(*)::int as count from users where sector_id=$1', [first]);
    const audit = await client.query('select count(*)::int as count from audit_log where sector_id=$1', [first]);
    return { users: users.rows[0].count, audit: audit.rows[0].count };
  });

  console.log(JSON.stringify({
    passed: true,
    runtimeRole: role,
    missingContextRows: missingContext.rows[0].count,
    scopedRows: scoped.rows[0].visible,
    crossSectorRows: forged.rows[0].count,
    superAdminVisibleSectors: platform.rows[0].sectors,
    supportTableAccess: supportTables,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(`RLS smoke failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.closePool());
