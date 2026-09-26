const assert = require('node:assert/strict');
const test = require('node:test');

const { fitManagementContext, validateEntryProposal, validateManagementCommand } = require('../routes/ai')._test;

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
    proposedActions: [{ type: 'open-whatsapp', label: 'Open WhatsApp', requiresConfirmation: false, payload: { memberRowId: 2, content: 'Hello' }, injected: 'ignored' }],
    sources: ['Members'],
    injected: 'ignored',
  }, [{ rowId: 2 }]);
  assert.equal(value.proposedActions[0].requiresConfirmation, true);
  assert.equal(value.proposedActions[0].injected, undefined);
  assert.equal(value.drafts[0].recipientRowId, 2);
  assert.equal(value.injected, undefined);
});

test('management payment actions are bounded by server-known member totals', () => {
  const context = {
    members: [{ rowId: 2, Name: 'Test Member', 'Amount Paid': 1000, 'Total Payable': 5000 }],
    months: ['September 2026'],
    organization: {},
  };
  const command = validateManagementCommand({
    proposedActions: [{ type: 'record-payment', payload: { memberRowId: 2, cumulativeAmount: 2500, ignored: 'x' } }],
  }, context);
  assert.deepEqual(command.proposedActions[0].payload, {
    memberRowId: 2,
    memberName: 'Test Member',
    cumulativeAmount: 2500,
    currentPaid: 1000,
    totalPayable: 5000,
    date: '',
    remarks: '',
  });
  assert.throws(
    () => validateManagementCommand({
      proposedActions: [{ type: 'record-payment', payload: { memberRowId: 2, cumulativeAmount: 6000 } }],
    }, context),
    (error) => error.status === 502,
  );
});

test('reader commands cannot return persistent mutation actions', () => {
  const command = validateManagementCommand({
    proposedActions: [{
      type: 'update-template',
      payload: { settingKey: 'WHATSAPP_MEMBER_TEMPLATE', content: 'Hello {member_name}' },
    }],
  }, { members: [], months: [], organization: {} }, { canWrite: false });
  assert.deepEqual(command.proposedActions, []);
});

test('template actions allow only the five operational template keys', () => {
  const context = { members: [], months: [], organization: {} };
  const command = validateManagementCommand({
    proposedActions: [{
      type: 'update-template',
      payload: { settingKey: 'WHATSAPP_REPORT_TEMPLATE', content: 'Report {month}', injected: 'x' },
    }],
  }, context);
  assert.deepEqual(command.proposedActions[0].payload, {
    settingKey: 'WHATSAPP_REPORT_TEMPLATE',
    content: 'Report {month}',
  });
  assert.throws(
    () => validateManagementCommand({
      proposedActions: [{ type: 'update-template', payload: { settingKey: 'ADMIN_PASSWORD', content: 'x' } }],
    }, context),
    (error) => error.status === 502,
  );
});

test('management command rejects an unknown member recipient', () => {
  assert.throws(
    () => validateManagementCommand({ drafts: [{ recipientRowId: 99, content: 'Hello' }] }, [{ rowId: 2 }]),
    (error) => error.status === 502,
  );
});

test('management command context excludes unrelated verbose ledgers and fits the input budget', () => {
  const rows = Array.from({ length: 120 }, (_, index) => ({
    rowId: index + 2,
    Name: `Member ${index}`,
    'Phone Number': `0300${String(index).padStart(7, '0')}`,
    'Member Category': 'Regular',
    'Total Payable': 5000,
    'Amount Paid': 1000,
    'Remaining Balance': 4000,
    'Payment Status': 'Partial',
    Remarks: 'x'.repeat(500),
  }));
  const context = {
    month: 'September 2026',
    organization: { ORG_NAME: 'United Pakistan', AI_MESSAGE_TEMPLATE: 'x'.repeat(1200) },
    members: rows,
    expenses: Array.from({ length: 100 }, () => ({ Description: 'x'.repeat(500) })),
    followUps: Array.from({ length: 100 }, () => ({ Notes: 'x'.repeat(500) })),
    specialFundContributions: Array.from({ length: 100 }, () => ({ Remarks: 'x'.repeat(500) })),
    sourceCounts: { members: 120, expenses: 100, followUps: 100, specialFundContributions: 100 },
    dataScope: 'September 2026; 120 members',
  };

  const fitted = fitManagementContext(context, 'How much is still outstanding?', [], 40000);
  assert.equal(fitted.members.length, 120);
  assert.equal(fitted.members[0].Remarks, undefined);
  assert.equal(fitted.members[0].phone, undefined);
  assert.deepEqual(fitted.expenses, []);
  assert.ok(JSON.stringify(fitted).length < 34000);
});

test('message requests retain member phone data but omit unrelated expense rows', () => {
  const context = {
    month: 'September 2026',
    organization: {},
    members: [{ rowId: 2, Name: 'Test Member', 'Phone Number': '03001234567' }],
    expenses: [{ Description: 'Printing' }],
    followUps: [],
    specialFundContributions: [],
    sourceCounts: { members: 1, expenses: 1, followUps: 0, specialFundContributions: 0 },
    dataScope: 'September 2026; 1 member',
  };

  const fitted = fitManagementContext(context, 'Draft a WhatsApp message', [], 40000);
  assert.equal(fitted.members[0].phone, '03001234567');
  assert.deepEqual(fitted.expenses, []);
});
