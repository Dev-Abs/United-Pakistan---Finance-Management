const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migrationPath = path.join(__dirname, '../../db/migrations/001_initial_schema.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

function tableDefinition(tableName) {
  const escapedName = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = sql.match(new RegExp(`create table ${escapedName} \\(([\\s\\S]*?)\\n\\);`, 'i'));
  assert.ok(match, `Missing ${tableName} table`);
  return match[1];
}

test('initial migration defines every required table', () => {
  const requiredTables = [
    'sectors',
    'users',
    'members',
    'months',
    'monthly_payments',
    'expenses',
    'follow_ups',
    'special_fund_campaigns',
    'special_fund_contributions',
    'message_templates',
    'settings',
    'audit_log',
  ];

  requiredTables.forEach((tableName) => tableDefinition(tableName));
});

test('every tenant-owned table has a non-null sector foreign key', () => {
  const tenantTables = [
    'members',
    'months',
    'monthly_payments',
    'expenses',
    'follow_ups',
    'special_fund_campaigns',
    'special_fund_contributions',
    'message_templates',
    'settings',
  ];

  tenantTables.forEach((tableName) => {
    assert.match(
      tableDefinition(tableName),
      /sector_id bigint not null references sectors\(id\)/i,
      `${tableName}.sector_id must be a non-null sectors foreign key`,
    );
  });
});

test('user roles enforce the super-admin and sector membership invariant', () => {
  const users = tableDefinition('users');
  assert.match(users, /role in \('super_admin', 'secretary', 'read_only'\)/i);
  assert.match(users, /role = 'super_admin' and sector_id is null/i);
  assert.match(users, /role in \('secretary', 'read_only'\) and sector_id is not null/i);
});

test('audit log supports nullable cross-sector context and JSON metadata', () => {
  const auditLog = tableDefinition('audit_log');
  assert.match(auditLog, /actor_user_id bigint references users\(id\) on delete set null/i);
  assert.match(auditLog, /sector_id bigint references sectors\(id\)/i);
  assert.match(auditLog, /metadata jsonb not null default '\{\}'::jsonb/i);
});

test('same-sector composite foreign keys protect relational tenant boundaries', () => {
  const expectedConstraints = [
    /foreign key \(sector_id, month_id\) references months\(sector_id, id\)/gi,
    /foreign key \(sector_id, member_id\) references members\(sector_id, id\)/gi,
    /foreign key \(sector_id, campaign_id\) references special_fund_campaigns\(sector_id, id\)/i,
  ];

  expectedConstraints.forEach((pattern) => assert.match(sql, pattern));
});

test('row-level security remains deferred to the optional hardening phase', () => {
  assert.doesNotMatch(sql, /enable\s+row\s+level\s+security/i);
  assert.doesNotMatch(sql, /create\s+policy/i);
});
