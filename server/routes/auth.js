const express = require('express');
const auth = require('../services/auth');
const { bearerToken, requireAuthAllowPasswordChange } = require('../middleware/auth');

const router = express.Router();

function sessionPayload(user) {
  return {
    success: true,
    token: auth.signToken(user),
    role: auth.clientRole(user.role),
    systemRole: user.role,
    username: user.email,
    sectorId: user.sector_id == null ? null : Number(user.sector_id),
    mustChangePassword: Boolean(user.must_change_password),
  };
}

router.post('/login', async (req, res) => {
  try {
    const user = await auth.authenticate(req.body?.username, req.body?.password);
    res.json(sessionPayload(user));
  } catch (error) {
    const forbidden = error.code === 'SECTOR_INACTIVE';
    res.status(forbidden ? 403 : 401).json({
      success: false,
      error: forbidden ? error.message : 'Invalid credentials',
    });
  }
});

router.post('/logout', (_req, res) => {
  res.json({ success: true });
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
    res.json(sessionPayload(user));
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
module.exports._test = { sessionPayload };
