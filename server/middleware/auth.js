const auth = require('../services/auth');
const db = require('../services/db');

function bearerToken(req) {
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function attachAuthenticatedUser(req) {
  const token = bearerToken(req);
  if (!token) throw Object.assign(new Error('Unauthorized'), { code: 'UNAUTHORIZED' });
  const user = await auth.userFromToken(token);
  req.user = auth.publicUser(user);
  req.user.password_hash = user.password_hash;
  req.userRole = auth.clientRole(user.role);
  return req.user;
}

function authError(res, error) {
  const inactive = error.code === 'SECTOR_INACTIVE';
  return res.status(inactive ? 403 : 401).json({ success: false, error: error.message || 'Unauthorized' });
}

async function requireAuthAllowPasswordChange(req, res, next) {
  try {
    await attachAuthenticatedUser(req);
    next();
  } catch (error) {
    authError(res, error);
  }
}

async function requireAuth(req, res, next) {
  try {
    await attachAuthenticatedUser(req);
    if (req.user.must_change_password) {
      return res.status(403).json({
        success: false,
        code: 'PASSWORD_CHANGE_REQUIRED',
        error: 'Password change is required before accessing finance data.',
      });
    }
    next();
  } catch (error) {
    authError(res, error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    next();
  };
}

function requireWriteAccess(req, res, next) {
  if (req.user?.role === 'read_only') {
    return res.status(403).json({ success: false, error: 'Read-only access. You do not have permission to modify data.' });
  }
  next();
}

function suppliedSectorId(req) {
  const values = [
    req.headers['x-sector-id'],
    req.query?.sectorId,
    req.query?.sector_id,
    req.body?.sectorId,
    req.body?.sector_id,
  ].filter((value) => value !== undefined && value !== null && String(value).trim() !== '');
  if (!values.length) return null;
  const distinct = [...new Set(values.map((value) => String(value).trim()))];
  if (distinct.length !== 1) throw Object.assign(new Error('Conflicting sector context'), { code: 'INVALID_SECTOR' });
  const parsed = Number(distinct[0]);
  if (!Number.isInteger(parsed) || parsed <= 0) throw Object.assign(new Error('Invalid sector context'), { code: 'INVALID_SECTOR' });
  return parsed;
}

async function scopeToSector(req, res, next) {
  try {
    const supplied = suppliedSectorId(req);
    if (req.user.role === 'super_admin') {
      if (!supplied) return res.status(400).json({ success: false, code: 'SECTOR_CONTEXT_REQUIRED', error: 'Select a sector before opening finance data.' });
      const sector = await db.query('select id from sectors where id=$1 and active=true', [supplied]);
      if (!sector.rowCount) return res.status(404).json({ success: false, code: 'SECTOR_CONTEXT_INVALID', error: 'That sector is no longer available. Select another sector.' });
      req.sectorId = supplied;
      return next();
    }
    if (supplied && supplied !== req.user.sector_id) {
      return res.status(403).json({ success: false, error: 'Cross-sector access is forbidden' });
    }
    req.sectorId = req.user.sector_id;
    return next();
  } catch (error) {
    return res.status(400).json({ success: false, code: 'SECTOR_CONTEXT_INVALID', error: error.message || 'Select a valid sector and try again.' });
  }
}

module.exports = {
  bearerToken,
  requireAuth,
  requireAuthAllowPasswordChange,
  requireRole,
  requireWriteAccess,
  scopeToSector,
  _test: { attachAuthenticatedUser, suppliedSectorId },
};
