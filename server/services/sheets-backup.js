const finance = require('./finance-db');
const sheets = require('./sheets');

function table(name, rows) {
  const normalized = rows || [];
  const headers = normalized.length ? Object.keys(normalized[0]).filter((key) => key !== '_rowId') : [];
  return {
    name,
    headers,
    rows: normalized.map((row) => headers.map((header) => row[header] ?? '')),
  };
}

async function buildBackupSnapshot(financeService = finance, sectorId) {
  const [months, settings, expenses] = await Promise.all([
    financeService.getSheets(sectorId),
    financeService.getSettings(sectorId),
    financeService.getExpenses(null, sectorId),
  ]);
  const monthly = await Promise.all(months.map(async (month) => ({
    month,
    members: await financeService.getSheetData(month, sectorId),
    followUps: await financeService.getFollowUps(month, sectorId),
  })));
  const campaignId = settings.SPECIAL_FUND_CAMPAIGN_ID;
  const contributions = campaignId
    ? await financeService.getSpecialFundContributions(campaignId, sectorId)
    : [];
  const payments = monthly.flatMap(({ month, members }) => members.map((row) => ({ Month: month, ...row })));
  const followUps = monthly.flatMap(({ followUps: rows }) => rows);
  const settingRows = Object.entries(settings).map(([Key, Value]) => ({
    Key,
    Value: typeof Value === 'string' ? Value : JSON.stringify(Value),
  }));
  return {
    generatedAt: new Date().toISOString(),
    sheets: [
      table('DBBackup_Months', months.map((Name) => ({ Name }))),
      table('DBBackup_Payments', payments),
      table('DBBackup_Expenses', expenses),
      table('DBBackup_FollowUps', followUps),
      table('DBBackup_SpecialFund', contributions),
      table('DBBackup_Settings', settingRows),
    ],
  };
}

async function exportBackup(financeService = finance, sheetsService = sheets, sectorId) {
  const snapshot = await buildBackupSnapshot(financeService, sectorId);
  const result = await sheetsService.replaceBackupSnapshot(snapshot);
  const counts = Object.fromEntries(snapshot.sheets.map((item) => [item.name, item.rows.length]));
  for (const [name, count] of Object.entries(counts)) {
    if (Number(result?.rowCounts?.[name]) !== count) {
      throw new Error(`Sheets backup verification failed for ${name}: expected ${count}, wrote ${result?.rowCounts?.[name] ?? 'unknown'}`);
    }
  }
  return {
    generatedAt: snapshot.generatedAt,
    counts,
    destination: result,
  };
}

module.exports = { buildBackupSnapshot, exportBackup, table };
