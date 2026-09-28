const crypto = require('crypto');
const db = require('./db');

const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

function attemptKey(username, clientAddress) {
  const normalized = `${String(username || '').trim().toLowerCase()}:${String(clientAddress || 'unknown')}`;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

async function isLocked(key, database = db) {
  const result = await database.query('select locked_until from auth_login_attempts where attempt_key=$1', [key]);
  if (!result.rowCount || !result.rows[0].locked_until) return false;
  if (new Date(result.rows[0].locked_until).getTime() > Date.now()) return true;
  await database.query('delete from auth_login_attempts where attempt_key=$1', [key]);
  return false;
}

async function recordFailure(key, database = db) {
  return database.withTransaction(async (client) => {
    const found = await client.query('select failure_count, locked_until from auth_login_attempts where attempt_key=$1 for update', [key]);
    const current = found.rows[0];
    const expired = current?.locked_until && new Date(current.locked_until).getTime() <= Date.now();
    const failures = expired ? 1 : Number(current?.failure_count || 0) + 1;
    const lockedUntil = failures >= MAX_FAILURES ? new Date(Date.now() + LOCKOUT_MS) : null;
    await client.query(`insert into auth_login_attempts (attempt_key,failure_count,locked_until,updated_at)
      values ($1,$2,$3,now()) on conflict (attempt_key) do update
      set failure_count=excluded.failure_count,locked_until=excluded.locked_until,updated_at=now()`,
    [key, failures, lockedUntil]);
    return { failures, lockedUntil };
  });
}

function clearFailures(key, database = db) {
  return database.query('delete from auth_login_attempts where attempt_key=$1', [key]);
}

module.exports = { attemptKey, isLocked, recordFailure, clearFailures, _test: { LOCKOUT_MS, MAX_FAILURES } };
