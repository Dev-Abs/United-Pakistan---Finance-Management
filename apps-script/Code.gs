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
    'Name': 160, 'Phone Number': 130, 'Designation': 130,
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
}

// ----------------------------------------------------------------------------
// Sheet Operations
// ----------------------------------------------------------------------------

function getSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheets()
    .map(sheet => sheet.getName())
    .filter(name => name !== 'Settings' && name !== 'Expenses');
}

function getHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    // Inject default headers if sheet is empty
    const headers = ['Name', 'Phone Number', 'Designation', 'Monthly Fund', 'Previous Balance', 'Total Payable', 'Amount Paid', 'Remaining Balance', 'Payment Status', 'Payment Date', 'Receipt Link', 'Remarks'];
    sheet.appendRow(headers);
    applySheetFormatting(sheet, headers);
    return headers;
  }
  const range = sheet.getRange(1, 1, 1, lastCol);
  return range.getValues()[0];
}

function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    // If sheet doesn't exist, maybe it's a new month. We can create it empty if needed,
    // but better to throw error and let user create it explicitly.
    throw new Error('Sheet not found: ' + sheetName);
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2) return [];

  const headers = getHeaders(sheet);
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

  const totalPayable = data['Total Payable'] !== undefined ? data['Total Payable'] : 0;
  applyPaymentStatusLogic(data, data['Payment Status'], totalPayable);

  const rowData = headers.map(header => data[header] !== undefined ? data[header] : '');

  sheet.appendRow(rowData);
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
  return true;
}

function deleteRow(sheetName, rowId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found');

  sheet.deleteRow(rowId);
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
  return { _rowId: sheet.getLastRow() };
}

function updateExpense(rowId, data) {
  const sheet = getOrCreateExpensesSheet();
  const range = sheet.getRange(rowId, 1, 1, EXPENSE_HEADERS.length);
  const currentRowData = range.getValues()[0];
  const newRowData = EXPENSE_HEADERS.map((header, index) => {
    return data[header] !== undefined ? data[header] : currentRowData[index];
  });
  range.setValues([newRowData]);
  return true;
}

function deleteExpense(rowId) {
  const sheet = getOrCreateExpensesSheet();
  sheet.deleteRow(rowId);
  return true;
}

// ----------------------------------------------------------------------------
// Member History — search all month sheets for a member by name
// ----------------------------------------------------------------------------

function getMemberHistory(name, phone) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets()
    .filter(s => s.getName() !== 'Settings' && s.getName() !== 'Expenses');

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
