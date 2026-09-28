const express = require('express');
const router = express.Router();
const sheetsService = require('../services/finance-db');
const { requireAuth, requireWriteAccess, scopeToSector } = require('../middleware/auth');
const idempotency = require('../middleware/idempotency');

router.use(requireAuth, scopeToSector);

router.get('/', async (req, res) => {
  try {
    const campaignId = String(req.query.campaignId || '').trim();
    if (!campaignId) {
      return res.status(400).json({ success: false, error: 'Campaign ID is required' });
    }
    const data = await sheetsService.getSpecialFundContributions(campaignId, req.sectorId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', requireWriteAccess, idempotency(), async (req, res) => {
  try {
    const { data } = req.body;
    if (!data || !String(data['Campaign ID'] || '').trim() || !String(data['Member Name'] || '').trim()) {
      return res.status(400).json({ success: false, error: 'Campaign and member are required' });
    }
    const amount = Number(data['Amount Paid']);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Contribution amount must be greater than zero' });
    }
    const result = await sheetsService.addSpecialFundContribution(data, req.sectorId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', requireWriteAccess, idempotency(), async (req, res) => {
  try {
    const rowId = Number(req.params.id);
    const { data } = req.body;
    if (!Number.isInteger(rowId) || rowId < 1 || !data) {
      return res.status(400).json({ success: false, error: 'Valid contribution and data are required' });
    }
    if (data['Amount Paid'] !== undefined && (!Number.isFinite(Number(data['Amount Paid'])) || Number(data['Amount Paid']) <= 0)) {
      return res.status(400).json({ success: false, error: 'Contribution amount must be greater than zero' });
    }
    await sheetsService.updateSpecialFundContribution(rowId, data, req.sectorId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', requireWriteAccess, idempotency(), async (req, res) => {
  try {
    const rowId = Number(req.params.id);
    if (!Number.isInteger(rowId) || rowId < 1) {
      return res.status(400).json({ success: false, error: 'Valid contribution is required' });
    }
    await sheetsService.deleteSpecialFundContribution(rowId, req.sectorId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
