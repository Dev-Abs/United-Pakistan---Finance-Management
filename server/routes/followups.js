const express = require('express');
const router = express.Router();
const sheetsService = require('../services/finance-db');
const { requireAuth, requireWriteAccess, scopeToSector } = require('../middleware/auth');
const idempotency = require('../middleware/idempotency');

router.use(requireAuth, scopeToSector);

router.get('/', async (req, res) => {
  try {
    const month = String(req.query.month || '').trim();
    if (!month) {
      return res.status(400).json({ success: false, error: 'Month parameter is required' });
    }
    const data = await sheetsService.getFollowUps(month, req.sectorId, {
      sectorId: req.sectorId,
      role: req.user.role,
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/member', async (req, res) => {
  try {
    const month = String(req.query.month || '').trim();
    const { name, phone } = req.query;
    if (!month || (!name && !phone)) {
      return res.status(400).json({ success: false, error: 'Month and member identifier are required' });
    }
    const data = await sheetsService.getMemberFollowUps(month, name, phone, req.sectorId, {
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
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, error: 'Follow-up data is required' });
    }
    const result = await sheetsService.addFollowUp(data, req.sectorId, {
      sectorId: req.sectorId,
      role: req.user.role,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
