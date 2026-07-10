const SECRET = 'unitedpakistan2026'; // Match APPS_SCRIPT_SECRET in .env

function doPost(e) {
  return handleRequest(e, 'POST');
}

function doGet(e) {
  return handleRequest(e, 'GET');
}

function handleRequest(e, method) {
  try {
    const params = method === 'POST' ? JSON.parse(e.postData.contents) : e.parameter;

    // Validate secret
    if (params.secret !== SECRET) {
      return response({ error: 'Unauthorized' }, 401);
    }

    const action = params.action;
    let result = null;

    switch (action) {
      case 'getSheets':
        result = getSheets();
        break;
      case 'getSheet':
        result = getSheetData(params.sheetName);
        break;
      case 'appendRow':
        result = appendRow(params.sheetName, params.data);
        break;
      case 'updateRow':
        result = updateRow(params.sheetName, params.rowId, params.data);
        break;
      case 'deleteRow':
        result = deleteRow(params.sheetName, params.rowId);
        break;
      case 'createMonthSheet':
        result = createMonthSheet(params.newSheetName, params.carryBalances);
        break;
      case 'getExpenses':
        result = getExpenses(params.month);
        break;
      case 'addExpense':
        result = addExpense(params.data);
        break;
      case 'updateExpense':
        result = updateExpense(params.rowId, params.data);
        break;
      case 'deleteExpense':
        result = deleteExpense(params.rowId);
        break;
      case 'getSettings':
        result = getSettings();
        break;
      case 'getMemberHistory':
        result = getMemberHistory(params.name, params.phone);
        break;
      case 'saveSettings':
        result = saveSettings(params.data);
        break;
      case 'refreshReportSheets':
        result = refreshMonthlyReportSheets(params.month);
        break;
      default:
        return response({ error: 'Unknown action' }, 400);
    }

    return response({ success: true, data: result });
  } catch (error) {
    return response({ success: false, error: error.toString() }, 500);
  }
}

function response(data, code = 200) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ----------------------------------------------------------------------------
// Payment Status Logic
// ----------------------------------------------------------------------------

// Mirrors the Status -> Amount Paid -> Remaining Balance cascade from the
// Excel tracker. Mutates `data` in place and returns it.
function applyPaymentStatusLogic(data, status, totalPayable) {
  const totalPayableNum = Number(totalPayable) || 0;

  if (status === 'Paid') {
    data['Amount Paid'] = totalPayableNum;
    data['Remaining Balance'] = 0;
  } else if (status === 'Partially Paid') {
    if (data['Amount Paid'] === undefined || data['Amount Paid'] === '') {
      throw new Error('Amount Paid is required when Payment Status is Partially Paid');
    }
    data['Remaining Balance'] = totalPayableNum - Number(data['Amount Paid']);
  } else if (status === 'Pending') {
    data['Amount Paid'] = 0;
    data['Remaining Balance'] = totalPayableNum;
  }

  return data;
}

// ----------------------------------------------------------------------------
// Sheet Formatting
// ----------------------------------------------------------------------------

