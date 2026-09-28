const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for Postgres access');
    }

    // Vercel creates one pool per warm function instance. Supabase recommends
    // one application-side connection when using its transaction pooler.
    pool = new Pool({ connectionString, max: 1 });
    pool.on('error', (error) => {
      console.error('Unexpected Postgres pool error:', error.message);
    });
  }

  return pool;
}

function query(text, params) {
  return getPool().query(text, params);
}

function rlsRoleName(value = process.env.DATABASE_RLS_ROLE) {
  const role = String(value || '').trim();
  if (!role) return '';
  if (!/^[a-z_][a-z0-9_]*$/i.test(role)) {
    throw new Error('DATABASE_RLS_ROLE must be a simple PostgreSQL role name');
  }
  return role;
}

async function withTransaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// RLS-ready transaction context. Policies can read these transaction-local
// settings through current_setting(..., true) once every tenant mutation/read
// is migrated to this helper. It deliberately does not alter ordinary queries.
async function withSectorTransaction({ sectorId, role } = {}, callback) {
  return withTransaction(async (client) => {
    const restrictedRole = rlsRoleName();
    if (restrictedRole) await client.query(`SET LOCAL ROLE "${restrictedRole}"`);
    await client.query(`select set_config('app.current_sector_id', $1, true), set_config('app.current_role', $2, true)`, [sectorId == null ? '' : String(sectorId), role == null ? '' : String(role)]);
    return callback(client);
  });
}

async function closePool() {
  if (pool) {
    const currentPool = pool;
    pool = undefined;
    await currentPool.end();
  }
}

module.exports = { getPool, query, withTransaction, withSectorTransaction, closePool, _test: { rlsRoleName } };
