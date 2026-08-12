const express = require('express');
const router = express.Router();
const sheetsService = require('../services/sheets');
const { requireAuth, requireWriteAccess } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireWriteAccess);

router.get('/', async (req, res) => {
  try {
    const month = String(req.query.month || '').trim();
    const data = await sheetsService.getDiagnostics(month || null);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
