require('dotenv').config();

const db = require('../services/db');

const TENANT_TABLES = [
  'months',
  'members',
  'monthly_payments',
  'expenses',
  'follow_ups',
  'special_fund_campaigns',
  'special_fund_contributions',
  'message_templates',
  'settings',
];

async function main() {
  const role = db._test.rlsRoleName();
  if (!role) throw new Error('Set DATABASE_RLS_ROLE to the restricted role name before provisioning');
  const quotedRole = `"${role}"`;

  await db.withTransaction(async (client) => {
    const existing = await client.query('select 1 from pg_roles where rolname=$1', [role]);
    if (!existing.rowCount) await client.query(`CREATE ROLE ${quotedRole} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    await client.query(`ALTER ROLE ${quotedRole} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    await client.query(`GRANT ${quotedRole} TO CURRENT_USER WITH SET TRUE`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${quotedRole}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${TENANT_TABLES.map((table) => `public.${table}`).join(', ')} TO ${quotedRole}`);
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${quotedRole}`);
  });

  console.log(JSON.stringify({ roleName: role, provisioned: true, policiesEnabled: false }, null, 2));
  console.log('Run npm run db:check-rls-role before considering policy application.');
}

main()
  .catch((error) => {
    console.error(`RLS role provisioning failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.closePool());

module.exports = { TENANT_TABLES };
