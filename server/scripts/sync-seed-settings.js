require('dotenv').config();

const sheets = require('../services/sheets');
const finance = require('../services/finance-db');
const db = require('../services/db');
const { getSettingsDefaults } = require('../services/settings-defaults');

async function main() {
  const storedSettings = await sheets.getSettings();
  const effectiveSettings = { ...getSettingsDefaults(), ...storedSettings };
  await finance.saveSettings(effectiveSettings);
  const persisted = await finance.getSettings();
  const required = ['ORG_NAME', 'SPECIAL_FUND_CAMPAIGN_ID', 'SPECIAL_FUND_MESSAGE_TEMPLATE'];
  required.forEach((key) => {
    if (persisted[key] === undefined || persisted[key] === '') throw new Error(`Seed setting was not persisted: ${key}`);
  });
  console.log(JSON.stringify({ synced: true, settingKeys: Object.keys(persisted).length, campaign: true }));
}

main().catch((error) => {
  console.error(`Seed settings sync failed: ${error.message}`);
  process.exitCode = 1;
}).finally(() => db.closePool());
