const express = require('express');
const router = express.Router();
const sheetsService = require('../services/sheets');
const { requireAuth, requireWriteAccess } = require('../middleware/auth');

router.use(requireAuth);

router.post('/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { month, amountPaid, expectedAmountPaid, paymentDate, remarks } = req.body;

    if (!month || amountPaid === undefined || expectedAmountPaid === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    const paid = Number(amountPaid);
    const expected = Number(expectedAmountPaid);
    if (!Number.isFinite(paid) || !Number.isFinite(expected) || paid < 0 || expected < 0) {
      return res.status(400).json({ success: false, error: 'Payment amounts must be valid non-negative numbers' });
    }

    const result = await sheetsService.updatePayment(
      month,
      parseInt(id, 10),
      expected,
      paid,
      paymentDate || '',
      remarks || '',
    );

    res.json({ success: true, data: result });
  } catch (error) {
    const conflict = String(error.message || '').includes('PAYMENT_CONFLICT');
    res.status(conflict ? 409 : 500).json({
      success: false,
      error: conflict
        ? 'This payment changed after you opened it. Refresh and review the latest amount before saving.'
        : error.message,
    });
  }
});

module.exports = router;