// Applies header styling, column widths, number formats, and the
// Payment Status dropdown + color coding to a freshly-created sheet.
function applySheetFormatting(sheet, headers) {
  const numCols = headers.length;
  const numRows = sheet.getMaxRows();

  const headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange.setFontWeight('bold')
    .setFontColor('#FFFFFF')
    .setBackground('#4472C4')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true);
  sheet.setFrozenRows(1);

  sheet.getRange(1, 1, numRows, numCols).setFontFamily('Arial').setFontSize(10);

  const widths = {
    'Name': 160, 'Phone Number': 130, 'Designation': 130, 'Member Category': 180,
    'Payment Date': 110, 'Receipt Link': 160, 'Remarks': 160
  };
  headers.forEach((header, i) => {
    sheet.setColumnWidth(i + 1, widths[header] || 120);
  });

  const moneyCols = ['Monthly Fund', 'Previous Balance', 'Total Payable', 'Amount Paid', 'Remaining Balance'];
  moneyCols.forEach(col => {
    const idx = headers.indexOf(col);
    if (idx !== -1 && numRows > 1) {
      sheet.getRange(2, idx + 1, numRows - 1, 1).setNumberFormat('#,##0');
    }
  });

  const statusIdx = headers.indexOf('Payment Status');
  if (statusIdx !== -1 && numRows > 1) {
    const statusRange = sheet.getRange(2, statusIdx + 1, numRows - 1, 1);

    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Pending', 'Partially Paid', 'Paid'], true)
      .setAllowInvalid(false)
      .build();
    statusRange.setDataValidation(rule);

    const existingRules = sheet.getConditionalFormatRules();
    existingRules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('Paid')
        .setBackground('#C6EFCE').setFontColor('#006100')
        .setRanges([statusRange]).build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('Partially Paid')
        .setBackground('#FFEB9C').setFontColor('#9C6500')
        .setRanges([statusRange]).build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('Pending')
        .setBackground('#FFC7CE').setFontColor('#9C0006')
        .setRanges([statusRange]).build()
    );
    sheet.setConditionalFormatRules(existingRules);
  }

  const categoryIdx = headers.indexOf('Member Category');
  if (categoryIdx !== -1 && numRows > 1) {
    const categoryRange = sheet.getRange(2, categoryIdx + 1, numRows - 1, 1);
    const categoryRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Jaiza Pass Member(JP)', 'Study Circle Member (SC)', 'Fellow Member (FM)'], true)
      .setAllowInvalid(false)
      .build();
    categoryRange.setDataValidation(categoryRule);
  }
}

// ----------------------------------------------------------------------------
// Sheet Operations
// ----------------------------------------------------------------------------

function getSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheets()
    .map(sheet => sheet.getName())
    .filter(name => name !== 'Settings' && name !== 'Expenses' && !isReportSheetName(name));
}

function getHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    // Inject default headers if sheet is empty
    const headers = ['Name', 'Phone Number', 'Designation', 'Member Category', 'Monthly Fund', 'Previous Balance', 'Total Payable', 'Amount Paid', 'Remaining Balance', 'Payment Status', 'Payment Date', 'Receipt Link', 'Remarks'];
    sheet.appendRow(headers);
    applySheetFormatting(sheet, headers);
    return headers;
  }
  const range = sheet.getRange(1, 1, 1, lastCol);
  const headers = range.getValues()[0];
  if (headers.indexOf('Member Category') === -1) {
    const newCol = headers.length + 1;
    sheet.getRange(1, newCol).setValue('Member Category');
    headers.push('Member Category');
    applySheetFormatting(sheet, headers);
  }
  return headers;
}

function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    // If sheet doesn't exist, maybe it's a new month. We can create it empty if needed,
    // but better to throw error and let user create it explicitly.
    throw new Error('Sheet not found: ' + sheetName);
  }

  const headers = getHeaders(sheet);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2) return [];

  const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
  const data = dataRange.getValues();

  return data.map((row, index) => {
    let obj = { _rowId: index + 2 }; // 1-based index + header row
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
}

function appendRow(sheetName, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found');

  const headers = getHeaders(sheet);

  if (!data['Payment Status']) {
    data['Payment Status'] = 'Pending';
  }
  if (!data['Member Category']) {
    data['Member Category'] = 'Fellow Member (FM)';
  }

  const totalPayable = data['Total Payable'] !== undefined ? data['Total Payable'] : 0;
  applyPaymentStatusLogic(data, data['Payment Status'], totalPayable);

  const rowData = headers.map(header => data[header] !== undefined ? data[header] : '');

  sheet.appendRow(rowData);
  refreshMonthlyReportSheets(sheetName);
  return { _rowId: sheet.getLastRow() };
}

function updateRow(sheetName, rowId, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found');

  const headers = getHeaders(sheet);
  const range = sheet.getRange(rowId, 1, 1, headers.length);
  const currentRowData = range.getValues()[0];

  const statusIdx = headers.indexOf('Payment Status');
  const totalPayableIdx = headers.indexOf('Total Payable');

  const touchesPaymentFields = data['Payment Status'] !== undefined
    || data['Amount Paid'] !== undefined
    || data['Total Payable'] !== undefined;

  if (touchesPaymentFields) {
    const status = data['Payment Status'] !== undefined
      ? data['Payment Status']
      : (statusIdx !== -1 ? currentRowData[statusIdx] : undefined);
    const totalPayable = data['Total Payable'] !== undefined
      ? data['Total Payable']
      : (totalPayableIdx !== -1 ? currentRowData[totalPayableIdx] : 0);

    applyPaymentStatusLogic(data, status, totalPayable);
  }

  const newRowData = headers.map((header, index) => {
    return data[header] !== undefined ? data[header] : currentRowData[index];
  });

  range.setValues([newRowData]);
  refreshMonthlyReportSheets(sheetName);
  return true;
}

function deleteRow(sheetName, rowId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found');

  sheet.deleteRow(rowId);
  refreshMonthlyReportSheets(sheetName);
  return true;
}

// ----------------------------------------------------------------------------
// Expense Operations — single "Expenses" sheet with a Month column
// ----------------------------------------------------------------------------

const EXPENSE_HEADERS = ['Month', 'Date', 'Category', 'Description', 'Amount', 'Paid By', 'Remarks'];

function getOrCreateExpensesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Expenses');
  if (!sheet) {
    sheet = ss.insertSheet('Expenses');
    sheet.appendRow(EXPENSE_HEADERS);
    const headerRange = sheet.getRange(1, 1, 1, EXPENSE_HEADERS.length);
    headerRange.setFontWeight('bold')
      .setFontColor('#FFFFFF')
      .setBackground('#4472C4')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    const widths = { 'Month': 130, 'Date': 110, 'Category': 140, 'Description': 250, 'Amount': 100, 'Paid By': 130, 'Remarks': 160 };
    EXPENSE_HEADERS.forEach((h, i) => sheet.setColumnWidth(i + 1, widths[h] || 120));
  }
  return sheet;
}

