const express = require('express');
const db = require('../services/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const idempotency = require('../middleware/idempotency');

const router = express.Router();
const attempts = new Map();
function allowed(key) {
  const now = Date.now(); const prior = attempts.get(key) || [];
  const recent = prior.filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= 5) return false;
  recent.push(now); attempts.set(key, recent); return true;
}

router.post('/requests', async (req, res) => {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  if (!allowed(ip)) return res.status(429).json({ success: false, error: 'Too many requests; try again later.' });
  if (String(req.body?.website || '').trim()) return res.status(400).json({ success: false, error: 'Request rejected' });
  const sectorName = String(req.body?.sectorName || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const notes = String(req.body?.notes || '').trim().slice(0, 1000);
  if (!sectorName || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ success: false, error: 'Sector name and valid email are required' });
  const result = await db.query('insert into sector_onboarding_requests (sector_name, requester_email, notes) values ($1,$2,$3) returning id,status,created_at', [sectorName, email, notes]);
  res.status(201).json({ success: true, data: result.rows[0] });
});

router.use(requireAuth, requireRole('super_admin'));
router.get('/requests', async (req, res) => {
  const result = await db.query(`select r.id,r.sector_name,r.requester_email,r.notes,r.status,r.created_at,r.reviewed_at,u.email as reviewer_email from sector_onboarding_requests r left join users u on u.id=r.reviewed_by where ($1='all' or r.status=$1) order by r.created_at desc limit 200`, [String(req.query.status || 'pending')]);
  res.json({ success: true, data: result.rows });
});
router.post('/requests/:id/approve', idempotency(), async (req, res) => {
  const id = Number(req.params.id); if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid request id' });
  let result;
  try { result = await db.withTransaction(async (client) => {
    const request = await client.query("select * from sector_onboarding_requests where id=$1 and status='pending' for update", [id]);
    if (!request.rowCount) return null;
    const source = request.rows[0]; const slug = String(req.body?.slug || source.sector_name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || `sector-${id}`;
    const sector = await client.query('insert into sectors (name,slug,created_by) values ($1,$2,$3) returning id,name,slug,active', [source.sector_name, slug, req.user.id]);
    await client.query('update sector_onboarding_requests set status=\'approved\',reviewed_by=$1,reviewed_at=now() where id=$2', [req.user.id, id]);
    await client.query(`insert into audit_log (actor_user_id,sector_id,action,entity_type,entity_id,metadata) values ($1,$2,'sector_onboarding_approved','sector',$3,$4)`, [req.user.id, sector.rows[0].id, sector.rows[0].id, { requestId: id, requesterEmail: source.requester_email }]);
    return sector.rows[0];
  }); } catch (error) { if (error.code === '23505') return res.status(409).json({ success: false, error: 'A sector with this slug already exists' }); throw error; }
  if (!result) return res.status(404).json({ success: false, error: 'Pending request not found' });
  res.status(201).json({ success: true, data: result });
});
router.post('/requests/:id/reject', idempotency(), async (req, res) => {
  const id = Number(req.params.id); if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid request id' });
  const result = await db.withTransaction(async (client) => {
    const updated = await client.query("update sector_onboarding_requests set status='rejected',reviewed_by=$1,reviewed_at=now() where id=$2 and status='pending' returning id,status,sector_name", [req.user.id, id]);
    if (!updated.rowCount) return null;
    await client.query(`insert into audit_log (actor_user_id,action,entity_type,entity_id,metadata) values ($1,'sector_onboarding_rejected','sector_onboarding_request',$2,$3)`, [req.user.id, id, { sectorName: updated.rows[0].sector_name }]);
    return updated.rows[0];
  });
  if (!result) return res.status(404).json({ success: false, error: 'Pending request not found' });
  res.json({ success: true, data: result });
});
module.exports = router;
