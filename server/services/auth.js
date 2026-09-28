const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const PASSWORD_MIN_LENGTH = 12;
const JWT_EXPIRES_IN = '30m';
const REFRESH_DAYS = 14;

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters');
  return secret;
}

function clientRole(role) {
  return role === 'read_only' ? 'reader' : 'admin';
}

function publicUser(user) {
  return {
    id: Number(user.id),
    email: user.email,
    role: user.role,
    sector_id: user.sector_id == null ? null : Number(user.sector_id),
    must_change_password: Boolean(user.must_change_password),
  };
}

function signToken(user) {
  const safe = publicUser(user);
  return jwt.sign({
    role: safe.role,
    sector_id: safe.sector_id,
    session_version: Number(user.session_version || 0),
  }, jwtSecret(), {
    subject: String(safe.id),
    expiresIn: JWT_EXPIRES_IN,
    algorithm: 'HS256',
  });
}

function verifyToken(token) {
  return jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] });
}

async function findUserByEmail(email, database = db) {
  const result = await database.query(`
    select u.id, u.sector_id, u.email, u.password_hash, u.role,
      u.must_change_password, u.active, u.session_version, s.active as sector_active
    from users u
    left join sectors s on s.id=u.sector_id
    where lower(btrim(u.email))=lower(btrim($1))
    limit 1
  `, [String(email || '').trim()]);
  return result.rows[0] || null;
}

async function findUserById(id, database = db) {
  const result = await database.query(`
    select u.id, u.sector_id, u.email, u.password_hash, u.role,
      u.must_change_password, u.active, u.session_version, s.active as sector_active
    from users u
    left join sectors s on s.id=u.sector_id
    where u.id=$1
    limit 1
  `, [id]);
  return result.rows[0] || null;
}

function assertUserActive(user) {
  if (!user) throw Object.assign(new Error('Unauthorized'), { code: 'UNAUTHORIZED' });
  if (user.active === false) throw Object.assign(new Error('User is inactive'), { code: 'UNAUTHORIZED' });
  if (user.role !== 'super_admin' && user.sector_active !== true) {
    throw Object.assign(new Error('Sector is inactive'), { code: 'SECTOR_INACTIVE' });
  }
}

async function authenticate(email, password, database = db) {
  const user = await findUserByEmail(email, database);
  assertUserActive(user);
  if (!password || !(await bcrypt.compare(String(password), user.password_hash))) {
    throw Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS' });
  }
  await database.query('update users set last_login_at=now() where id=$1', [user.id]);
  return user;
}

async function userFromToken(token, database = db) {
  let claims;
  try {
    claims = verifyToken(token);
  } catch (_error) {
    throw Object.assign(new Error('Unauthorized'), { code: 'UNAUTHORIZED' });
  }
  const user = await findUserById(claims.sub, database);
  assertUserActive(user);
  if (claims.role !== user.role || (claims.sector_id ?? null) !== (user.sector_id == null ? null : Number(user.sector_id))) {
    throw Object.assign(new Error('Session is no longer valid'), { code: 'UNAUTHORIZED' });
  }
  if (Number(claims.session_version || 0) !== Number(user.session_version || 0)) {
    throw Object.assign(new Error('Session is no longer valid'), { code: 'UNAUTHORIZED' });
  }
  return user;
}

function validateNewPassword(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    throw Object.assign(new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`), { code: 'WEAK_PASSWORD' });
  }
}

async function changePassword(user, currentPassword, newPassword, database = db) {
  validateNewPassword(newPassword);
  if (!(await bcrypt.compare(String(currentPassword || ''), user.password_hash))) {
    throw Object.assign(new Error('Current password is incorrect'), { code: 'INVALID_CREDENTIALS' });
  }
  if (await bcrypt.compare(newPassword, user.password_hash)) {
    throw Object.assign(new Error('New password must be different'), { code: 'WEAK_PASSWORD' });
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const result = await database.query(`
    update users set password_hash=$1, must_change_password=false
    where id=$2
    returning id, sector_id, email, role, must_change_password
  `, [passwordHash, user.id]);
  return result.rows[0];
}

function refreshHash(token) { return require('crypto').createHash('sha256').update(token).digest('hex'); }

async function issueRefreshToken(user, database = db) {
  const raw = require('crypto').randomBytes(48).toString('base64url');
  const expires = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  await database.query('insert into refresh_tokens (user_id,token_hash,session_version,expires_at) values ($1,$2,$3,$4)', [user.id, refreshHash(raw), Number(user.session_version || 0), expires]);
  return raw;
}

async function rotateRefreshToken(raw, database = db) {
  if (!raw) throw Object.assign(new Error('Refresh token is required'), { code: 'UNAUTHORIZED' });
  return database.withTransaction(async (client) => {
    const found = await client.query(`select rt.id as refresh_id, rt.user_id, rt.session_version, rt.expires_at,
      u.id as user_id, u.sector_id, u.email, u.role, u.must_change_password, u.active, u.session_version as current_session_version,
      s.active as sector_active
      from refresh_tokens rt join users u on u.id=rt.user_id left join sectors s on s.id=u.sector_id
      where rt.token_hash=$1 and rt.revoked_at is null for update of rt`, [refreshHash(raw)]);
    const user = found.rows[0];
    if (!user || user.expires_at <= new Date() || user.active === false || user.session_version !== user.current_session_version || user.sector_active === false) throw Object.assign(new Error('Invalid refresh token'), { code: 'UNAUTHORIZED' });
    await client.query('update refresh_tokens set revoked_at=now() where id=$1', [user.refresh_id]);
    const next = require('crypto').randomBytes(48).toString('base64url');
    const expires = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
    await client.query('insert into refresh_tokens (user_id,token_hash,session_version,expires_at) values ($1,$2,$3,$4)', [user.user_id, refreshHash(next), user.current_session_version, expires]);
    user.id = user.user_id;
    return { user, refreshToken: next };
  });
}

async function revokeRefreshToken(raw, database = db) {
  if (!raw) return false;
  const result = await database.query(
    'update refresh_tokens set revoked_at=coalesce(revoked_at,now()) where token_hash=$1 returning id',
    [refreshHash(String(raw))],
  );
  return result.rowCount > 0;
}

module.exports = {
  authenticate,
  changePassword,
  clientRole,
  findUserByEmail,
  findUserById,
  publicUser,
  signToken,
  userFromToken,
  validateNewPassword,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  _test: { assertUserActive, jwtSecret, verifyToken },
};
