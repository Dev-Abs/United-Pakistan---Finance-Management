const express = require('express');
const router = express.Router();
const sheetsService = require('../services/sheets');
const { requireAuth, requireWriteAccess } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const settings = await sheetsService.getSettings();
    // Default fallbacks if empty
    const data = {
      ORG_NAME: process.env.ORG_NAME || 'United Pakistan',
      SECRETARY_NAME: process.env.SECRETARY_NAME || 'Abdullah Ubaid',
      SECTOR_NAME: process.env.SECTOR_NAME || 'Expressway Sector',
      EASYPAISA_NUMBER: process.env.EASYPAISA_NUMBER || '03XXXXXXXXX',
      ACCOUNT_TITLE: process.env.ACCOUNT_TITLE || 'Abdullah Ubaid',
      DEFAULT_MONTHLY_FUND: process.env.DEFAULT_MONTHLY_FUND || '500',
      ...settings
    };
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', requireWriteAccess, async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, error: 'Settings data required' });
    }
    await sheetsService.saveSettings(data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