function getExpenses(month) {
  const sheet = getOrCreateExpensesSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, EXPENSE_HEADERS.length).getValues();
  // Track actual sheet row number (data index + 2)
  const allData = data.map((row, i) => ({ row, actualRow: i + 2 }));
  const filtered = month
    ? allData.filter(({ row }) => String(row[0]).trim() === month)
    : allData;

  return filtered.map(({ row, actualRow }) => {
    const obj = { _rowId: actualRow };
    EXPENSE_HEADERS.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
}

function addExpense(data) {
  const sheet = getOrCreateExpensesSheet();
  const rowData = EXPENSE_HEADERS.map(header => data[header] !== undefined ? data[header] : '');
  sheet.appendRow(rowData);
  if (data['Month']) refreshMonthlyReportSheets(data['Month']);
  return { _rowId: sheet.getLastRow() };
}

function updateExpense(rowId, data) {
  const sheet = getOrCreateExpensesSheet();
  const range = sheet.getRange(rowId, 1, 1, EXPENSE_HEADERS.length);
  const currentRowData = range.getValues()[0];
  const oldMonth = currentRowData[0];
  const newRowData = EXPENSE_HEADERS.map((header, index) => {
    return data[header] !== undefined ? data[header] : currentRowData[index];
  });
  range.setValues([newRowData]);
  const newMonth = newRowData[0];
  if (oldMonth) refreshMonthlyReportSheets(oldMonth);
  if (newMonth && newMonth !== oldMonth) refreshMonthlyReportSheets(newMonth);
  return true;
}

function deleteExpense(rowId) {
  const sheet = getOrCreateExpensesSheet();
  const month = sheet.getRange(rowId, 1).getValue();
  sheet.deleteRow(rowId);
  if (month) refreshMonthlyReportSheets(month);
  return true;
}

// ----------------------------------------------------------------------------
// Share-ready Excel Report Sheets
// ----------------------------------------------------------------------------

const MEMBER_CATEGORIES = [
  { key: 'JP', label: 'JP Members', match: 'jaiza pass' },
  { key: 'SC', label: 'SC Members', match: 'study circle' },
  { key: 'FM', label: 'FM Members', match: 'fellow' }
];

function isReportSheetName(name) {
  return String(name || '').endsWith('-Collection') || String(name || '').endsWith('-Expense');
}

function createMonthSheet(newSheetName, carryBalances) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!newSheetName) throw new Error('Month name is required');
  if (ss.getSheetByName(newSheetName)) throw new Error('Sheet already exists: ' + newSheetName);

  const sheet = ss.insertSheet(newSheetName);
  const headers = getHeaders(sheet);

  if (carryBalances) {
    const sourceSheet = getLatestDataSheetBefore(ss, newSheetName);
    if (sourceSheet) {
      const sourceData = getSheetData(sourceSheet.getName());
      const rows = sourceData.map(member => {
        const next = {};
        headers.forEach(header => next[header] = '');
        next['Name'] = member['Name'] || '';
        next['Phone Number'] = member['Phone Number'] || '';
        next['Designation'] = member['Designation'] || '';
        next['Member Category'] = member['Member Category'] || 'Fellow Member (FM)';
        next['Monthly Fund'] = member['Monthly Fund'] || '';
        next['Previous Balance'] = member['Remaining Balance'] || 0;
        next['Total Payable'] = (Number(next['Monthly Fund']) || 0) + (Number(next['Previous Balance']) || 0);
        next['Amount Paid'] = 0;
        next['Remaining Balance'] = next['Total Payable'];
        next['Payment Status'] = 'Pending';
        next['Remarks'] = member['Remarks'] || '';
        return headers.map(header => next[header] !== undefined ? next[header] : '');
      });
      if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
  }

  applySheetFormatting(sheet, headers);
  refreshMonthlyReportSheets(newSheetName);
  return { name: newSheetName };
}

