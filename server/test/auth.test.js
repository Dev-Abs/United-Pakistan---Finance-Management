const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const fs = require('node:fs');
const path = require('node:path');

const auth = require('../services/auth');
const loginLockout = require('../services/login-lockout');
const middleware = require('../middleware/auth');
const db = require('../services/db');
const { insertUserIfMissing } = require('../scripts/seed-auth-users');

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function withJwtSecret(task) {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'phase-two-test-secret-that-is-long-enough-1234';
  return Promise.resolve(task()).finally(() => {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  });
}

test('JWT carries authoritative role and sector claims while client role remains compatible', async () => {
  await withJwtSecret(() => {
    const token = auth.signToken({ id: 4, email: 'secretary@example.test', role: 'secretary', sector_id: 9, must_change_password: false });
    const claims = auth._test.verifyToken(token);
    assert.equal(claims.sub, '4');
    assert.equal(claims.role, 'secretary');
    assert.equal(claims.sector_id, 9);
    assert.equal(auth.clientRole('secretary'), 'admin');
    assert.equal(auth.clientRole('super_admin'), 'admin');
    assert.equal(auth.clientRole('read_only'), 'reader');
  });
});

test('database authentication validates a bcrypt hash and never compares plaintext in SQL', async () => {
  const hash = await bcrypt.hash('correct horse battery', 4);
  const calls = [];
  const database = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (/from users u/i.test(sql)) return { rowCount: 1, rows: [{ id: 7, sector_id: 3, email: 'user@test', password_hash: hash, role: 'secretary', must_change_password: false, sector_active: true }] };
      if (/update users set last_login_at/i.test(sql)) return { rowCount: 1, rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const user = await auth.authenticate('user@test', 'correct horse battery', database);
  assert.equal(user.id, 7);
  assert.equal(calls[0].params.length, 1);
  assert.equal(calls[0].params[0], 'user@test');
  assert.equal(calls.some((call) => call.params.includes('correct horse battery')), false);
  await assert.rejects(auth.authenticate('user@test', 'wrong password', database), /Invalid credentials/);
});

test('forged sector input is rejected for a secretary', async () => {
  const req = { user: { role: 'secretary', sector_id: 1 }, headers: {}, query: { sector_id: '2' }, body: {} };
  const res = responseRecorder();
  let nextCalled = false;
  await middleware.scopeToSector(req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
  assert.match(res.body.error, /Cross-sector/);
});

test('sector user cannot create conflicting contexts through multiple request fields', async () => {
  const req = { user: { role: 'secretary', sector_id: 1 }, headers: { 'x-sector-id': '1' }, query: { sectorId: '2' }, body: {} };
  const res = responseRecorder();
  await middleware.scopeToSector(req, res, () => assert.fail('next must not run'));
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Conflicting/);
});

test('super admin must explicitly select one active sector', async () => {
  const missing = { user: { role: 'super_admin', sector_id: null }, headers: {}, query: {}, body: {} };
  const missingRes = responseRecorder();
  await middleware.scopeToSector(missing, missingRes, () => assert.fail('next must not run'));
  assert.equal(missingRes.statusCode, 400);

  const originalQuery = db.query;
  db.query = async (_sql, params) => ({ rowCount: params[0] === 5 ? 1 : 0, rows: [{ id: 5 }] });
  try {
    const req = { user: { role: 'super_admin', sector_id: null }, headers: { 'x-sector-id': '5' }, query: {}, body: {} };
    const res = responseRecorder();
    let nextCalled = false;
    await middleware.scopeToSector(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.sectorId, 5);
  } finally {
    db.query = originalQuery;
  }
});

test('read-only role cannot pass write middleware', () => {
  const res = responseRecorder();
  let nextCalled = false;
  middleware.requireWriteAccess({ user: { role: 'read_only' } }, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('forced-password users are blocked from finance middleware', async () => {
  const original = auth.userFromToken;
  auth.userFromToken = async () => ({ id: 1, email: 'forced@test', role: 'secretary', sector_id: 2, must_change_password: true, password_hash: 'hash' });
  try {
    const req = { headers: { authorization: 'Bearer test-token' } };
    const res = responseRecorder();
    let nextCalled = false;
    await middleware.requireAuth(req, res, () => { nextCalled = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'PASSWORD_CHANGE_REQUIRED');
    assert.equal(nextCalled, false);
  } finally {
    auth.userFromToken = original;
  }
});

test('every live finance route applies authenticated sector scoping', () => {
  const directory = path.join(__dirname, '../routes');
  const routes = ['ai.js', 'diagnostics.js', 'expenses.js', 'export.js', 'followups.js',
    'members.js', 'months.js', 'payments.js', 'settings.js', 'special-fund.js'];
  routes.forEach((file) => {
    const source = fs.readFileSync(path.join(directory, file), 'utf8');
    assert.match(source, /router\.use\(requireAuth, scopeToSector\)/, `${file} must require sector scope`);
  });
});

test('platform admin endpoints are super-admin guarded and SQL aggregated', () => {
  const source = fs.readFileSync(require.resolve('../routes/admin'), 'utf8');
  assert.match(source, /router\.use\(requireAuth, requireRole\('super_admin'\), rateLimit\)/);
  assert.match(source, /router\.get\('\/overview'/);
  assert.match(source, /router\.get\('\/sectors\/:id\/summary'/);
  assert.match(source, /router\.get\('\/sectors\/:id\/users'/);
  assert.match(source, /with member_counts as/);
  assert.match(source, /withSectorTransaction\(\{[\s\S]*?sectorId: null,[\s\S]*?role: req\.user\.systemRole \|\| req\.user\.role/);
});

test('login lockout uses a durable privacy-preserving username and client key', () => {
  const authRoute = require('../routes/auth')._test;
  const req = { body: { username: 'Person@Example.test' }, ip: '127.0.0.1' };
  const key = authRoute.loginKey(req);
  assert.equal(key, loginLockout.attemptKey('person@example.test', '127.0.0.1'));
  assert.notEqual(key, loginLockout.attemptKey('person@example.test', '127.0.0.2'));
  assert.doesNotMatch(key, /person|example|127/);
  const source = fs.readFileSync(require.resolve('../services/login-lockout'), 'utf8');
  assert.match(source, /auth_login_attempts/);
  assert.match(source, /for update/i);
  assert.equal(loginLockout._test.MAX_FAILURES, 5);
  assert.equal(loginLockout._test.LOCKOUT_MS, 15 * 60 * 1000);
});

test('logout revokes the presented refresh token without storing the raw token', async () => {
  let statement;
  const database = {
    async query(sql, params) {
      statement = { sql, params };
      return { rowCount: 1, rows: [{ id: 9 }] };
    },
  };
  assert.equal(await auth.revokeRefreshToken('one-time-refresh-token', database), true);
  assert.match(statement.sql, /update refresh_tokens set revoked_at/i);
  assert.notEqual(statement.params[0], 'one-time-refresh-token');
  assert.equal(statement.params[0].length, 64);
  assert.equal(await auth.revokeRefreshToken('', database), false);
});

test('finance mutations expose durable idempotency protection', () => {
  const middleware = fs.readFileSync(require.resolve('../middleware/idempotency'), 'utf8');
  const payments = fs.readFileSync(require.resolve('../routes/payments'), 'utf8');
  const expenses = fs.readFileSync(require.resolve('../routes/expenses'), 'utf8');
  assert.match(middleware, /idempotency_keys/);
  assert.match(middleware, /This request has already been accepted/);
  assert.match(middleware, /mutation_accepted/);
  assert.match(payments, /idempotency\(\)/);
  assert.match(expenses, /idempotency\(\)/);
});

test('example environment contains placeholders only for authentication secrets', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../.env.example'), 'utf8');
  assert.match(source, /^JWT_SECRET=replace-with-/m);
  assert.match(source, /^SUPER_ADMIN_PASSWORD=replace-with-/m);
  assert.match(source, /^SEED_SECRETARY_PASSWORD=replace-with-/m);
  assert.doesNotMatch(source, /^ADMIN_PASSWORD=/m);
  assert.doesNotMatch(source, /^SESSION_SECRET=/m);
});

test('auth seed stores only a bcrypt hash and is idempotent for a compatible user', async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (/select id, sector_id, role from users/i.test(sql)) return { rowCount: 0, rows: [] };
      if (/insert into users/i.test(sql)) return { rowCount: 1, rows: [{ id: 41 }] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const result = await insertUserIfMissing(client, {
    email: 'new@test', password: 'fresh-password-value', role: 'secretary', sectorId: 2, createdBy: 1,
  });
  assert.equal(result.inserted, true);
  const insert = calls.find((call) => /insert into users/i.test(call.sql));
  assert.notEqual(insert.params[2], 'fresh-password-value');
  assert.equal(await bcrypt.compare('fresh-password-value', insert.params[2]), true);
});
