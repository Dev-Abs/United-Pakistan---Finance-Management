const express = require('express');
const router = express.Router();
const sheetsService = require('../services/finance-db');
const { requireAuth, requireWriteAccess, scopeToSector } = require('../middleware/auth');
const idempotency = require('../middleware/idempotency');

router.use(requireAuth, scopeToSector);

router.get('/', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) {
      return res.status(400).json({ success: false, error: 'Month parameter is required' });
    }
    const data = await sheetsService.getSheetData(month, req.sectorId, {
      sectorId: req.sectorId,
      role: req.user.role,
    });
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
    const data = await sheetsService.getMemberHistory(name, phone, req.sectorId, {
      sectorId: req.sectorId,
      role: req.user.role,
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', requireWriteAccess, idempotency(), async (req, res) => {
  try {
    const { month, data } = req.body;
    if (!month || !data) {
      return res.status(400).json({ success: false, error: 'Month and data are required' });
    }
    const result = await sheetsService.addMember(month, data, req.sectorId, {
      sectorId: req.sectorId,
      role: req.user.role,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', requireWriteAccess, idempotency(), async (req, res) => {
  try {
    const { id } = req.params;
    const { month, data } = req.body;
    if (!month || !data) {
      return res.status(400).json({ success: false, error: 'Month and data are required' });
    }
    await sheetsService.updateMember(month, parseInt(id, 10), data, req.sectorId, {
      sectorId: req.sectorId,
      role: req.user.role,
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', requireWriteAccess, idempotency(), async (req, res) => {
  try {
    const { id } = req.params;
    const { month } = req.query;
    if (!month) {
      return res.status(400).json({ success: false, error: 'Month parameter is required' });
    }
    await sheetsService.deleteMember(month, parseInt(id, 10), req.sectorId, {
      sectorId: req.sectorId,
      role: req.user.role,
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
