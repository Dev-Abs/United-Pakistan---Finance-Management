const express = require('express');
const auth = require('../services/auth');
const lockout = require('../services/login-lockout');
const { bearerToken, requireAuthAllowPasswordChange } = require('../middleware/auth');

const router = express.Router();

function loginKey(req) {
  return lockout.attemptKey(req.body?.username, req.ip);
}

async function sessionPayload(user) {
  return {
    success: true,
    token: auth.signToken(user),
    role: auth.clientRole(user.role),
    systemRole: user.role,
    username: user.email,
    sectorId: user.sector_id == null ? null : Number(user.sector_id),
    mustChangePassword: Boolean(user.must_change_password),
    refreshToken: await auth.issueRefreshToken(user),
  };
}

router.post('/login', async (req, res) => {
  const key = loginKey(req);
  if (await lockout.isLocked(key)) return res.status(429).json({ success: false, error: 'Too many failed attempts. Try again later.' });
  try {
    const user = await auth.authenticate(req.body?.username, req.body?.password);
    await lockout.clearFailures(key);
    res.json(await sessionPayload(user));
  } catch (error) {
    if (error.code === 'INVALID_CREDENTIALS' || error.code === 'UNAUTHORIZED') await lockout.recordFailure(key);
    const forbidden = error.code === 'SECTOR_INACTIVE';
    res.status(forbidden ? 403 : 401).json({
      success: false,
      error: forbidden ? error.message : 'Invalid credentials',
    });
  }
});

router.post('/logout', async (req, res) => {
  await auth.revokeRefreshToken(req.body?.refreshToken);
  res.json({ success: true });
});

router.post('/refresh', async (req, res) => {
  try {
    const rotated = await auth.rotateRefreshToken(req.body?.refreshToken);
    res.json(await sessionPayload(rotated.user));
  } catch (_error) {
    res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
});

router.get('/status', async (req, res) => {
  const token = bearerToken(req);
  if (!token) return res.json({ success: true, authenticated: false });
  try {
    const user = await auth.userFromToken(token);
    return res.json({
      success: true,
      authenticated: true,
      role: auth.clientRole(user.role),
      systemRole: user.role,
      username: user.email,
      sectorId: user.sector_id == null ? null : Number(user.sector_id),
      mustChangePassword: Boolean(user.must_change_password),
    });
  } catch (_error) {
    return res.json({ success: true, authenticated: false });
  }
});

router.post('/change-password', requireAuthAllowPasswordChange, async (req, res) => {
  try {
    const user = await auth.changePassword(req.user, req.body?.currentPassword, req.body?.newPassword);
    res.json(await sessionPayload(user));
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
module.exports._test = { sessionPayload, loginKey };
