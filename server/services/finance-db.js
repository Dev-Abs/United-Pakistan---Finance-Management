const db = require('./db');

const TEMPLATE_KEYS = new Set([
  'WHATSAPP_MEMBER_TEMPLATE',
  'WHATSAPP_REPORT_TEMPLATE',
  'WHATSAPP_MONTHLY_REPORT_TEMPLATE',
  'SPECIAL_FUND_MESSAGE_TEMPLATE',
  'SPECIAL_FUND_REPORT_TEMPLATE',
  'AI_REPORT_TEMPLATE',
  'AI_MESSAGE_TEMPLATE',
]);

const CAMPAIGN_FIELDS = {
  SPECIAL_FUND_CAMPAIGN_ID: 'campaign_key',
  SPECIAL_FUND_CAMPAIGN_NAME: 'name',
  SPECIAL_FUND_EVENT_TIMING: 'event_timing',
  SPECIAL_FUND_EVENT_VENUE: 'event_venue',
  SPECIAL_FUND_JP_MINIMUM: 'jp_minimum',
  SPECIAL_FUND_SC_MINIMUM: 'sc_minimum',
  SPECIAL_FUND_FM_MINIMUM: 'fm_minimum',
};

const MONTH_MATCH = `
  lower(regexp_replace(btrim(name), '\\s+', ' ', 'g')) =
  lower(regexp_replace(btrim($2), '\\s+', ' ', 'g'))
`;

