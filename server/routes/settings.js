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
      SPECIAL_FUND_CAMPAIGN_ID: 'central-convention-2027',
      SPECIAL_FUND_CAMPAIGN_NAME: 'مرکزی کنونشن خصوصی فنڈ',
      SPECIAL_FUND_EVENT_TIMING: 'آئندہ سال',
      SPECIAL_FUND_EVENT_VENUE: 'لیاقت باغ',
      SPECIAL_FUND_JP_MINIMUM: '5000',
      SPECIAL_FUND_SC_MINIMUM: '1000',
      SPECIAL_FUND_FM_MINIMUM: '0',
      SPECIAL_FUND_MESSAGE_TEMPLATE: 'محترم انقلابی احباب،\nالسلام علیکم ورحمۃ اللہ وبرکاتہ\n\nیونائیٹڈ پاکستان کے ورکنگ بیورو نے {event_timing} {event_venue} میں ایک عظیم الشان مرکزی کنونشن منعقد کرنے کا فیصلہ کیا ہے، جو ہماری تحریک، نظریے اور تنظیمی قوت کا تاریخی مظہر ہوگا۔\n\nاس تاریخی مقصد کے لیے خصوصی فنڈ مہم کا باضابطہ آغاز کیا جا رہا ہے۔ ورکنگ کمیٹی کی جانب سے ممبران کے لیے تعاون کی کم از کم حد (Minimum Limit) درج ذیل مقرر کی گئی ہے:\n\nجائزہ پاس ممبران: کم از کم {jp_minimum} روپے\nسٹڈی سرکل ممبران: کم از کم {sc_minimum} روپے\n\nتمام فیلو ممبران، جائزہ پاس ممبران، اور سٹڈی سرکل ممبران سے اپیل ہے کہ وہ اس مقررہ حد کو سامنے رکھتے ہوئے اپنی استطاعت کے مطابق زیادہ سے زیادہ (Maximum) مالی تعاون پیش کریں۔\n\nآپ کا ہر قطرہِ تعاون اس تاریخی کنونشن کی کامیابی اور پارٹی کی مضبوطی میں اہم ترین کردار ادا کرے گا۔ آج ہی اپنا حصہ جمع کروائیں اور دیگر ساتھیوں کو بھی اس انقلابی ذمہ داری میں شریک ہونے کی دعوت دیں۔',
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
