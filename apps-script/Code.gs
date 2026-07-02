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
      case 'getSettings':
        result = getSettings();
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
// Sheet Operations
// ----------------------------------------------------------------------------

function getSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheets()
    .map(sheet => sheet.getName())
    .filter(name => name !== 'Settings');
}

function getHeaders(sheet) {
  const range = sheet.getRange(1, 1, 1, sheet.getLastColumn());
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
  const rowData = headers.map(header => data[header] !== undefined ? data[header] : '');
  
  // Set defaults for some fields if not provided
  if (!data['Payment Status']) {
     const statusIdx = headers.indexOf('Payment Status');
     if(statusIdx !== -1) rowData[statusIdx] = 'Pending';
  }
  if (!data['Amount Paid']) {
     const amountIdx = headers.indexOf('Amount Paid');
     if(amountIdx !== -1) rowData[amountIdx] = 0;
  }

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

function createMonthSheet(newSheetName, carryBalances) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (ss.getSheetByName(newSheetName)) {
    throw new Error('Sheet already exists for this month');
  }

  const sheets = ss.getSheets();
  const dataSheets = sheets.filter(s => s.getName() !== 'Settings');
  
  if (dataSheets.length === 0) {
    // Creating first sheet
    const newSheet = ss.insertSheet(newSheetName);
    const headers = ['Name', 'Phone Number', 'Designation', 'Monthly Fund', 'Previous Balance', 'Total Payable', 'Amount Paid', 'Remaining Balance', 'Payment Status', 'Payment Date', 'Receipt Link', 'Remarks'];
    newSheet.appendRow(headers);
    newSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    return true;
  }

  // Duplicate last sheet
  const lastSheet = dataSheets[dataSheets.length - 1];
  const newSheet = lastSheet.copyTo(ss);
  newSheet.setName(newSheetName);

  if (carryBalances) {
    const lastRow = newSheet.getLastRow();
    const headers = getHeaders(newSheet);
    
    const remainingIdx = headers.indexOf('Remaining Balance');
    const prevBalIdx = headers.indexOf('Previous Balance');
    const amountPaidIdx = headers.indexOf('Amount Paid');
    const paymentDateIdx = headers.indexOf('Payment Date');
    const receiptLinkIdx = headers.indexOf('Receipt Link');
    const statusIdx = headers.indexOf('Payment Status');
    const remarksIdx = headers.indexOf('Remarks');
    const totalPayableIdx = headers.indexOf('Total Payable');
    const monthlyFundIdx = headers.indexOf('Monthly Fund');

    if (lastRow > 1) {
      const dataRange = newSheet.getRange(2, 1, lastRow - 1, headers.length);
      const data = dataRange.getValues();
      
      const newData = data.map(row => {
        // Carry over remaining to previous balance
        const remaining = remainingIdx !== -1 ? (Number(row[remainingIdx]) || 0) : 0;
        if (prevBalIdx !== -1) row[prevBalIdx] = remaining;
        
        // Reset fields
        if (amountPaidIdx !== -1) row[amountPaidIdx] = 0;
        if (paymentDateIdx !== -1) row[paymentDateIdx] = '';
        if (receiptLinkIdx !== -1) row[receiptLinkIdx] = '';
        if (statusIdx !== -1) row[statusIdx] = 'Pending';
        if (remarksIdx !== -1) row[remarksIdx] = '';
        
        // Recalculate Total Payable
        const monthlyFund = monthlyFundIdx !== -1 ? (Number(row[monthlyFundIdx]) || 0) : 0;
        if (totalPayableIdx !== -1) row[totalPayableIdx] = monthlyFund + remaining;
        
        // Recalculate Remaining Balance
        if (remainingIdx !== -1) row[remainingIdx] = row[totalPayableIdx]; // since amount paid is 0
        
        return row;
      });
      
      dataRange.setValues(newData);
    }
  }

  return true;
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
