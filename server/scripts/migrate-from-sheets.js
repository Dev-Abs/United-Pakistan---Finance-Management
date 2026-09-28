require('dotenv').config();

const sheets = require('../services/sheets');
const db = require('../services/db');
const { _test: financeTest } = require('../services/finance-db');
const { getSettingsDefaults } = require('../services/settings-defaults');

function string(value, fallback = '') {
  return value == null ? fallback : String(value).trim();
}

function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullable(value) {
  return string(value) || null;
}

function slugify(value) {
  return string(value, 'default-sector').toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'default-sector';
}

function memberKey(row) {
  const phone = string(row['Phone Number']).replace(/\D/g, '');
  if (phone) return `phone:${phone}`;
  return ['identity', row.Name, row.Designation, row['Member Category']]
    .map((part) => string(part).toLowerCase()).join(':');
}

function summarize(snapshot) {
  const members = new Map();
  const collisions = [];
  for (const month of snapshot.months) {
    for (const row of month.rows) {
      const key = memberKey(row);
      // A member's designation/category can legitimately change month to month.
      // A reused phone number becomes ambiguous only when it points to a different name.
      const identity = string(row.Name).replace(/\s+/g, ' ').toLowerCase();
      if (members.has(key) && members.get(key).identity !== identity) {
        collisions.push({ key, first: members.get(key).name, conflicting: string(row.Name), month: month.name });
      } else if (!members.has(key)) {
        members.set(key, { identity, name: string(row.Name) });
      }
    }
  }
  return {
    sector: snapshot.sectorName,
    months: snapshot.months.length,
    members: members.size,
    payments: snapshot.months.reduce((sum, month) => sum + month.rows.length, 0),
    expenses: snapshot.expenses.length,
    followUps: snapshot.followUps.length,
    contributions: snapshot.contributions.length,
    settings: Object.keys(snapshot.settings).length,
    collisions,
  };
}

function expectedEntityCounts(report) {
  return {
    months: report.months,
    members: report.members,
    payments: report.payments,
    expenses: report.expenses,
    followUps: report.followUps,
    contributions: report.contributions,
  };
}

async function readEntityCounts(client, sectorId) {
  const result = await client.query(`
    select
      (select count(*)::int from months where sector_id=$1) as months,
      (select count(*)::int from members where sector_id=$1) as members,
      (select count(*)::int from monthly_payments where sector_id=$1) as payments,
      (select count(*)::int from expenses where sector_id=$1) as expenses,
      (select count(*)::int from follow_ups where sector_id=$1) as "followUps",
      (select count(*)::int from special_fund_contributions where sector_id=$1) as contributions
  `, [sectorId]);
  return result.rows[0];
}

function assertEntityCounts(expected, actual) {
  for (const [name, count] of Object.entries(expected)) {
    if (Number(actual[name]) !== count) {
      throw new Error(`Migration verification failed for ${name}: expected ${count}, found ${actual[name]}`);
    }
  }
}

async function collectSnapshot(source = sheets) {
  const [monthNames, storedSettings] = await Promise.all([source.getSheets(), source.getSettings()]);
  const settings = { ...getSettingsDefaults(), ...storedSettings };
  const months = await Promise.all(monthNames.map(async (name) => ({ name, rows: await source.getSheetData(name) })));
  const followUpGroups = await Promise.all(monthNames.map(async (name) => source.getFollowUps(name).catch(() => [])));
  const campaignId = settings.SPECIAL_FUND_CAMPAIGN_ID;
  const [expenses, contributions] = await Promise.all([
    source.getExpenses(),
    campaignId ? source.getSpecialFundContributions(campaignId).catch(() => []) : [],
  ]);
  return {
    sectorName: string(
      storedSettings.ORG_NAME || storedSettings.SECTOR_NAME || storedSettings.ORGANIZATION_NAME
        || settings.ORG_NAME || settings.SECTOR_NAME || settings.ORGANIZATION_NAME,
      'United Pakistan',
    ),
    months,
    expenses,
    followUps: followUpGroups.flat(),
    contributions,
    settings,
  };
}

