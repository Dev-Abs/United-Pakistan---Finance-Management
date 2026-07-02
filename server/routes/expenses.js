const express = require('express');
const router = express.Router();
const sheetsService = require('../services/sheets');
const { requireAuth, requireWriteAccess } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { month } = req.query;
    const data = await sheetsService.getExpenses(month || null);
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
    const result = await sheetsService.addExpense(data);
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
    await sheetsService.updateExpense(parseInt(id, 10), data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    await sheetsService.deleteExpense(parseInt(id, 10));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
