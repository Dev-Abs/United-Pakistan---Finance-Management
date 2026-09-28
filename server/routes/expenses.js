const express = require('express');
const router = express.Router();
const sheetsService = require('../services/finance-db');
const { requireAuth, requireWriteAccess, scopeToSector } = require('../middleware/auth');

router.use(requireAuth, scopeToSector);

router.get('/', async (req, res) => {
  try {
    const month = String(req.query.month || '').trim();
    const data = await sheetsService.getExpenses(month || null, req.sectorId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', requireWriteAccess, async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, error: 'Expense data is required' });
    }
    const result = await sheetsService.addExpense(data, req.sectorId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, error: 'Expense data is required' });
    }
    await sheetsService.updateExpense(parseInt(id, 10), data, req.sectorId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    await sheetsService.deleteExpense(parseInt(id, 10), req.sectorId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
