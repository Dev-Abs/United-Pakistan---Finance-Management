const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../services/db');
const { requireAuth, requireRole, scopeToSector } = require('../middleware/auth');
const { validateNewPassword } = require('../services/auth');
const idempotency = require('../middleware/idempotency');

const router = express.Router();
function temporaryPassword() { return `${crypto.randomBytes(9).toString('base64url')}A9!`; }

router.use(requireAuth, scopeToSector, requireRole('secretary', 'super_admin'));

router.get('/users', async (req, res) => {
  const result = await db.query(`select id, email, role, active, must_change_password, created_at, last_login_at
    from users where sector_id=$1 and role='read_only' order by email`, [req.sectorId]);
  res.json({ success: true, data: result.rows });
});

router.post('/users', idempotency(), async (req, res) => {
  const email = String(req.body?.email || '').trim();
  if (!email) return res.status(400).json({ success: false, error: 'Email is required' });
  const password = temporaryPassword();
  validateNewPassword(password);
  try {
      const result = await db.withSectorTransaction({ sectorId: req.sectorId, role: req.user.systemRole || req.user.role }, async (client) => {
      const hash = await bcrypt.hash(password, 12);
      const inserted = await client.query(`insert into users (sector_id,email,password_hash,role,must_change_password,created_by)
        values ($1,$2,$3,'read_only',true,$4) returning id,email,role,active,must_change_password`,
      [req.sectorId, email, hash, req.user.id]);
      const user = inserted.rows[0];
      await client.query(`insert into audit_log (actor_user_id,sector_id,action,entity_type,entity_id,metadata)
        values ($1,$2,'read_only_user_created','user',$3,$4)`, [req.user.id, req.sectorId, user.id, { email: user.email, role: 'read_only' }]);
      return { ...user, oneTimePassword: password };
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, error: 'Email already exists' });
    throw error;
  }
});

router.post('/users/:id/reset', idempotency(), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid user id' });
  const password = temporaryPassword();
  const hash = await bcrypt.hash(password, 12);
  const result = await db.withSectorTransaction({ sectorId: req.sectorId, role: req.user.systemRole || req.user.role }, async (client) => {
    const updated = await client.query(`update users set password_hash=$1,must_change_password=true,session_version=session_version+1
      where id=$2 and sector_id=$3 and role='read_only' returning id,email,role,active,must_change_password`, [hash, id, req.sectorId]);
    if (!updated.rowCount) return null;
    await client.query(`insert into audit_log (actor_user_id,sector_id,action,entity_type,entity_id,metadata)
      values ($1,$2,'read_only_password_reset','user',$3,$4)`, [req.user.id, req.sectorId, id, { role: 'read_only' }]);
    return { ...updated.rows[0], oneTimePassword: password };
  });
  if (!result) return res.status(404).json({ success: false, error: 'Read-only user not found' });
  res.json({ success: true, data: result });
});

router.patch('/users/:id', idempotency(), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1 || typeof req.body?.active !== 'boolean') return res.status(400).json({ success: false, error: 'Valid id and active value are required' });
  const result = await db.withSectorTransaction({ sectorId: req.sectorId, role: req.user.systemRole || req.user.role }, async (client) => {
    const updated = await client.query(`update users set active=$1,session_version=session_version+1
      where id=$2 and sector_id=$3 and role='read_only' returning id,email,role,active,must_change_password`, [req.body.active, id, req.sectorId]);
    if (!updated.rowCount) return null;
    await client.query(`insert into audit_log (actor_user_id,sector_id,action,entity_type,entity_id,metadata)
      values ($1,$2,$3,'user',$4,$5)`, [req.user.id, req.sectorId, req.body.active ? 'read_only_user_activated' : 'read_only_user_deactivated', id, { role: 'read_only', active: req.body.active }]);
    return updated.rows[0];
  });
  if (!result) return res.status(404).json({ success: false, error: 'Read-only user not found' });
  res.json({ success: true, data: result });
});

module.exports = router;
