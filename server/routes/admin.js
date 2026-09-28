const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../services/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateNewPassword } = require('../services/auth');

const router = express.Router();
const attempts = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

function rateLimit(req, res, next) {
  const key = String(req.user?.id || req.ip || 'unknown');
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    attempts.set(key, { startedAt: now, count: 1 });
    return next();
  }
  current.count += 1;
  if (current.count > MAX_REQUESTS) {
    return res.status(429).json({ success: false, error: 'Too many admin requests' });
  }
  return next();
}

function slugify(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function oneTimePassword() {
  return `${crypto.randomBytes(9).toString('base64url')}A9!`;
}

function audit(client, actor, sectorId, action, entityType, entityId, metadata = {}) {
  return client.query(`
    insert into audit_log (actor_user_id, sector_id, action, entity_type, entity_id, metadata)
    values ($1,$2,$3,$4,$5,$6)
  `, [actor.id, sectorId == null ? null : sectorId, action, entityType, entityId == null ? null : entityId, metadata]);
}

router.use(requireAuth, requireRole('super_admin'), rateLimit);

router.get('/status', async (_req, res) => {
  let database = 'ok';
  try { await db.query('select 1'); } catch (_) { database = 'error'; }
  res.json({
    success: database === 'ok',
    data: {
      database,
      aiFeaturesEnabled: String(process.env.AI_FEATURES_ENABLED || 'false').toLowerCase() === 'true',
      aiControlledActionsEnabled: String(process.env.AI_CONTROLLED_ACTIONS_ENABLED || 'false').toLowerCase() === 'true',
      deploymentConfigured: Boolean(process.env.DATABASE_URL && process.env.JWT_SECRET),
    },
  });
});

router.get('/overview', async (req, res) => {
  const result = await db.withSectorTransaction({
    sectorId: null,
    role: req.user.systemRole || req.user.role,
  }, (client) => client.query(`
    with member_counts as (select sector_id, count(*)::int members from members group by sector_id),
      secretary_counts as (select sector_id, count(*)::int secretaries from users where role='secretary' group by sector_id),
      month_counts as (select sector_id, count(*)::int months from months group by sector_id),
      payment_totals as (select sector_id, coalesce(sum(amount_paid),0)::numeric collected, coalesce(sum(total_payable),0)::numeric due from monthly_payments group by sector_id),
      expense_totals as (select sector_id, coalesce(sum(amount),0)::numeric expenses from expenses group by sector_id),
      sector_counts as (
        select s.id, s.name, s.slug, s.active,
          coalesce(mc.members,0)::int as members,
          coalesce(sc.secretaries,0)::int as secretaries,
          coalesce(moc.months,0)::int as months,
          coalesce(pt.collected,0)::numeric as collected,
          coalesce(pt.due,0)::numeric as due,
          coalesce(et.expenses,0)::numeric as expenses
        from sectors s
        left join member_counts mc on mc.sector_id=s.id
        left join secretary_counts sc on sc.sector_id=s.id
        left join month_counts moc on moc.sector_id=s.id
        left join payment_totals pt on pt.sector_id=s.id
        left join expense_totals et on et.sector_id=s.id
      )
    select coalesce(json_agg(sector_counts order by name),'[]'::json) as sectors,
      count(*)::int as total_sectors,
      count(*) filter (where active)::int as active_sectors,
      coalesce(sum(members),0)::int as total_members,
      coalesce(sum(collected),0)::numeric as total_collected,
      coalesce(sum(due),0)::numeric as total_due,
      coalesce(sum(expenses),0)::numeric as total_expenses
    from sector_counts
  `));
  res.json({ success: true, data: result.rows[0] });
});

router.get('/sectors/:id/summary', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid sector id' });
  const result = await db.withSectorTransaction({ sectorId: id, role: req.user.systemRole || req.user.role }, (client) => client.query(`
    select s.id, s.name, s.slug, s.active,
      (select count(*)::int from members where sector_id=s.id) as members,
      (select count(*)::int from users where sector_id=s.id and role='secretary') as secretaries,
      (select count(*)::int from users where sector_id=s.id and role='secretary' and must_change_password) as pending_secretary_passwords,
      (select count(*)::int from months where sector_id=s.id) as months,
      (select coalesce(sum(amount_paid),0)::numeric from monthly_payments where sector_id=s.id) as collected,
      (select coalesce(sum(total_payable),0)::numeric from monthly_payments where sector_id=s.id) as due,
      (select coalesce(sum(amount),0)::numeric from expenses where sector_id=s.id) as expenses,
      (select max(created_at) from audit_log where sector_id=s.id) as last_activity
    from sectors s where s.id=$1
  `, [id]));
  if (!result.rowCount) return res.status(404).json({ success: false, error: 'Sector not found' });
  res.json({ success: true, data: result.rows[0] });
});

router.get('/sectors/:id/users', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid sector id' });
  const result = await db.withSectorTransaction({ sectorId: id, role: req.user.systemRole || req.user.role }, (client) => client.query(`
    select id, email, role, must_change_password, created_at, last_login_at
    from users where sector_id=$1 order by email limit 500
  `, [id]));
  res.json({ success: true, data: result.rows });
});

