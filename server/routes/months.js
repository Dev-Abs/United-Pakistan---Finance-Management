const express = require('express');
const router = express.Router();
const sheetsService = require('../services/finance-db');
const { requireAuth, requireWriteAccess, scopeToSector } = require('../middleware/auth');
const idempotency = require('../middleware/idempotency');

router.use(requireAuth, scopeToSector);

router.get('/', async (req, res) => {
  try {
    const sheets = await sheetsService.getSheets(req.sectorId, {
      sectorId: req.sectorId,
      role: req.user.role,
    });
    res.json({ success: true, data: sheets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/new', requireWriteAccess, idempotency(), async (req, res) => {
  try {
    const { monthName, carryBalances } = req.body;
    if (!monthName) {
      return res.status(400).json({ success: false, error: 'Month name is required' });
    }
    await sheetsService.createMonthSheet(monthName, carryBalances, req.sectorId, {
      sectorId: req.sectorId,
      role: req.user.role,
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
