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
    
    const members = await sheetsService.getSheetData(month);
    
    if (members.length === 0) {
      return res.status(404).send('No data found for this month');
    }
    
    // Get headers from first object
    const headers = Object.keys(members[0]).filter(k => k !== '_rowId');
    
    let csv = headers.join(',') + '\n';
    
    members.forEach(m => {
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
    
    const members = await sheetsService.getSheetData(month);
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(month);
    
    if (members.length > 0) {
      const headers = Object.keys(members[0]).filter(k => k !== '_rowId');
      
      sheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }));
      
      members.forEach(m => {
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

module.exports = router;