router.get('/sectors', async (_req, res) => {
  const result = await db.query(`
    select s.id, s.name, s.slug, s.active, s.created_at,
      count(u.id) filter (where u.role='secretary')::int as secretary_count
    from sectors s left join users u on u.sector_id=s.id
    group by s.id order by s.name asc
  `);
  res.json({ success: true, data: result.rows });
});

router.post('/sectors', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const slug = slugify(req.body?.slug || name);
  if (!name || !slug) return res.status(400).json({ success: false, error: 'Sector name is required' });
  try {
    const row = await db.withTransaction(async (client) => {
      const inserted = await client.query(
        'insert into sectors (name, slug, created_by) values ($1,$2,$3) returning id, name, slug, active, created_at',
        [name, slug, req.user.id],
      );
      const sector = inserted.rows[0];
      await audit(client, req.user, sector.id, 'sector_created', 'sector', sector.id, { slug: sector.slug });
      return sector;
    });
    res.status(201).json({ success: true, data: row });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, error: 'Sector slug already exists' });
    throw error;
  }
});

router.patch('/sectors/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1 || typeof req.body?.active !== 'boolean') {
    return res.status(400).json({ success: false, error: 'A valid id and boolean active value are required' });
  }
  const row = await db.withTransaction(async (client) => {
    const updated = await client.query(
      'update sectors set active=$1 where id=$2 returning id, name, slug, active, created_at',
      [req.body.active, id],
    );
    if (!updated.rowCount) return null;
    const sector = updated.rows[0];
    await audit(client, req.user, id, req.body.active ? 'sector_activated' : 'sector_deactivated', 'sector', id, { active: req.body.active });
    return sector;
  });
  if (!row) return res.status(404).json({ success: false, error: 'Sector not found' });
  res.json({ success: true, data: row });
});

async function provisionSecretary(req, res, resetOnly) {
  const sectorId = Number(req.params.id);
  if (!Number.isInteger(sectorId) || sectorId < 1) return res.status(400).json({ success: false, error: 'Invalid sector id' });
  const email = String(req.body?.email || '').trim();
  if (!resetOnly && !email) return res.status(400).json({ success: false, error: 'Secretary email is required' });
  try {
    const result = await db.withTransaction(async (client) => {
      const sector = await client.query('select id, active from sectors where id=$1 for update', [sectorId]);
      if (!sector.rowCount) throw Object.assign(new Error('Sector not found'), { code: 'NOT_FOUND' });
      if (!sector.rows[0].active) throw Object.assign(new Error('Sector is inactive'), { code: 'INACTIVE' });
      let user;
      if (resetOnly) {
        const found = await client.query("select id, email from users where sector_id=$1 and role='secretary' order by id limit 1 for update", [sectorId]);
        if (!found.rowCount) throw Object.assign(new Error('Secretary not found'), { code: 'NOT_FOUND' });
        user = found.rows[0];
      } else {
        const found = await client.query('select id from users where lower(btrim(email))=lower(btrim($1))', [email]);
        if (found.rowCount) throw Object.assign(new Error('Email already exists'), { code: 'CONFLICT' });
        const inserted = await client.query(`insert into users (sector_id,email,password_hash,role,must_change_password,created_by)
          values ($1,$2,$3,'secretary',true,$4) returning id,email`, [sectorId, email, 'temporary', req.user.id]);
        user = inserted.rows[0];
      }
      const password = oneTimePassword();
      validateNewPassword(password);
      const hash = await bcrypt.hash(password, 12);
      await client.query('update users set password_hash=$1, must_change_password=true where id=$2', [hash, user.id]);
      await audit(client, req.user, sectorId, resetOnly ? 'secretary_password_reset' : 'secretary_created', 'user', user.id, { role: 'secretary', email: user.email });
      return { userId: user.id, email: user.email, oneTimePassword: password };
    });
    res.status(resetOnly ? 200 : 201).json({ success: true, data: result });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ success: false, error: error.message });
    if (error.code === 'INACTIVE') return res.status(409).json({ success: false, error: error.message });
    if (error.code === 'CONFLICT' || error.code === '23505') return res.status(409).json({ success: false, error: error.message || 'Email already exists' });
    throw error;
  }
}

router.post('/sectors/:id/secretary', (req, res) => provisionSecretary(req, res, false));
router.post('/sectors/:id/secretary/reset', (req, res) => provisionSecretary(req, res, true));

router.get('/audit-log', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;
  const sectorId = Number(req.query.sectorId);
  const action = String(req.query.action || '').trim();
  const filters = []; const params = [];
  if (Number.isInteger(sectorId) && sectorId > 0) { params.push(sectorId); filters.push(`a.sector_id=$${params.length}`); }
  if (action) { params.push(action.slice(0, 100)); filters.push(`a.action=$${params.length}`); }
  params.push(limit, offset);
  const where = filters.length ? `where ${filters.join(' and ')}` : '';
  const result = await db.query(`
    select a.id, a.actor_user_id, a.sector_id, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at,
      u.email as actor_email
    from audit_log a left join users u on u.id=a.actor_user_id
    ${where} order by a.created_at desc limit $${params.length - 1} offset $${params.length}
  `, params);
  res.json({ success: true, data: result.rows, page, limit, filters: { sectorId: Number.isInteger(sectorId) && sectorId > 0 ? sectorId : null, action: action || null } });
});

module.exports = router;
