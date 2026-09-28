require('dotenv').config();

const db = require('../services/db');

async function main() {
  const configuredRole = db._test.rlsRoleName();
  const result = await db.query(`
    select current_user as connection_role,
      target.rolname as role_name,
      target.rolsuper,
      target.rolbypassrls,
      case when $1 = '' then true else pg_has_role(current_user, target.oid, 'SET') end as can_set_role
    from pg_roles target
    where target.rolname = case when $1 = '' then current_user else $1 end
  `, [configuredRole]);
  const role = result.rows[0];
  if (!role) throw new Error(configuredRole
    ? `DATABASE_RLS_ROLE does not exist: ${configuredRole}`
    : 'Unable to inspect the current database role');

  const safe = {
    connectionRole: role.connection_role,
    roleName: role.role_name,
    superuser: role.rolsuper,
    bypassRls: role.rolbypassrls,
    canSetRole: role.can_set_role,
    rlsEnforcementReady: !role.rolsuper && !role.rolbypassrls && role.can_set_role,
  };
  console.log(JSON.stringify(safe, null, 2));

  if (!safe.rlsEnforcementReady) {
    throw new Error('Use a non-superuser/non-BYPASSRLS DATABASE_URL role, or configure a safe DATABASE_RLS_ROLE that the connection role can SET');
  }
}

main()
  .catch((error) => {
    console.error(`RLS role preflight failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.closePool());
