const express = require('express');
const router = express.Router();
const sheetsService = require('../services/sheets');
const { requireAuth, requireWriteAccess } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) {
      return res.status(400).json({ success: false, error: 'Month parameter is required' });
    }
    const data = await sheetsService.getSheetData(month);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { name, phone } = req.query;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Name parameter is required' });
    }
    const data = await sheetsService.getMemberHistory(name, phone);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', requireWriteAccess, async (req, res) => {
  try {
    const { month, data } = req.body;
    if (!month || !data) {
      return res.status(400).json({ success: false, error: 'Month and data are required' });
    }
    const result = await sheetsService.addMember(month, data);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { month, data } = req.body;
    if (!month || !data) {
      return res.status(400).json({ success: false, error: 'Month and data are required' });
    }
    await sheetsService.updateMember(month, parseInt(id, 10), data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { month } = req.query;
    if (!month) {
      return res.status(400).json({ success: false, error: 'Month parameter is required' });
    }
    await sheetsService.deleteMember(month, parseInt(id, 10));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
