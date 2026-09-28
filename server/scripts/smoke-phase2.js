require('dotenv').config();

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const db = require('../services/db');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  process.env.JWT_SECRET = crypto.randomBytes(48).toString('base64url');
  const suffix = crypto.randomUUID();
  const passwords = {
    secretary: `Secretary-${crypto.randomBytes(12).toString('hex')}`,
    other: `Other-${crypto.randomBytes(12).toString('hex')}`,
    reader: `Reader-${crypto.randomBytes(12).toString('hex')}`,
    forced: `Forced-${crypto.randomBytes(12).toString('hex')}`,
    changed: `Changed-${crypto.randomBytes(12).toString('hex')}`,
    superAdmin: `Super-${crypto.randomBytes(12).toString('hex')}`,
  };
  const emails = Object.fromEntries(Object.keys(passwords).filter((key) => key !== 'changed').map((key) => [key, `phase2-${key}-${suffix}@example.invalid`]));
  const createdUserIds = [];
  let createdSectorId = null;
  let server;
  try {
    const seedSector = await db.query("select id from sectors where slug='united-pakistan' and active=true");
    assert(seedSector.rowCount === 1, 'Seed sector is unavailable');
    const seedSectorId = Number(seedSector.rows[0].id);
    const otherSector = await db.query(
      'insert into sectors (name, slug) values ($1,$2) returning id',
      ['Phase 2 Isolation Test', `phase2-${suffix}`],
    );
    createdSectorId = Number(otherSector.rows[0].id);

    async function createUser(key, role, sectorId, mustChange = false) {
      const hash = await bcrypt.hash(passwords[key], 4);
      const result = await db.query(`
        insert into users (sector_id, email, password_hash, role, must_change_password)
        values ($1,$2,$3,$4,$5) returning id
      `, [sectorId, emails[key], hash, role, mustChange]);
      createdUserIds.push(Number(result.rows[0].id));
    }
    await createUser('secretary', 'secretary', seedSectorId);
    await createUser('other', 'secretary', createdSectorId);
    await createUser('reader', 'read_only', seedSectorId);
    await createUser('forced', 'secretary', seedSectorId, true);
    await createUser('superAdmin', 'super_admin', null);

    const app = require('../index');
    server = await new Promise((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    async function request(path, options = {}, expected = 200) {
      const response = await fetch(`${baseUrl}${path}`, options);
      const body = await response.json();
      assert(response.status === expected, `${path}: expected ${expected}, received ${response.status}: ${body.error || ''}`);
      return body;
    }
    async function login(key) {
      const result = await request('/api/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: emails[key], password: passwords[key] }),
      });
      assert(result.token, `${key} login did not return a token`);
      return result;
    }
    const authHeaders = (token, sectorId) => ({
      authorization: `Bearer ${token}`,
      ...(sectorId ? { 'x-sector-id': String(sectorId) } : {}),
    });

    const secretary = await login('secretary');
    assert(secretary.role === 'admin' && secretary.systemRole === 'secretary', 'Secretary login contract changed');
    const seedMonths = await request('/api/months', { headers: authHeaders(secretary.token) });
    assert(seedMonths.data.length === 3, 'Secretary cannot see seed-sector months');
    await request('/api/months', { headers: authHeaders(secretary.token, createdSectorId) }, 403);

    const other = await login('other');
    const otherMonths = await request('/api/months', { headers: authHeaders(other.token) });
    assert(otherMonths.data.length === 0, 'Empty sector received another sector’s data');

    const reader = await login('reader');
    assert(reader.role === 'reader' && reader.systemRole === 'read_only', 'Read-only login contract changed');
    await request('/api/months/new', {
      method: 'POST', headers: { ...authHeaders(reader.token), 'content-type': 'application/json' },
      body: JSON.stringify({ monthName: 'Forbidden 2099' }),
    }, 403);
    await request('/api/team/users', { headers: authHeaders(reader.token) }, 403);

    const teamList = await request('/api/team/users', { headers: authHeaders(secretary.token) });
    assert(teamList.data.some((user) => user.email === emails.reader), 'Secretary cannot list sector viewers');
    const managedEmail = `phase2-managed-${suffix}@example.invalid`;
    const managed = await request('/api/team/users', {
      method: 'POST',
      headers: { ...authHeaders(secretary.token), 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ email: managedEmail }),
    }, 201);
    assert(managed.data.oneTimePassword, 'Viewer creation did not return a one-time password');
    createdUserIds.push(Number(managed.data.id));
    const reset = await request(`/api/team/users/${managed.data.id}/reset`, {
      method: 'POST',
      headers: { ...authHeaders(secretary.token), 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: '{}',
    });
    assert(reset.data.oneTimePassword, 'Viewer reset did not return a one-time password');
    await request(`/api/team/users/${managed.data.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(secretary.token), 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ active: false }),
    });
    await request('/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: managedEmail, password: reset.data.oneTimePassword }),
    }, 401);

    const superAdmin = await login('superAdmin');
    assert(superAdmin.systemRole === 'super_admin' && superAdmin.sectorId === null, 'Super-admin login is invalid');
    await request('/api/months', { headers: authHeaders(superAdmin.token) }, 400);
    const superSeed = await request('/api/months', { headers: authHeaders(superAdmin.token, seedSectorId) });
    const superOther = await request('/api/months', { headers: authHeaders(superAdmin.token, createdSectorId) });
    assert(superSeed.data.length === 3 && superOther.data.length === 0, 'Super-admin explicit sector selection failed');
    const superTeam = await request('/api/team/users', { headers: authHeaders(superAdmin.token, seedSectorId) });
    assert(superTeam.data.some((user) => user.email === emails.reader), 'Super-admin cannot inspect explicit-sector viewers');

    const forced = await login('forced');
    assert(forced.mustChangePassword === true, 'Forced-password flag was not returned');
    const blocked = await request('/api/months', { headers: authHeaders(forced.token) }, 403);
    assert(blocked.code === 'PASSWORD_CHANGE_REQUIRED', 'Forced-password finance access was not blocked');
    const changed = await request('/api/auth/change-password', {
      method: 'POST', headers: { ...authHeaders(forced.token), 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: passwords.forced, newPassword: passwords.changed }),
    });
    assert(changed.mustChangePassword === false, 'Password-change flag was not cleared');
    await request('/api/months', { headers: authHeaders(changed.token) });

    console.log(JSON.stringify({
      secretaryLogin: true,
      superAdminLogin: true,
      crossSectorRejected: true,
      emptySectorIsolated: true,
      readOnlyWriteRejected: true,
      forcedPasswordChange: true,
      stableClientRoles: true,
      teamRoleMatrix: true,
    }, null, 2));
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (createdUserIds.length) await db.query('delete from users where id=any($1::bigint[])', [createdUserIds]);
    if (createdSectorId) await db.query('delete from sectors where id=$1', [createdSectorId]);
    await db.closePool();
  }
}

main().catch((error) => {
  console.error(`Phase 2 smoke test failed: ${error.message}`);
  process.exitCode = 1;
});