function getLatestDataSheetBefore(ss, newSheetName) {
  const dataSheets = ss.getSheets()
    .filter(sheet => sheet.getName() !== 'Settings' && sheet.getName() !== 'Expenses' && !isReportSheetName(sheet.getName()) && sheet.getName() !== newSheetName);
  if (!dataSheets.length) return null;
  return dataSheets[dataSheets.length - 1];
}

function refreshMonthlyReportSheets(month) {
  if (!month || isReportSheetName(month)) return { skipped: true };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(month);
  if (!sourceSheet) return { skipped: true, reason: 'Month sheet not found' };

  const members = getSheetData(month);
  const expenses = getExpenses(month);
  const settings = getSettings();

  buildCollectionReportSheet(ss, month, members, expenses, settings);
  buildExpenseReportSheet(ss, month, expenses, settings);
  return { collectionSheet: month + '-Collection', expenseSheet: month + '-Expense' };
}

function resetReportSheet(ss, name, rows, cols) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  sheet.clear();

  if (sheet.getMaxRows() < rows) sheet.insertRowsAfter(sheet.getMaxRows(), rows - sheet.getMaxRows());
  if (sheet.getMaxColumns() < cols) sheet.insertColumnsAfter(sheet.getMaxColumns(), cols - sheet.getMaxColumns());
  if (sheet.getMaxRows() > rows) sheet.deleteRows(rows + 1, sheet.getMaxRows() - rows);
  if (sheet.getMaxColumns() > cols) sheet.deleteColumns(cols + 1, sheet.getMaxColumns() - cols);

  sheet.getRange(1, 1, rows, cols).setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle');
  return sheet;
}

