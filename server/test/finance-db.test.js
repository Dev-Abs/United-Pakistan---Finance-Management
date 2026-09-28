const assert = require('node:assert/strict');
const test = require('node:test');

const { createFinanceService, _test } = require('../services/finance-db');

test('payment normalization preserves spreadsheet payment semantics', () => {
  const paid = _test.paymentValues({
    'Payment Status': 'Paid',
    'Total Payable': 1250,
    'Amount Paid': 10,
  });
  assert.equal(paid.amountPaid, 1250);
  assert.equal(paid.remainingBalance, 0);

  const pending = _test.paymentValues({
    'Payment Status': 'Pending',
    'Total Payable': 900,
    'Amount Paid': 500,
  });
  assert.equal(pending.amountPaid, 0);
  assert.equal(pending.remainingBalance, 900);
});

function paymentDatabase(currentPaid = 200, totalPayable = 1000) {
  const statements = [];
  const database = {
    statements,
    async withTransaction(task) {
      return task({
        async query(sql, params) {
          statements.push({ sql, params });
          if (/select id, name from months/i.test(sql)) return { rowCount: 1, rows: [{ id: 7, name: 'September 2026' }] };
          if (/select amount_paid::float8/i.test(sql)) {
            return { rowCount: 1, rows: [{ amount_paid: currentPaid, total_payable: totalPayable }] };
          }
          if (/update monthly_payments/i.test(sql)) return { rowCount: 1, rows: [] };
          throw new Error(`Unexpected SQL: ${sql}`);
        },
      });
    },
  };
  return database;
}

test('payment updates lock the row and atomically derive balance and status', async () => {
  const database = paymentDatabase();
  const service = createFinanceService(database);
  const result = await service.updatePayment('September 2026', 18, 200, 650, '2026-09-28', 'received', 3);

  const lock = database.statements.find(({ sql }) => /select amount_paid::float8/i.test(sql));
  const update = database.statements.find(({ sql }) => /update monthly_payments/i.test(sql));
  assert.match(lock.sql, /for update/i);
  assert.deepEqual(update.params, [650, 350, 'Partially Paid', '2026-09-28', 'received', 3, 18]);
  assert.equal(result['Remaining Balance'], 350);
  assert.equal(result['Payment Status'], 'Partially Paid');
});

test('stale payment updates fail before issuing an update', async () => {
  const database = paymentDatabase(300);
  const service = createFinanceService(database);
  await assert.rejects(
    service.updatePayment('September 2026', 18, 200, 650, '', '', 3),
    /PAYMENT_CONFLICT/,
  );
  assert.equal(database.statements.some(({ sql }) => /update monthly_payments/i.test(sql)), false);
});

test('single-tenant fallback refuses ambiguous active sectors', async () => {
  const service = createFinanceService({
    query: async () => ({ rowCount: 2, rows: [{ id: 1 }, { id: 2 }] }),
  });
  await assert.rejects(service.getSheets(), /sector context is required/i);
});
