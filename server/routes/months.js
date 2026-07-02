const express = require('express');
const router = express.Router();
const sheetsService = require('../services/sheets');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const sheets = await sheetsService.getSheets();
    res.json({ success: true, data: sheets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/new', async (req, res) => {
  try {
    const { monthName, carryBalances } = req.body;
    if (!monthName) {
      return res.status(400).json({ success: false, error: 'Month name is required' });
    }
    await sheetsService.createMonthSheet(monthName, carryBalances);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
