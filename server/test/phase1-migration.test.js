const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migration = require('../scripts/migrate-from-sheets');
const backup = require('../services/sheets-backup');

test('Sheets migration snapshot inventories all legacy data without writing', async () => {
  const source = {
    getSheets: async () => ['August 2026', 'September 2026'],
    getSettings: async () => ({ ORG_NAME: 'North Sector', SPECIAL_FUND_CAMPAIGN_ID: 'eid-2026' }),
    getSheetData: async (month) => [{ Name: 'Member One', 'Phone Number': '0300-1111111', Month: month }],
    getFollowUps: async (month) => [{ Month: month, 'Member Name': 'Member One' }],
    getExpenses: async () => [{ Month: 'September 2026', Amount: 500 }],
    getSpecialFundContributions: async () => [{ 'Member Name': 'Member One', 'Amount Paid': 250 }],
  };
  const snapshot = await migration.collectSnapshot(source);
  const report = migration.summarize(snapshot);
  assert.deepEqual(report, {
    sector: 'North Sector', months: 2, members: 1, payments: 2,
    expenses: 1, followUps: 2, contributions: 1, settings: 14, collisions: [],
  });
});

test('migration reports ambiguous phone identities and aborts before transaction', async () => {
  const snapshot = {
    sectorName: 'Sector', settings: {}, expenses: [], followUps: [], contributions: [],
    months: [{ name: 'Month', rows: [
      { Name: 'First Name', 'Phone Number': '0300 1234567' },
      { Name: 'Different Name', 'Phone Number': '03001234567' },
    ] }],
  };
  let transactionStarted = false;
  await assert.rejects(
    migration.importSnapshot(snapshot, { withTransaction: async () => { transactionStarted = true; } }),
    /ambiguous member identity collision/i,
  );
  assert.equal(transactionStarted, false);
});

test('migration accepts designation and category changes for the same named phone identity', () => {
  const snapshot = {
    sectorName: 'Sector', settings: {}, expenses: [], followUps: [], contributions: [],
    months: [{ name: 'First', rows: [
      { Name: 'Member One', 'Phone Number': '0300 1234567', Designation: 'Member', 'Member Category': 'FM' },
    ] }, { name: 'Second', rows: [
      { Name: ' Member   One ', 'Phone Number': '03001234567', Designation: 'Secretary', 'Member Category': 'SC' },
    ] }],
  };
  assert.deepEqual(migration.summarize(snapshot).collisions, []);
});

test('migration count verification fails closed before transaction commit', () => {
  const expected = { months: 2, members: 3, payments: 6, expenses: 1, followUps: 2, contributions: 1 };
  assert.doesNotThrow(() => migration.assertEntityCounts(expected, { ...expected }));
  assert.throws(
    () => migration.assertEntityCounts(expected, { ...expected, payments: 5 }),
    /expected 6, found 5/,
  );
});

test('one-way Sheets backup is built from Postgres-shaped finance reads', async () => {
  const finance = {
    getSheets: async () => ['September 2026'],
    getSettings: async () => ({ SPECIAL_FUND_CAMPAIGN_ID: 'campaign-1', ORG_NAME: 'Sector' }),
    getExpenses: async () => [{ _rowId: 8, Month: 'September 2026', Amount: 100 }],
    getSheetData: async () => [{ _rowId: 4, Name: 'Member One', 'Amount Paid': 500 }],
    getFollowUps: async () => [{ _rowId: 6, Month: 'September 2026', 'Member Name': 'Member One' }],
    getSpecialFundContributions: async () => [{ _rowId: 9, 'Member Name': 'Member One', 'Amount Paid': 200 }],
  };
  const snapshot = await backup.buildBackupSnapshot(finance);
  assert.deepEqual(snapshot.sheets.find((item) => item.name === 'DBBackup_Months').rows, [['September 2026']]);
  assert.equal(snapshot.sheets.find((item) => item.name === 'DBBackup_Payments').rows.length, 1);
  assert.deepEqual(snapshot.sheets.find((item) => item.name === 'DBBackup_Payments').headers, ['Month', 'Name', 'Amount Paid']);
  assert.equal(snapshot.sheets.find((item) => item.name === 'DBBackup_Settings').rows.length, 2);
});

test('one-way Sheets backup rejects a destination row-count mismatch', async () => {
  const finance = {
    getSheets: async () => [], getSettings: async () => ({}), getExpenses: async () => [],
  };
  await assert.rejects(
    backup.exportBackup(finance, { replaceBackupSnapshot: async () => ({ rowCounts: {} }) }),
    /Sheets backup verification failed/,
  );
});

test('Apps Script exposes a backup-only snapshot action', () => {
  const code = fs.readFileSync(path.join(__dirname, '../../apps-script/Code.gs'), 'utf8');
  assert.match(code, /case 'replaceBackupSnapshot'/);
  assert.match(code, /\^DBBackup_/);
  assert.match(code, /sheet\.clearContents\(\)/);
});

test('Apps Script requests have a bounded timeout', () => {
  const code = fs.readFileSync(path.join(__dirname, '../services/sheets.js'), 'utf8');
  assert.match(code, /AbortSignal\.timeout\(APPS_SCRIPT_TIMEOUT_MS\)/);
});

test('live finance routes use Postgres and never import the legacy Sheets service', () => {
  const routesDirectory = path.join(__dirname, '../routes');
  const financeRoutes = ['ai.js', 'diagnostics.js', 'expenses.js', 'export.js', 'followups.js',
    'members.js', 'months.js', 'payments.js', 'settings.js', 'special-fund.js'];
  financeRoutes.forEach((file) => {
    const code = fs.readFileSync(path.join(routesDirectory, file), 'utf8');
    assert.match(code, /services\/finance-db/);
    assert.doesNotMatch(code, /services\/sheets['"]/);
  });
});

test('migration CLI closes the shared Postgres pool through its public API', () => {
  const code = fs.readFileSync(path.join(__dirname, '../scripts/migrate-from-sheets.js'), 'utf8');
  assert.match(code, /db\.closePool\(\)/);
  assert.doesNotMatch(code, /db\.close\(\)/);
});

test('special-fund routes accept Postgres identity value one', () => {
  const code = fs.readFileSync(path.join(__dirname, '../routes/special-fund.js'), 'utf8');
  assert.doesNotMatch(code, /rowId < 2/);
  assert.match(code, /rowId < 1/);
});
