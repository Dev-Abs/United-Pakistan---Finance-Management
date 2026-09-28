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

async function closePool() {
  if (pool) {
    const currentPool = pool;
    pool = undefined;
    await currentPool.end();
  }
}

module.exports = { getPool, query, withTransaction, closePool };