function text(value, fallback = '') {
  return value == null ? fallback : String(value);
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableDate(value) {
  const cleaned = text(value).trim();
  return cleaned || null;
}

function paymentValues(data, current = {}) {
  const result = {
    monthlyFund: number(data['Monthly Fund'], number(current.monthlyFund)),
    previousBalance: number(data['Previous Balance'], number(current.previousBalance)),
    totalPayable: number(data['Total Payable'], number(current.totalPayable)),
    amountPaid: number(data['Amount Paid'], number(current.amountPaid)),
    remainingBalance: number(data['Remaining Balance'], number(current.remainingBalance)),
    paymentStatus: text(data['Payment Status'], current.paymentStatus || 'Pending'),
    paymentDate: data['Payment Date'] !== undefined ? nullableDate(data['Payment Date']) : (current.paymentDate || null),
    receiptLink: text(data['Receipt Link'], current.receiptLink || ''),
    remarks: text(data.Remarks, current.remarks || ''),
    receiptNo: text(data['Receipt No'], current.receiptNo || ''),
    increment: number(data.Increment, number(current.increment)),
    specialFund: number(data['Special Fund'], number(current.specialFund)),
    recovery: number(data.Recovery, number(current.recovery)),
  };

  const touchesPayment = data['Payment Status'] !== undefined
    || data['Amount Paid'] !== undefined
    || data['Total Payable'] !== undefined;
  if (touchesPayment) {
    if (result.paymentStatus === 'Paid') {
      result.amountPaid = result.totalPayable;
      result.remainingBalance = 0;
    } else if (result.paymentStatus === 'Partially Paid') {
      if (data['Amount Paid'] === undefined && current.amountPaid === undefined) {
        throw new Error('Amount Paid is required when Payment Status is Partially Paid');
      }
      result.remainingBalance = result.totalPayable - result.amountPaid;
    } else if (result.paymentStatus === 'Pending') {
      result.amountPaid = 0;
      result.remainingBalance = result.totalPayable;
    }
  }

  return result;
}

function createFinanceService(database = db) {
  function normalizeSectorContext(explicitSectorId, context) {
    if (context && typeof context === 'object' && !Array.isArray(context)) {
      return { sectorId: context.sectorId, role: context.role, useTransaction: true };
    }
    return { sectorId: explicitSectorId, role: undefined, useTransaction: false };
  }

  async function withFinanceTransaction(context, callback) {
    if (context && context.useTransaction && typeof database.withSectorTransaction === 'function') {
      return database.withSectorTransaction({ sectorId: context.sectorId, role: context.role }, callback);
    }
    if (!context || !context.useTransaction) {
      if (typeof database.withTransaction === 'function') return database.withTransaction(callback);
      return callback(database);
    }
    return database.withTransaction(callback);
  }

  async function sectorId(target = database, explicitSectorId) {
    if (explicitSectorId !== undefined && explicitSectorId !== null) {
      const parsed = Number(explicitSectorId);
      if (!Number.isInteger(parsed) || parsed <= 0) throw new Error('Invalid sector');
      return parsed;
    }
    const result = await target.query('select id from sectors where active = true order by id limit 2');
    if (result.rowCount === 0) throw new Error('No active sector is configured');
    if (result.rowCount > 1) throw new Error('A sector context is required');
    return Number(result.rows[0].id);
  }

  async function monthRow(target, resolvedSectorId, monthName) {
    const result = await target.query(
      `select id, name from months where sector_id = $1 and ${MONTH_MATCH} limit 1`,
      [resolvedSectorId, text(monthName).trim()],
    );
    if (!result.rowCount) throw new Error(`Month not found: ${monthName}`);
    return result.rows[0];
  }

  async function getSheets(explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
    const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
    const result = await client.query(
      'select name from months where sector_id = $1 order by id',
      [resolvedSectorId],
    );
    return result.rows.map((row) => row.name);
    });
  }

  async function getSheetData(monthName, explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
    const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
    const month = await monthRow(client, resolvedSectorId, monthName);
    const result = await client.query(`
      select
        mp.id::int as "_rowId",
        m.name as "Name",
        m.phone_number as "Phone Number",
        m.designation as "Designation",
        m.member_category as "Member Category",
        mp.monthly_fund::float8 as "Monthly Fund",
        mp.previous_balance::float8 as "Previous Balance",
        mp.total_payable::float8 as "Total Payable",
        mp.amount_paid::float8 as "Amount Paid",
        mp.remaining_balance::float8 as "Remaining Balance",
        mp.payment_status as "Payment Status",
        to_char(mp.payment_date, 'YYYY-MM-DD') as "Payment Date",
        mp.receipt_link as "Receipt Link",
        mp.remarks as "Remarks",
        mp.receipt_no as "Receipt No",
        mp.increment::float8 as "Increment",
        mp.special_fund::float8 as "Special Fund",
        mp.recovery::float8 as "Recovery"
      from monthly_payments mp
      join members m on m.id = mp.member_id and m.sector_id = mp.sector_id
      where mp.sector_id = $1 and mp.month_id = $2
      order by mp.id
    `, [resolvedSectorId, month.id]);
    return result.rows;
    });
  }

  async function addMember(monthName, data, explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
      const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
      const month = await monthRow(client, resolvedSectorId, monthName);
      const values = paymentValues({ 'Payment Status': 'Pending', ...data });
      const member = await client.query(`
        insert into members (sector_id, name, phone_number, designation, member_category)
        values ($1, $2, $3, $4, $5)
        returning id
      `, [
        resolvedSectorId,
        text(data.Name).trim(),
        text(data['Phone Number']).trim(),
        text(data.Designation).trim(),
        text(data['Member Category'], 'Fellow Member (FM)').trim() || 'Fellow Member (FM)',
      ]);
      const payment = await client.query(`
        insert into monthly_payments (
          sector_id, month_id, member_id, monthly_fund, previous_balance,
          total_payable, amount_paid, remaining_balance, payment_status,
          payment_date, receipt_link, remarks, receipt_no, increment,
          special_fund, recovery
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        returning id::int as "_rowId"
      `, [resolvedSectorId, month.id, member.rows[0].id, values.monthlyFund,
        values.previousBalance, values.totalPayable, values.amountPaid,
        values.remainingBalance, values.paymentStatus, values.paymentDate,
        values.receiptLink, values.remarks, values.receiptNo, values.increment,
        values.specialFund, values.recovery]);
      return payment.rows[0];
    });
  }

  async function updateMember(monthName, rowId, data, explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
      const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
      const month = await monthRow(client, resolvedSectorId, monthName);
      const currentResult = await client.query(`
        select mp.*, m.name, m.phone_number, m.designation, m.member_category
        from monthly_payments mp
        join members m on m.id = mp.member_id and m.sector_id = mp.sector_id
        where mp.sector_id = $1 and mp.month_id = $2 and mp.id = $3
        for update of mp, m
      `, [resolvedSectorId, month.id, rowId]);
      if (!currentResult.rowCount) throw new Error('Member row not found');
      const current = currentResult.rows[0];
      const values = paymentValues(data, {
        monthlyFund: current.monthly_fund,
        previousBalance: current.previous_balance,
        totalPayable: current.total_payable,
        amountPaid: current.amount_paid,
        remainingBalance: current.remaining_balance,
        paymentStatus: current.payment_status,
        paymentDate: current.payment_date,
        receiptLink: current.receipt_link,
        remarks: current.remarks,
        receiptNo: current.receipt_no,
        increment: current.increment,
        specialFund: current.special_fund,
        recovery: current.recovery,
      });
      await client.query(`
        update members set name=$1, phone_number=$2, designation=$3, member_category=$4
        where sector_id=$5 and id=$6
      `, [
        text(data.Name, current.name).trim(),
        text(data['Phone Number'], current.phone_number).trim(),
        text(data.Designation, current.designation).trim(),
        text(data['Member Category'], current.member_category).trim(),
        resolvedSectorId,
        current.member_id,
      ]);
      await client.query(`
        update monthly_payments set
          monthly_fund=$1, previous_balance=$2, total_payable=$3,
          amount_paid=$4, remaining_balance=$5, payment_status=$6,
          payment_date=$7, receipt_link=$8, remarks=$9, receipt_no=$10,
          increment=$11, special_fund=$12, recovery=$13
        where sector_id=$14 and id=$15
      `, [values.monthlyFund, values.previousBalance, values.totalPayable,
        values.amountPaid, values.remainingBalance, values.paymentStatus,
        values.paymentDate, values.receiptLink, values.remarks, values.receiptNo,
        values.increment, values.specialFund, values.recovery, resolvedSectorId, rowId]);
      return true;
    });
  }

  async function deleteMember(monthName, rowId, explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
    const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
    const month = await monthRow(client, resolvedSectorId, monthName);
    const result = await client.query(
      'delete from monthly_payments where sector_id=$1 and month_id=$2 and id=$3',
      [resolvedSectorId, month.id, rowId],
    );
    if (!result.rowCount) throw new Error('Member row not found');
    return true;
    });
  }

  async function updatePayment(monthName, rowId, expectedAmountPaid, amountPaid, paymentDate, remarks, explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
      const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
      const month = await monthRow(client, resolvedSectorId, monthName);
      const currentResult = await client.query(`
        select amount_paid::float8, total_payable::float8
        from monthly_payments
        where sector_id=$1 and month_id=$2 and id=$3
        for update
      `, [resolvedSectorId, month.id, rowId]);
      if (!currentResult.rowCount) throw new Error('Member row not found');
      const current = number(currentResult.rows[0].amount_paid);
      const total = number(currentResult.rows[0].total_payable);
      const expected = Number(expectedAmountPaid);
      const next = Number(amountPaid);
      if (!Number.isFinite(expected) || !Number.isFinite(next) || next < 0 || next > total) {
        throw new Error('Invalid payment amount');
      }
      if (Math.abs(current - expected) > 0.005) throw new Error('PAYMENT_CONFLICT');
      const remaining = Math.max(0, total - next);
      const status = total > 0 && next >= total ? 'Paid' : (next > 0 ? 'Partially Paid' : 'Pending');
      await client.query(`
        update monthly_payments
        set amount_paid=$1, remaining_balance=$2, payment_status=$3,
            payment_date=$4, remarks=$5
        where sector_id=$6 and id=$7
      `, [next, remaining, status, nullableDate(paymentDate), text(remarks), resolvedSectorId, rowId]);
      return {
        'Amount Paid': next,
        'Remaining Balance': remaining,
        'Payment Status': status,
        'Payment Date': nullableDate(paymentDate) || '',
        Remarks: text(remarks),
      };
    });
  }

  async function createMonthSheet(newSheetName, carryBalances, explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
      const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
      const cleanedName = text(newSheetName).replace(/\s+/g, ' ').trim();
      if (!cleanedName) throw new Error('Month name is required');
      const duplicate = await client.query(
        `select name from months where sector_id=$1 and ${MONTH_MATCH} limit 1`,
        [resolvedSectorId, cleanedName],
      );
      if (duplicate.rowCount) throw new Error(`Sheet already exists: ${duplicate.rows[0].name}`);
      const source = carryBalances
        ? await client.query('select id from months where sector_id=$1 order by id desc limit 1', [resolvedSectorId])
        : { rowCount: 0, rows: [] };
      const inserted = await client.query(
        'insert into months (sector_id, name) values ($1,$2) returning id',
        [resolvedSectorId, cleanedName],
      );
      if (source.rowCount) {
        await client.query(`
          insert into monthly_payments (
            sector_id, month_id, member_id, monthly_fund, previous_balance,
            total_payable, amount_paid, remaining_balance, payment_status, remarks
          )
          select sector_id, $1, member_id, monthly_fund, remaining_balance,
            monthly_fund + remaining_balance, 0, monthly_fund + remaining_balance,
            'Pending', remarks
          from monthly_payments
          where sector_id=$2 and month_id=$3
          order by id
        `, [inserted.rows[0].id, resolvedSectorId, source.rows[0].id]);
      }
      return { name: cleanedName };
    });
  }

  async function getExpenses(monthName, explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
    const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
    const params = [resolvedSectorId];
    let where = 'e.sector_id=$1';
    if (monthName) {
      const month = await monthRow(client, resolvedSectorId, monthName);
      params.push(month.id);
      where += ' and e.month_id=$2';
    }
    const result = await client.query(`
      select e.id::int as "_rowId", mo.name as "Month",
        to_char(e.expense_date, 'YYYY-MM-DD') as "Date",
        e.category as "Category", e.description as "Description",
        e.amount::float8 as "Amount", e.paid_by as "Paid By", e.remarks as "Remarks"
      from expenses e join months mo on mo.id=e.month_id and mo.sector_id=e.sector_id
      where ${where} order by e.id
    `, params);
    return result.rows;
    });
  }

  async function addExpense(data, explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
    const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
    const month = await monthRow(client, resolvedSectorId, data.Month);
    const result = await client.query(`
      insert into expenses (sector_id, month_id, expense_date, category, description, amount, paid_by, remarks)
      values ($1,$2,$3,$4,$5,$6,$7,$8) returning id::int as "_rowId"
    `, [resolvedSectorId, month.id, nullableDate(data.Date), text(data.Category),
      text(data.Description), number(data.Amount), text(data['Paid By']), text(data.Remarks)]);
    return result.rows[0];
    });
  }

  async function updateExpense(rowId, data, explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
      const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
      const currentResult = await client.query('select * from expenses where sector_id=$1 and id=$2 for update', [resolvedSectorId, rowId]);
      if (!currentResult.rowCount) throw new Error('Expense not found');
      const current = currentResult.rows[0];
      const monthId = data.Month !== undefined
        ? (await monthRow(client, resolvedSectorId, data.Month)).id
        : current.month_id;
      await client.query(`
        update expenses set month_id=$1, expense_date=$2, category=$3,
          description=$4, amount=$5, paid_by=$6, remarks=$7
        where sector_id=$8 and id=$9
      `, [monthId, data.Date !== undefined ? nullableDate(data.Date) : current.expense_date,
        text(data.Category, current.category), text(data.Description, current.description),
        data.Amount !== undefined ? number(data.Amount) : current.amount,
        text(data['Paid By'], current.paid_by), text(data.Remarks, current.remarks),
        resolvedSectorId, rowId]);
      return true;
    });
  }

  async function deleteExpense(rowId, explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
      const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
      const result = await client.query('delete from expenses where sector_id=$1 and id=$2', [resolvedSectorId, rowId]);
      if (!result.rowCount) throw new Error('Expense not found');
      return true;
    });
  }

  async function getMemberHistory(name, phone, explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
    const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
    const result = await client.query(`
      select mp.id::int as "_rowId", mo.name as month,
        m.name as "Name", m.phone_number as "Phone Number",
        m.designation as "Designation", m.member_category as "Member Category",
        mp.monthly_fund::float8 as "Monthly Fund", mp.previous_balance::float8 as "Previous Balance",
        mp.total_payable::float8 as "Total Payable", mp.amount_paid::float8 as "Amount Paid",
        mp.remaining_balance::float8 as "Remaining Balance", mp.payment_status as "Payment Status",
        to_char(mp.payment_date, 'YYYY-MM-DD') as "Payment Date", mp.receipt_link as "Receipt Link",
        mp.remarks as "Remarks"
      from monthly_payments mp
      join members m on m.id=mp.member_id and m.sector_id=mp.sector_id
      join months mo on mo.id=mp.month_id and mo.sector_id=mp.sector_id
      where mp.sector_id=$1 and (
        ($3 <> '' and regexp_replace(m.phone_number, '\\D', '', 'g')=$3)
        or ($2 <> '' and lower(btrim(m.name))=lower(btrim($2)))
      )
      order by mo.id
    `, [resolvedSectorId, text(name).trim(), text(phone).replace(/\D/g, '')]);
    return result.rows;
    });
  }

  function followUpSelect(where) {
    return `
      select f.id::int as "_rowId", mo.name as "Month", f.member_name as "Member Name",
        f.phone_number as "Phone Number", f.member_category as "Member Category",
        f.event_type as "Event Type", f.reminder_number as "Reminder Number",
        f.event_date as "Event Date", f.reply_status as "Reply Status",
        f.reason_reply as "Reason / Reply", to_char(f.next_reminder_date, 'YYYY-MM-DD') as "Next Reminder Date",
        f.created_by as "Created By", f.notes as "Notes"
      from follow_ups f join months mo on mo.id=f.month_id and mo.sector_id=f.sector_id
      where ${where} order by f.id
    `;
  }

  async function getFollowUps(monthName, explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
      const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
      const month = await monthRow(client, resolvedSectorId, monthName);
      const result = await client.query(followUpSelect('f.sector_id=$1 and f.month_id=$2'), [resolvedSectorId, month.id]);
      return result.rows;
    });
  }

  async function getMemberFollowUps(monthName, name, phone, explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
    const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
    const month = await monthRow(client, resolvedSectorId, monthName);
    const normalizedPhone = text(phone).replace(/\D/g, '');
    const result = await client.query(followUpSelect(`
      f.sector_id=$1 and f.month_id=$2 and (
        ($3 <> '' and regexp_replace(f.phone_number, '\\D', '', 'g')=$3)
        or ($4 <> '' and lower(btrim(f.member_name))=lower(btrim($4)))
      )
    `), [resolvedSectorId, month.id, normalizedPhone, text(name).trim()]);
    return result.rows;
    });
  }

  async function addFollowUp(data, explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
      const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
      const month = await monthRow(client, resolvedSectorId, data.Month);
      const eventType = text(data['Event Type'], 'Note') || 'Note';
      let reminderNumber = data['Reminder Number'] === undefined ? null : number(data['Reminder Number']);
      if (eventType === 'Reminder Sent' && !reminderNumber) {
        const count = await client.query(`
          select count(*)::int as count from follow_ups
          where sector_id=$1 and month_id=$2 and event_type='Reminder Sent'
            and ((regexp_replace(phone_number, '\\D', '', 'g') <> '' and regexp_replace(phone_number, '\\D', '', 'g')=$3)
              or lower(btrim(member_name))=lower(btrim($4)))
        `, [resolvedSectorId, month.id, text(data['Phone Number']).replace(/\D/g, ''), text(data['Member Name'])]);
        reminderNumber = Number(count.rows[0].count) + 1;
      }
      const result = await client.query(`
        insert into follow_ups (
          sector_id, month_id, member_name, phone_number, member_category,
          event_type, reminder_number, event_date, reply_status, reason_reply,
          next_reminder_date, created_by, notes
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        returning id::int as "_rowId"
      `, [resolvedSectorId, month.id, text(data['Member Name']), text(data['Phone Number']),
        text(data['Member Category']), eventType, reminderNumber,
        nullableDate(data['Event Date']) || new Date(),
        text(data['Reply Status'], eventType === 'Reminder Sent' ? 'No Reply' : ''),
        text(data['Reason / Reply']), nullableDate(data['Next Reminder Date']),
        text(data['Created By']), text(data.Notes)]);
      const rows = await client.query(followUpSelect('f.sector_id=$1 and f.id=$2'), [resolvedSectorId, result.rows[0]._rowId]);
      return rows.rows[0];
    });
  }

  async function campaignRow(target, resolvedSectorId, campaignKey) {
    const result = await target.query(
      'select * from special_fund_campaigns where sector_id=$1 and campaign_key=$2 limit 1',
      [resolvedSectorId, text(campaignKey).trim()],
    );
    if (!result.rowCount) throw new Error(`Campaign not found: ${campaignKey}`);
    return result.rows[0];
  }

  async function getSpecialFundContributions(campaignKey, explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
    const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
    const campaign = await campaignRow(client, resolvedSectorId, campaignKey);
    const result = await client.query(`
      select c.id::int as "_rowId", sf.campaign_key as "Campaign ID",
        c.member_name as "Member Name", c.phone_number as "Phone Number",
        c.member_category as "Member Category", c.minimum_amount::float8 as "Minimum Amount",
        c.amount_paid::float8 as "Amount Paid", to_char(c.payment_date, 'YYYY-MM-DD') as "Payment Date",
        c.receipt_link as "Receipt Link", c.remarks as "Remarks", c.recorded_at as "Recorded At"
      from special_fund_contributions c
      join special_fund_campaigns sf on sf.id=c.campaign_id and sf.sector_id=c.sector_id
      where c.sector_id=$1 and c.campaign_id=$2 order by c.id
    `, [resolvedSectorId, campaign.id]);
    return result.rows;
    });
  }

  async function addSpecialFundContribution(data, explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
    const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
    const campaign = await campaignRow(client, resolvedSectorId, data['Campaign ID']);
    const result = await client.query(`
      insert into special_fund_contributions (
        sector_id, campaign_id, member_name, phone_number, member_category,
        minimum_amount, amount_paid, payment_date, receipt_link, remarks, recorded_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,coalesce($11::timestamptz,now()))
      returning id::int as "_rowId"
    `, [resolvedSectorId, campaign.id, text(data['Member Name']), text(data['Phone Number']),
      text(data['Member Category']), number(data['Minimum Amount']), number(data['Amount Paid']),
      nullableDate(data['Payment Date']), text(data['Receipt Link']), text(data.Remarks),
      nullableDate(data['Recorded At'])]);
    return result.rows[0];
    });
  }

  async function updateSpecialFundContribution(rowId, data, explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
      const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
      const currentResult = await client.query('select * from special_fund_contributions where sector_id=$1 and id=$2 for update', [resolvedSectorId, rowId]);
      if (!currentResult.rowCount) throw new Error('Contribution not found');
      const current = currentResult.rows[0];
      let campaignId = current.campaign_id;
      if (data['Campaign ID'] !== undefined) campaignId = (await campaignRow(client, resolvedSectorId, data['Campaign ID'])).id;
      await client.query(`
        update special_fund_contributions set campaign_id=$1, member_name=$2,
          phone_number=$3, member_category=$4, minimum_amount=$5, amount_paid=$6,
          payment_date=$7, receipt_link=$8, remarks=$9
        where sector_id=$10 and id=$11
      `, [campaignId, text(data['Member Name'], current.member_name),
        text(data['Phone Number'], current.phone_number), text(data['Member Category'], current.member_category),
        data['Minimum Amount'] !== undefined ? number(data['Minimum Amount']) : current.minimum_amount,
        data['Amount Paid'] !== undefined ? number(data['Amount Paid']) : current.amount_paid,
        data['Payment Date'] !== undefined ? nullableDate(data['Payment Date']) : current.payment_date,
        text(data['Receipt Link'], current.receipt_link), text(data.Remarks, current.remarks),
        resolvedSectorId, rowId]);
      return true;
    });
  }

  async function deleteSpecialFundContribution(rowId, explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
      const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
      const result = await client.query('delete from special_fund_contributions where sector_id=$1 and id=$2', [resolvedSectorId, rowId]);
      if (!result.rowCount) throw new Error('Contribution not found');
      return true;
    });
  }

  async function getSettings(explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
    const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
    const [settingsResult, templatesResult, campaignResult] = await Promise.all([
      client.query('select setting_key, setting_value from settings where sector_id=$1', [resolvedSectorId]),
      client.query('select template_key, content from message_templates where sector_id=$1', [resolvedSectorId]),
      client.query('select * from special_fund_campaigns where sector_id=$1 order by id limit 1', [resolvedSectorId]),
    ]);
    const settings = {};
    settingsResult.rows.forEach((row) => { settings[row.setting_key] = row.setting_value; });
    templatesResult.rows.forEach((row) => { settings[row.template_key] = row.content; });
    if (campaignResult.rowCount) {
      const campaign = campaignResult.rows[0];
      settings.SPECIAL_FUND_CAMPAIGN_ID = campaign.campaign_key;
      settings.SPECIAL_FUND_CAMPAIGN_NAME = campaign.name;
      settings.SPECIAL_FUND_EVENT_TIMING = campaign.event_timing;
      settings.SPECIAL_FUND_EVENT_VENUE = campaign.event_venue;
      settings.SPECIAL_FUND_JP_MINIMUM = number(campaign.jp_minimum);
      settings.SPECIAL_FUND_SC_MINIMUM = number(campaign.sc_minimum);
      settings.SPECIAL_FUND_FM_MINIMUM = number(campaign.fm_minimum);
    }
    return settings;
    });
  }

  async function saveSettings(data, explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
      const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
      for (const [key, value] of Object.entries(data || {})) {
        if (TEMPLATE_KEYS.has(key)) {
          await client.query(`
            insert into message_templates (sector_id, template_key, content) values ($1,$2,$3)
            on conflict (sector_id, template_key) do update set content=excluded.content
          `, [resolvedSectorId, key, text(value)]);
        } else if (!CAMPAIGN_FIELDS[key]) {
          await client.query(`
            insert into settings (sector_id, setting_key, setting_value) values ($1,$2,$3::jsonb)
            on conflict (sector_id, setting_key) do update set setting_value=excluded.setting_value
          `, [resolvedSectorId, key, JSON.stringify(value)]);
        }
      }

      const campaignUpdates = Object.keys(data || {}).filter((key) => CAMPAIGN_FIELDS[key]);
      if (campaignUpdates.length) {
        const currentResult = await client.query('select * from special_fund_campaigns where sector_id=$1 order by id limit 1 for update', [resolvedSectorId]);
        const current = currentResult.rows[0] || {};
        const campaign = {
          campaign_key: text(data.SPECIAL_FUND_CAMPAIGN_ID, current.campaign_key).trim(),
          name: text(data.SPECIAL_FUND_CAMPAIGN_NAME, current.name),
          event_timing: text(data.SPECIAL_FUND_EVENT_TIMING, current.event_timing),
          event_venue: text(data.SPECIAL_FUND_EVENT_VENUE, current.event_venue),
          jp_minimum: data.SPECIAL_FUND_JP_MINIMUM !== undefined ? number(data.SPECIAL_FUND_JP_MINIMUM) : number(current.jp_minimum),
          sc_minimum: data.SPECIAL_FUND_SC_MINIMUM !== undefined ? number(data.SPECIAL_FUND_SC_MINIMUM) : number(current.sc_minimum),
          fm_minimum: data.SPECIAL_FUND_FM_MINIMUM !== undefined ? number(data.SPECIAL_FUND_FM_MINIMUM) : number(current.fm_minimum),
        };
        if (!campaign.campaign_key) throw new Error('Special fund campaign ID is required');
        if (currentResult.rowCount) {
          await client.query(`
            update special_fund_campaigns set campaign_key=$1, name=$2,
              event_timing=$3, event_venue=$4, jp_minimum=$5, sc_minimum=$6, fm_minimum=$7
            where sector_id=$8 and id=$9
          `, [campaign.campaign_key, campaign.name, campaign.event_timing, campaign.event_venue,
            campaign.jp_minimum, campaign.sc_minimum, campaign.fm_minimum, resolvedSectorId, current.id]);
        } else {
          await client.query(`
            insert into special_fund_campaigns (
              sector_id, campaign_key, name, event_timing, event_venue,
              jp_minimum, sc_minimum, fm_minimum
            ) values ($1,$2,$3,$4,$5,$6,$7,$8)
          `, [resolvedSectorId, campaign.campaign_key, campaign.name, campaign.event_timing,
            campaign.event_venue, campaign.jp_minimum, campaign.sc_minimum, campaign.fm_minimum]);
        }
      }
      return true;
    });
  }

  async function getDiagnostics(monthName, explicitSectorId, context) {
    const transactionContext = normalizeSectorContext(explicitSectorId, context);
    return withFinanceTransaction(transactionContext, async (client) => {
    const resolvedSectorId = await sectorId(client, transactionContext.sectorId);
    const monthResult = await client.query('select name from months where sector_id=$1 order by id', [resolvedSectorId]);
    const months = monthResult.rows.map((row) => row.name);
    const selected = monthName ? await monthRow(client, resolvedSectorId, monthName) : null;
    const counts = await client.query(`
      select
        (select count(*)::int from members where sector_id=$1) as members,
        (select count(*)::int from monthly_payments where sector_id=$1) as payments,
        (select count(*)::int from expenses where sector_id=$1) as expenses,
        (select count(*)::int from follow_ups where sector_id=$1) as follow_ups,
        (select count(*)::int from special_fund_contributions where sector_id=$1) as contributions
    `, [resolvedSectorId]);
    return {
      datastore: 'postgres',
      sectorId: resolvedSectorId,
      requestedMonth: monthName || '',
      resolvedMonth: selected?.name || '',
      months,
      counts: counts.rows[0],
    };
    });
  }

  async function repairMonthColumns() {
    return {
      datastore: 'postgres',
      skipped: true,
      reason: 'Postgres month foreign keys do not require text-cell repair',
    };
  }

  return {
    getSheets,
    getSheetData,
    addMember,
    updateMember,
    updatePayment,
    deleteMember,
    createMonthSheet,
    getExpenses,
    addExpense,
    updateExpense,
    deleteExpense,
    getMemberHistory,
    getFollowUps,
    getMemberFollowUps,
    addFollowUp,
    getSpecialFundContributions,
    addSpecialFundContribution,
    updateSpecialFundContribution,
    deleteSpecialFundContribution,
    getDiagnostics,
    repairMonthColumns,
    getSettings,
    saveSettings,
    _test: { sectorId, monthRow },
  };
}

module.exports = createFinanceService();
module.exports.createFinanceService = createFinanceService;
module.exports._test = { paymentValues, TEMPLATE_KEYS, CAMPAIGN_FIELDS };
