const fetch = require('node-fetch'); // We might need to use built-in fetch in Node 18+ or install node-fetch. Since Node 18+ has native fetch, we will just use global fetch.

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const APPS_SCRIPT_SECRET = process.env.APPS_SCRIPT_SECRET;

async function gasRequest(action, params = {}) {
  const payload = {
    secret: APPS_SCRIPT_SECRET,
    action,
    ...params
  };

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`GAS request failed: ${response.statusText}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Unknown error from GAS');
  }

  return result.data;
}

const sheetsService = {
  getSheets: () => gasRequest('getSheets'),
  
  getSheetData: (sheetName) => gasRequest('getSheet', { sheetName }),
  
  addMember: (sheetName, data) => gasRequest('appendRow', { sheetName, data }),
  
  updateMember: (sheetName, rowId, data) => gasRequest('updateRow', { sheetName, rowId, data }),
  
  deleteMember: (sheetName, rowId) => gasRequest('deleteRow', { sheetName, rowId }),
  
  createMonthSheet: (newSheetName, carryBalances) => gasRequest('createMonthSheet', { newSheetName, carryBalances }),
  
  getSettings: () => gasRequest('getSettings'),
  
  saveSettings: (data) => gasRequest('saveSettings', { data })
};

module.exports = sheetsService;