function buildCollectionReportSheet(ss, month, members, expenses, settings) {
  const sheetName = month + '-Collection';
  const sheet = resetReportSheet(ss, sheetName, Math.max(40, members.length + 28), 14);
  const sectorName = settings['SECTOR_NAME'] || 'Expressway';
  const secretaryName = settings['SECRETARY_NAME'] || 'Abdullah Ubaidullah';
  const divisionName = settings['DIVISION_NAME'] || 'Rawalpindi Division';
  const orgName = settings['TANZEEM_NAME'] || 'Sector';

  setMergedValue(sheet, 1, 1, 1, 14, divisionName, '#111111', '#FFFF00', 'left', true);
  setMergedValue(sheet, 2, 1, 1, 14, 'Tanzeem Name: ' + orgName, '#111111', '#FFFF00', 'left', true);
  setMergedValue(sheet, 3, 1, 1, 11, 'Report: ' + sectorName, '#111111', '#FF0000', 'left', true);
  setMergedValue(sheet, 3, 12, 1, 3, month, '#00B050', '#FFFF00', 'center', true);
  setMergedValue(sheet, 4, 1, 1, 14, 'Sect Finance: ' + secretaryName + ' Sab', '#111111', '#FFFF00', 'left', true);

  let row = 5;
  const categoryTotals = { monthly: 0, increment: 0, previous: 0, receivable: 0, special: 0, recovery: 0, received: 0, balance: 0 };
  MEMBER_CATEGORIES.forEach(category => {
    const categoryMembers = members.filter(member => getMemberCategoryKey(member) === category.key);
    row = writeMemberCategoryBlock(sheet, row, category.label, categoryMembers, sectorName, categoryTotals);
    row += 1;
  });

  const totalExpense = expenses.reduce((sum, expense) => sum + (Number(expense['Amount']) || 0), 0);
  const totalCollection = categoryTotals.received;
  const remainingAmount = categoryTotals.balance;
  const duePreviousBalance = categoryTotals.previous;
  const dueMonthlyFund = categoryTotals.monthly;

  row = Math.max(row, 24);
  writeSummaryBlock(sheet, row, {
    totalCollection: totalCollection,
    totalExpense: totalExpense,
    recovery: categoryTotals.recovery,
    remainingAmount: remainingAmount,
    openingBalance: settings['OPENING_BALANCE'] || 0,
    dueMonthlyFund: dueMonthlyFund,
    duePreviousBalance: duePreviousBalance
  });

  const signatureRow = row + 5;
  setMergedValue(sheet, signatureRow, 3, 1, 4, 'Signature Sect Finance Sector Org', '#00B050', '#000000', 'center', true);
  setMergedValue(sheet, signatureRow + 2, 3, 1, 4, secretaryName, '#FFFF00', '#000000', 'center', true);
  setMergedValue(sheet, signatureRow, 11, 1, 3, 'Signature Sect Finance Sector Org', '#00B050', '#000000', 'center', true);
  setMergedValue(sheet, signatureRow + 2, 11, 1, 3, settings['APPROVER_NAME'] || '', '#FFFF00', '#000000', 'center', true);

  sheet.setFrozenRows(7);
  sheet.setColumnWidths(1, 1, 62);
  sheet.setColumnWidths(2, 1, 102);
  sheet.setColumnWidths(3, 1, 164);
  sheet.setColumnWidths(4, 1, 144);
  sheet.setColumnWidths(5, 1, 178);
  sheet.setColumnWidths(6, 8, 108);
  sheet.setColumnWidths(14, 1, 110);
  sheet.getRange(1, 1, sheet.getMaxRows(), 14).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
}

function writeMemberCategoryBlock(sheet, startRow, title, members, sectorName, totals) {
  setMergedValue(sheet, startRow, 1, 1, 14, title, '#D9D9D9', '#4472C4', 'center', true);
  sheet.getRange(startRow, 1, 1, 14).setFontSize(14);

  const headerRow = startRow + 1;
  const subHeaderRow = startRow + 2;
  const headers = ['S.No', 'Receipt No', 'Name', 'Sector', 'Contact No', 'Amount (Rs)', '', '', '', 'Special Fund', 'Collection Recovery', 'T- Received', 'Balance', 'Remarks'];
  const subHeaders = ['', '', '', '', '', 'Monthly fund', 'increment', 'Previous Balance', 'Receivables', '', '', '', '', ''];
  sheet.getRange(headerRow, 1, 1, 14).setValues([headers]).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(subHeaderRow, 1, 1, 14).setValues([subHeaders]).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(headerRow, 6, 1, 4).merge().setValue('Amount (Rs)');
  sheet.getRange(headerRow, 11, 1, 1).setWrap(true);

  let row = startRow + 3;
  const blockTotals = { monthly: 0, increment: 0, previous: 0, receivable: 0, special: 0, recovery: 0, received: 0, balance: 0 };
  members.forEach((member, index) => {
    const monthly = Number(member['Monthly Fund']) || 0;
    const previous = Number(member['Previous Balance']) || 0;
    const receivable = Number(member['Total Payable']) || monthly + previous;
    const received = Number(member['Amount Paid']) || 0;
    const balance = Number(member['Remaining Balance']) || Math.max(receivable - received, 0);
    const rowValues = [
      index + 1,
      member['Receipt No'] || 0,
      member['Name'] || '',
      sectorName,
      member['Phone Number'] || '',
      monthly,
      Number(member['Increment']) || 0,
      previous,
      receivable,
      Number(member['Special Fund']) || 0,
      Number(member['Recovery']) || 0,
      received,
      balance,
      member['Remarks'] || ''
    ];
    sheet.getRange(row, 1, 1, 14).setValues([rowValues]);
    sheet.getRange(row, 6, 1, 8).setNumberFormat('#,##0');
    if (balance > 0) sheet.getRange(row, 13).setFontColor('#FF0000').setFontWeight('bold');
    addTotals(blockTotals, rowValues);
    row += 1;
  });

  const totalRow = row;
  setMergedValue(sheet, totalRow, 1, 1, 5, 'Total Amounts', '#FFD966', '#000000', 'center', true);
  sheet.getRange(totalRow, 6, 1, 8).setValues([[
    blockTotals.monthly,
    blockTotals.increment,
    blockTotals.previous,
    blockTotals.receivable,
    blockTotals.special,
    blockTotals.recovery,
    blockTotals.received,
    blockTotals.balance
  ]]).setNumberFormat('#,##0').setFontWeight('bold').setBackground('#FFD966').setHorizontalAlignment('center');
  sheet.getRange(totalRow, 14).setBackground('#FFD966');
  Object.keys(blockTotals).forEach(key => totals[key] += blockTotals[key]);
  return totalRow + 1;
}

