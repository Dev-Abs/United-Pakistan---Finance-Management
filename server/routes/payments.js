const express = require('express');
const router = express.Router();
const sheetsService = require('../services/sheets');
const { requireAuth, requireWriteAccess } = require('../middleware/auth');
const calculations = require('../utils/calculations');

router.use(requireAuth);

router.post('/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { month, amountPaid, paymentDate, remarks, totalPayable } = req.body;

    if (!month || amountPaid === undefined || !totalPayable) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const remainingBalance = calculations.calculateRemaining(totalPayable, amountPaid);
    const status = calculations.calculateStatus(totalPayable, amountPaid);

    const updateData = {
      'Amount Paid': amountPaid,
      'Remaining Balance': remainingBalance,
      'Payment Status': status,
      'Payment Date': paymentDate || '',
      'Remarks': remarks || ''
    };

    await sheetsService.updateMember(month, parseInt(id, 10), updateData);

    res.json({ success: true, data: updateData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
