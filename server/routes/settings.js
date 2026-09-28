const express = require('express');
const router = express.Router();
const sheetsService = require('../services/finance-db');
const { requireAuth, requireWriteAccess, scopeToSector } = require('../middleware/auth');
const idempotency = require('../middleware/idempotency');
const { getSettingsDefaults } = require('../services/settings-defaults');

router.use(requireAuth, scopeToSector);

router.get('/', async (req, res) => {
  try {
    const settings = await sheetsService.getSettings(req.sectorId, {
      sectorId: req.sectorId,
      role: req.user.role,
    });
    const data = {
      ...getSettingsDefaults(),
      ...settings
    };
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', requireWriteAccess, idempotency(), async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, error: 'Settings data required' });
    }
    await sheetsService.saveSettings(data, req.sectorId, {
      sectorId: req.sectorId,
      role: req.user.role,
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
