const express = require('express');
const db = require('../services/db');
const { requireAuth, scopeToSector } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, scopeToSector);

router.get('/', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const result = await db.withSectorTransaction({ sectorId: req.sectorId, role: req.user.systemRole || req.user.role }, (client) => client.query(`
    with current_month as (
      select id, name from months where sector_id=$1 order by created_at desc limit 1
    ), overdue as (
      select mp.id, m.name, mp.remaining_balance, mp.month_id
      from monthly_payments mp join members m on m.id=mp.member_id join current_month cm on cm.id=mp.month_id
      where mp.sector_id=$1 and mp.remaining_balance > 0
      order by mp.remaining_balance desc limit 25
    ), followups as (
      select f.id, f.member_name, f.next_reminder_date
      from follow_ups f where f.sector_id=$1 and f.next_reminder_date is not null and f.next_reminder_date <= current_date
      order by f.next_reminder_date asc limit 25
    )
    select 'overdue_payment' as type, o.id::text as entity_id, ('Payment due from ' || o.name) as title,
      ('Remaining balance: ' || o.remaining_balance::text) as detail, now() as created_at from overdue o
    union all
    select 'followup_due', f.id::text, ('Follow-up due for ' || f.member_name), ('Reminder date: ' || f.next_reminder_date::text), now() from followups f
    order by created_at desc limit $2`, [req.sectorId, limit]));
  res.json({ success: true, data: result.rows });
});

module.exports = router;
