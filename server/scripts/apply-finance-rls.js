require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const db = require('../services/db');

async function main() {
  if (process.env.RLS_APPLY_CONFIRM !== 'enable-finance-rls') {
    throw new Error('Set RLS_APPLY_CONFIRM=enable-finance-rls for this command only');
  }
  const role = db._test.rlsRoleName();
  if (!role) throw new Error('DATABASE_RLS_ROLE is required');
  const readiness = await db.query(`
    select r.rolsuper, r.rolbypassrls,
      pg_has_role(current_user, r.oid, 'SET') as can_set_role
    from pg_roles r where r.rolname=$1
  `, [role]);
  const target = readiness.rows[0];
  if (!target || target.rolsuper || target.rolbypassrls || !target.can_set_role) {
    throw new Error('Configured DATABASE_RLS_ROLE is not enforcement-ready');
  }

  const sql = fs.readFileSync(path.join(__dirname, '../../db/rls/finance-policies.sql'), 'utf8');
  await db.query(sql);
  console.log(JSON.stringify({ policiesEnabled: true, runtimeRole: role }, null, 2));
}

main()
  .catch((error) => {
    console.error(`RLS apply failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.closePool());