function addTotals(totals, rowValues) {
  totals.monthly += Number(rowValues[5]) || 0;
  totals.increment += Number(rowValues[6]) || 0;
  totals.previous += Number(rowValues[7]) || 0;
  totals.receivable += Number(rowValues[8]) || 0;
  totals.special += Number(rowValues[9]) || 0;
  totals.recovery += Number(rowValues[10]) || 0;
  totals.received += Number(rowValues[11]) || 0;
  totals.balance += Number(rowValues[12]) || 0;
}

function writeSummaryBlock(sheet, row, totals) {
  const labels = ['Total Collection', 'Total Expense', 'Recovery', 'Remaing Amount', 'Handover To Prov', 'Opening Balance', 'Monthly Fund', 'Previous Balance'];
  const values = [
    totals.totalCollection,
    totals.totalExpense,
    totals.recovery,
    totals.remainingAmount,
    '',
    totals.openingBalance,
    totals.dueMonthlyFund,
    totals.duePreviousBalance
  ];
  sheet.getRange(row, 5, 1, 8).setValues([labels])
    .setBackground('#111111')
    .setFontColor('#FFFF00')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setWrap(true);
  sheet.getRange(row + 1, 5, 1, 8).setValues([values])
    .setBackground('#FFFF00')
    .setFontColor('#000000')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setNumberFormat('#,##0');
  sheet.getRange(row + 1, 5).setBackground('#92D050');
  sheet.getRange(row + 1, 11).setBackground('#92D050');
  sheet.getRange(row + 2, 7, 2, 1).merge().setValue('Remaining\nAmount\n' + totals.remainingAmount)
    .setBackground('#FFC000')
    .setFontColor('#0000FF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
}

function buildExpenseReportSheet(ss, month, expenses, settings) {
  const sheetName = month + '-Expense';
  const rows = Math.max(34, expenses.length + 8);
  const sheet = resetReportSheet(ss, sheetName, rows, 7);
  const divisionName = settings['DIVISION_NAME'] || 'Rawalpindi Division';
  const sectorName = settings['SECTOR_NAME'] || 'Expressway';
  const secretaryName = settings['SECRETARY_NAME'] || 'Abdullah Ubaidullah';

  setMergedValue(sheet, 1, 1, 1, 7, divisionName + ' Expense', '#FFFF00', '#000000', 'center', true);
  setMergedValue(sheet, 2, 1, 1, 7, 'Tanzeem Name: Sector', '#FFFF00', '#000000', 'left', true);
  setMergedValue(sheet, 3, 1, 1, 4, 'Report: ' + sectorName, '#FFFF00', '#000000', 'left', true);
  setMergedValue(sheet, 3, 5, 1, 2, month, '#FFFF00', '#000000', 'center', true);
  setMergedValue(sheet, 4, 1, 1, 7, 'Sect Finance: ' + secretaryName, '#FFFF00', '#000000', 'left', true);

  const headers = ['S No', 'Recipt No', 'Event', 'Date', 'Total Amount', 'Remarks', 'Paid by'];
  sheet.getRange(5, 1, 1, 7).setValues([headers]).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(5, 3).setFontColor('#0070C0');
  sheet.getRange(5, 4).setFontColor('#00B050');
  sheet.getRange(5, 5).setFontColor('#FF0000');
  sheet.getRange(5, 6).setFontColor('#7030A0');

  let total = 0;
  const detailRows = Math.max(expenses.length, 27);
  for (let i = 0; i < detailRows; i++) {
    const expense = expenses[i] || {};
    const amount = Number(expense['Amount']) || 0;
    total += amount;
    sheet.getRange(6 + i, 1, 1, 7).setValues([[
      i + 1,
      expense['Receipt No'] || 0,
      expense['Description'] || expense['Category'] || '',
      expense['Date'] || '',
      amount || '',
      expense['Remarks'] || '',
      expense['Paid By'] || ''
    ]]);
  }

  const totalRow = 6 + detailRows;
  setMergedValue(sheet, totalRow, 3, 1, 2, 'Total Expense', '#FFFF00', '#FF0000', 'center', true);
  sheet.getRange(totalRow, 5).setValue(total).setBackground('#FFFF00').setFontColor('#FF0000').setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat('#,##0');
  sheet.getRange(1, 1, totalRow, 7).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  sheet.setFrozenRows(5);
  sheet.setColumnWidths(1, 1, 42);
  sheet.setColumnWidths(2, 1, 78);
  sheet.setColumnWidths(3, 1, 150);
  sheet.setColumnWidths(4, 1, 108);
  sheet.setColumnWidths(5, 1, 106);
  sheet.setColumnWidths(6, 1, 92);
  sheet.setColumnWidths(7, 1, 74);
}

function getMemberCategoryKey(member) {
  const category = String(member['Member Category'] || '').toLowerCase();
  const matched = MEMBER_CATEGORIES.find(item => category.indexOf(item.match) !== -1);
  return matched ? matched.key : 'FM';
}

function setMergedValue(sheet, row, col, numRows, numCols, value, bg, fg, align, bold) {
  const range = sheet.getRange(row, col, numRows, numCols);
  if (numRows > 1 || numCols > 1) range.merge();
  range.setValue(value)
    .setBackground(bg)
    .setFontColor(fg)
    .setHorizontalAlignment(align || 'left')
    .setVerticalAlignment('middle')
    .setFontWeight(bold ? 'bold' : 'normal');
  return range;
}

// ----------------------------------------------------------------------------
// Member History — search all month sheets for a member by name
// ----------------------------------------------------------------------------

function getMemberHistory(name, phone) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets()
    .filter(s => s.getName() !== 'Settings' && s.getName() !== 'Expenses' && !isReportSheetName(s.getName()));

  const allRecords = [];
  const searchName = String(name || '').trim().toLowerCase();
  if (!searchName) return [];

  sheets.forEach(sheet => {
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) return;
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    // If header row is empty, skip
    if (!headers[0]) return;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    data.forEach((row, i) => {
      const rowName = String(row[0] || '').trim().toLowerCase();
      if (rowName !== searchName) return;

      const obj = { month: sheet.getName(), _rowId: i + 2 };
      headers.forEach((h, j) => { obj[h] = row[j]; });
      allRecords.push(obj);
    });
  });

  return allRecords;
}

// ----------------------------------------------------------------------------
// Settings Operations
// ----------------------------------------------------------------------------

function getSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Settings');

  if (!sheet) {
    sheet = ss.insertSheet('Settings');
    sheet.appendRow(['Key', 'Value']);
    sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
    return {};
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const settings = {};
  data.forEach(row => {
    settings[row[0]] = row[1];
  });

  return settings;
}

function saveSettings(settingsObj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Settings');

  if (!sheet) {
    sheet = ss.insertSheet('Settings');
    sheet.appendRow(['Key', 'Value']);
    sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  } else {
    // Clear existing settings
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 2).clearContent();
    }
  }

  const rows = Object.keys(settingsObj).map(key => [key, settingsObj[key]]);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  }

  return true;
}