async function importSnapshot(snapshot, database = db) {
  const report = summarize(snapshot);
  if (report.collisions.length) {
    throw new Error(`Migration stopped: ${report.collisions.length} ambiguous member identity collision(s)`);
  }

  return database.withTransaction(async (client) => {
    const slug = slugify(snapshot.sectorName);
    const existing = await client.query('select id from sectors where slug=$1', [slug]);
    if (existing.rowCount) throw new Error(`Migration target sector already exists: ${slug}`);
    const sectorResult = await client.query(
      'insert into sectors (name, slug) values ($1,$2) returning id',
      [snapshot.sectorName, slug],
    );
    const sectorId = sectorResult.rows[0].id;
    const monthIds = new Map();
    const memberIds = new Map();

    for (const month of snapshot.months) {
      const insertedMonth = await client.query(
        'insert into months (sector_id, name) values ($1,$2) returning id',
        [sectorId, month.name],
      );
      monthIds.set(string(month.name).toLowerCase(), insertedMonth.rows[0].id);
      for (const row of month.rows) {
        const key = memberKey(row);
        let memberId = memberIds.get(key);
        if (!memberId) {
          const insertedMember = await client.query(`
            insert into members (sector_id, name, phone_number, designation, member_category)
            values ($1,$2,$3,$4,$5) returning id
          `, [sectorId, string(row.Name), string(row['Phone Number']), string(row.Designation),
            string(row['Member Category'], 'Fellow Member (FM)')]);
          memberId = insertedMember.rows[0].id;
          memberIds.set(key, memberId);
        }
        await client.query(`
          insert into monthly_payments (
            sector_id, month_id, member_id, monthly_fund, previous_balance,
            total_payable, amount_paid, remaining_balance, payment_status,
            payment_date, receipt_link, remarks, receipt_no, increment, special_fund, recovery
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        `, [sectorId, insertedMonth.rows[0].id, memberId, amount(row['Monthly Fund']),
          amount(row['Previous Balance']), amount(row['Total Payable']), amount(row['Amount Paid']),
          amount(row['Remaining Balance']), string(row['Payment Status'], 'Pending'),
          nullable(row['Payment Date']), string(row['Receipt Link']), string(row.Remarks),
          string(row['Receipt No']), amount(row.Increment), amount(row['Special Fund']), amount(row.Recovery)]);
      }
    }

    for (const row of snapshot.expenses) {
      const monthId = monthIds.get(string(row.Month).toLowerCase());
      if (!monthId) throw new Error(`Expense references an unknown month: ${row.Month}`);
      await client.query(`
        insert into expenses (sector_id, month_id, expense_date, category, description, amount, paid_by, remarks)
        values ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [sectorId, monthId, nullable(row.Date), string(row.Category), string(row.Description),
        amount(row.Amount), string(row['Paid By']), string(row.Remarks)]);
    }

    for (const row of snapshot.followUps) {
      const monthId = monthIds.get(string(row.Month).toLowerCase());
      if (!monthId) throw new Error(`Follow-up references an unknown month: ${row.Month}`);
      const memberId = memberIds.get(memberKey({ Name: row['Member Name'], 'Phone Number': row['Phone Number'], 'Member Category': row['Member Category'] })) || null;
      await client.query(`
        insert into follow_ups (
          sector_id, month_id, member_id, member_name, phone_number, member_category,
          event_type, reminder_number, event_date, reply_status, reason_reply,
          next_reminder_date, created_by, notes
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      `, [sectorId, monthId, memberId, string(row['Member Name']), string(row['Phone Number']),
        string(row['Member Category']), string(row['Event Type'], 'Note'),
        row['Reminder Number'] === '' || row['Reminder Number'] == null ? null : Number(row['Reminder Number']),
        nullable(row['Event Date']), string(row['Reply Status']), string(row['Reason / Reply']),
        nullable(row['Next Reminder Date']), string(row['Created By']), string(row.Notes)]);
    }

    const campaignKey = string(snapshot.settings.SPECIAL_FUND_CAMPAIGN_ID);
    let campaignId = null;
    if (campaignKey) {
      const campaign = await client.query(`
        insert into special_fund_campaigns (
          sector_id, campaign_key, name, event_timing, event_venue, jp_minimum, sc_minimum, fm_minimum
        ) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id
      `, [sectorId, campaignKey, string(snapshot.settings.SPECIAL_FUND_CAMPAIGN_NAME),
        string(snapshot.settings.SPECIAL_FUND_EVENT_TIMING), string(snapshot.settings.SPECIAL_FUND_EVENT_VENUE),
        amount(snapshot.settings.SPECIAL_FUND_JP_MINIMUM), amount(snapshot.settings.SPECIAL_FUND_SC_MINIMUM),
        amount(snapshot.settings.SPECIAL_FUND_FM_MINIMUM)]);
      campaignId = campaign.rows[0].id;
    }

    for (const row of snapshot.contributions) {
      if (!campaignId) throw new Error('Contribution data exists without a campaign ID');
      const memberId = memberIds.get(memberKey({ Name: row['Member Name'], 'Phone Number': row['Phone Number'], 'Member Category': row['Member Category'] })) || null;
      await client.query(`
        insert into special_fund_contributions (
          sector_id, campaign_id, member_id, member_name, phone_number, member_category,
          minimum_amount, amount_paid, payment_date, receipt_link, remarks, recorded_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,coalesce($12::timestamptz,now()))
      `, [sectorId, campaignId, memberId, string(row['Member Name']), string(row['Phone Number']),
        string(row['Member Category']), amount(row['Minimum Amount']), amount(row['Amount Paid']),
        nullable(row['Payment Date']), string(row['Receipt Link']), string(row.Remarks), nullable(row['Recorded At'])]);
    }

    for (const [key, value] of Object.entries(snapshot.settings)) {
      if (financeTest.TEMPLATE_KEYS.has(key)) {
        await client.query('insert into message_templates (sector_id, template_key, content) values ($1,$2,$3)', [sectorId, key, string(value)]);
      } else if (!financeTest.CAMPAIGN_FIELDS[key]) {
        await client.query('insert into settings (sector_id, setting_key, setting_value) values ($1,$2,$3::jsonb)', [sectorId, key, JSON.stringify(value)]);
      }
    }

    const expectedCounts = expectedEntityCounts(report);
    const verifiedCounts = await readEntityCounts(client, sectorId);
    assertEntityCounts(expectedCounts, verifiedCounts);
    return { ...report, sectorId, slug, verifiedCounts };
  });
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const snapshot = await collectSnapshot();
  const report = summarize(snapshot);
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, ...report }, null, 2));
    return;
  }
  if (!process.argv.includes('--commit')) {
    throw new Error('Refusing to write without --commit. Run --dry-run first.');
  }
  const result = await importSnapshot(snapshot);
  console.log(JSON.stringify({ dryRun: false, imported: true, ...result }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  }).finally(() => db.closePool());
}

module.exports = {
  collectSnapshot,
  importSnapshot,
  summarize,
  memberKey,
  slugify,
  expectedEntityCounts,
  assertEntityCounts,
};
