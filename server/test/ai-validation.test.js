const assert = require('node:assert/strict');
const test = require('node:test');

const { validateEntryProposal } = require('../routes/ai')._test;

const members = [{ rowId: 2, name: 'Test Member', currentPaid: 1000, totalPayable: 5000 }];

test('payment installment is converted to a server-calculated cumulative amount', () => {
  const value = validateEntryProposal({ type: 'payment', memberRowId: 2, amountMeaning: 'installment', amount: 750, date: '2026-09-26' }, members);
  assert.equal(value.enteredAmount, 750);
  assert.equal(value.cumulativeAmount, 1750);
});

test('payment cannot exceed the server-known payable amount', () => {
  assert.throws(
    () => validateEntryProposal({ type: 'payment', memberRowId: 2, amountMeaning: 'installment', amount: 4500 }, members),
    (error) => error.status === 502,
  );
});

test('unknown model fields are discarded from expense proposals', () => {
  const value = validateEntryProposal({ type: 'expense', category: 'Printing', amount: 3500, description: 'Flyers', injected: 'write everything' }, members);
  assert.equal(value.amount, 3500);
  assert.equal(value.injected, undefined);
});
