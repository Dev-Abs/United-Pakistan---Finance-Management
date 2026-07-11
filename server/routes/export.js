const express = require('express');
const router = express.Router();
const sheetsService = require('../services/sheets');
const { requireAuth } = require('../middleware/auth');
const ExcelJS = require('exceljs');

router.use(requireAuth);

router.get('/csv', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).send('Month required');
    
    const [members, followUps] = await Promise.all([
      sheetsService.getSheetData(month),
      sheetsService.getFollowUps(month).catch(() => [])
    ]);
    
    if (members.length === 0) {
      return res.status(404).send('No data found for this month');
    }
    
    const rows = enrichMembersWithFollowUps(members, followUps);
    const headers = Object.keys(rows[0]).filter(k => k !== '_rowId');
    
    let csv = headers.join(',') + '\n';
    
    rows.forEach(m => {
      const row = headers.map(h => {
        let val = m[h] !== undefined && m[h] !== null ? m[h].toString() : '';
        // Escape quotes and wrap in quotes if contains comma
        val = val.replace(/"/g, '""');
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          val = `"${val}"`;
        }
        return val;
      });
      csv += row.join(',') + '\n';
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Finance_Report_${month.replace(/\s+/g, '_')}.csv`);
    res.send(csv);
    
  } catch (error) {
    res.status(500).send('Error generating CSV: ' + error.message);
  }
});

router.get('/expense/csv', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).send('Month required');

    const expenses = await sheetsService.getExpenses(month);

    if (expenses.length === 0) {
      return res.status(404).send('No expenses found for this month');
    }

    const headers = Object.keys(expenses[0]).filter(k => k !== '_rowId');

    let csv = headers.join(',') + '\n';

    expenses.forEach(e => {
      const row = headers.map(h => {
        let val = e[h] !== undefined && e[h] !== null ? e[h].toString() : '';
        val = val.replace(/"/g, '""');
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          val = `"${val}"`;
        }
        return val;
      });
      csv += row.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Expenses_${month.replace(/\s+/g, '_')}.csv`);
    res.send(csv);

  } catch (error) {
    res.status(500).send('Error generating CSV: ' + error.message);
  }
});

router.get('/expense/excel', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).send('Month required');

    const expenses = await sheetsService.getExpenses(month);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Expenses');

    if (expenses.length > 0) {
      const headers = Object.keys(expenses[0]).filter(k => k !== '_rowId');

      sheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }));

      expenses.forEach(e => {
        sheet.addRow(e);
      });

      sheet.getRow(1).font = { bold: true };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Expenses_${month.replace(/\s+/g, '_')}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    res.status(500).send('Error generating Excel: ' + error.message);
  }
});

router.get('/excel', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).send('Month required');
    
    const [members, followUps] = await Promise.all([
      sheetsService.getSheetData(month),
      sheetsService.getFollowUps(month).catch(() => [])
    ]);
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(month);
    
    const rows = enrichMembersWithFollowUps(members, followUps);

    if (rows.length > 0) {
      const headers = Object.keys(rows[0]).filter(k => k !== '_rowId');
      
      sheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }));
      
      rows.forEach(m => {
        sheet.addRow(m);
      });
      
      // Style header row
      sheet.getRow(1).font = { bold: true };
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Finance_Report_${month.replace(/\s+/g, '_')}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    res.status(500).send('Error generating Excel: ' + error.message);
  }
});

function enrichMembersWithFollowUps(members, followUps) {
  return members.map(member => {
    const summary = buildMemberFollowUpSummary(member, followUps);
    return {
      ...member,
      'Reminder Count': summary.reminderCount,
      'Last Reminder Date': summary.lastReminderDate,
      'Reply Status': summary.latestReplyStatus,
      'Reason / Reply': summary.reason,
      'Next Reminder Date': summary.nextDate,
      'Awaiting Reply': summary.awaitingReply ? 'Yes' : 'No'
    };
  });
}

function buildMemberFollowUpSummary(member, followUps) {
  const phone = normalizePhone(member['Phone Number']);
  const name = String(member['Name'] || '').trim().toLowerCase();
  const items = followUps.filter(item => {
    const samePhone = phone && normalizePhone(item['Phone Number']) === phone;
    const sameName = name && String(item['Member Name'] || '').trim().toLowerCase() === name;
    return samePhone || sameName;
  }).sort((a, b) => new Date(a['Event Date'] || 0) - new Date(b['Event Date'] || 0));
  const reminders = items.filter(item => item['Event Type'] === 'Reminder Sent');
  const responseLogs = items.filter(item => item['Event Type'] === 'Reply Received');
  const replies = responseLogs.filter(item => item['Reply Status'] !== 'No Reply');
  const latestReminder = reminders[reminders.length - 1] || null;
  const latestReply = replies[replies.length - 1] || null;
  const latestResponseLog = responseLogs[responseLogs.length - 1] || null;
  const latestItem = items[items.length - 1] || null;
  return {
    reminderCount: reminders.length,
    lastReminderDate: latestReminder ? latestReminder['Event Date'] : '',
    latestReplyStatus: latestResponseLog ? latestResponseLog['Reply Status'] : '',
    reason: latestResponseLog ? latestResponseLog['Reason / Reply'] : '',
    nextDate: latestItem ? latestItem['Next Reminder Date'] : '',
    awaitingReply: !!latestReminder && (!latestReply || new Date(latestReply['Event Date'] || 0) < new Date(latestReminder['Event Date'] || 0))
  };
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

module.exports = router;
