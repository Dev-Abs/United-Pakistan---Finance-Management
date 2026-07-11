// Native fetch is available in Node 18+

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

  getExpenses: (month) => gasRequest('getExpenses', { month }),

  addExpense: (data) => gasRequest('addExpense', { data }),

  updateExpense: (rowId, data) => gasRequest('updateExpense', { rowId, data }),

  deleteExpense: (rowId) => gasRequest('deleteExpense', { rowId }),

  getMemberHistory: (name, phone) => gasRequest('getMemberHistory', { name, phone }),

  getFollowUps: (month) => gasRequest('getFollowUps', { month }),

  getMemberFollowUps: (month, name, phone) => gasRequest('getMemberFollowUps', { month, name, phone }),

  addFollowUp: (data) => gasRequest('addFollowUp', { data }),

  getSettings: () => gasRequest('getSettings'),

  saveSettings: (data) => gasRequest('saveSettings', { data })
};

module.exports = sheetsService;
