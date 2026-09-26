const assert = require('node:assert/strict');
const test = require('node:test');

const { validateEntryProposal, validateManagementCommand } = require('../routes/ai')._test;

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

test('management command preserves review gates and strips unknown fields', () => {
  const value = validateManagementCommand({
    summary: 'Prepared one reminder',
    answer: 'Review this draft.',
    needsClarification: false,
    questions: [],
    plan: ['Find the member', 'Prepare the draft'],
    drafts: [{ recipientRowId: 2, recipientName: 'Test Member', channel: 'whatsapp', content: 'Hello' }],
    proposedActions: [{ type: 'open-whatsapp', label: 'Open WhatsApp', requiresConfirmation: false, payload: { rowId: 2 }, injected: 'ignored' }],
    sources: ['Members'],
    injected: 'ignored',
  }, [{ rowId: 2 }]);
  assert.equal(value.proposedActions[0].requiresConfirmation, true);
  assert.equal(value.proposedActions[0].injected, undefined);
  assert.equal(value.drafts[0].recipientRowId, 2);
  assert.equal(value.injected, undefined);
});

test('management command rejects an unknown member recipient', () => {
  assert.throws(
    () => validateManagementCommand({ drafts: [{ recipientRowId: 99, content: 'Hello' }] }, [{ rowId: 2 }]),
    (error) => error.status === 502,
  );
});
