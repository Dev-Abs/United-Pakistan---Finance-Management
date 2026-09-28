const db = require('../services/db');

function idempotency(options = {}) {
  const required = options.required !== false;
  return async (req, res, next) => {
    const key = String(req.get('Idempotency-Key') || '').trim();
    if (!key && required) return res.status(400).json({ success: false, error: 'Idempotency-Key is required for writes' });
    if (!key) return next();
    if (key.length > 200) return res.status(400).json({ success: false, error: 'Idempotency-Key is too long' });
    const result = await db.query(`insert into idempotency_keys (actor_user_id,sector_id,route,key)
      values ($1,$2,$3,$4) on conflict (actor_user_id,sector_id,route,key) do nothing returning id`,
    [req.user.id, req.sectorId ?? null, req.originalUrl.split('?')[0], key]);
    if (!result.rowCount) return res.status(409).json({ success: false, error: 'This request has already been accepted' });
    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      if (res.statusCode >= 400) {
        db.query('delete from idempotency_keys where id=$1', [result.rows[0].id]).catch(() => {});
      } else {
        db.query(`insert into audit_log (actor_user_id,sector_id,action,entity_type,metadata)
          values ($1,$2,'mutation_accepted','http_request',$3)`, [req.user.id, req.sectorId ?? null, { route: req.originalUrl.split('?')[0], method: req.method, idempotencyKey: key }]).catch(() => {});
      }
      return originalJson(payload);
    };
    return next();
  };
}

module.exports = idempotency;
