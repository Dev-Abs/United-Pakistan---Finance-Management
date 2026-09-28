const express = require('express');
const router = express.Router();
const sheetsService = require('../services/finance-db');
const { requireAuth, requireWriteAccess, scopeToSector } = require('../middleware/auth');
const idempotency = require('../middleware/idempotency');

router.use(requireAuth, scopeToSector);
router.use(requireWriteAccess, idempotency());

router.get('/', async (req, res) => {
  try {
    const month = String(req.query.month || '').trim();
    const data = await sheetsService.getDiagnostics(month || null, req.sectorId, {
      sectorId: req.sectorId,
      role: req.user.role,
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/repair-month-columns', async (req, res) => {
  try {
    const data = await sheetsService.repairMonthColumns(req.sectorId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
