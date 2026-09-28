require('dotenv').config();

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  assert(response.status === expectedStatus, `${path}: expected HTTP ${expectedStatus}, received ${response.status}`);
  return body;
}

async function main() {
  const username = process.env.SMOKE_EMAIL || process.env.SEED_SECRETARY_EMAIL;
  const password = process.env.SMOKE_PASSWORD || process.env.SEED_SECRETARY_PASSWORD;
  assert(username && password, 'SMOKE_EMAIL/SMOKE_PASSWORD or seed secretary credentials are required');
  const health = await request('/api/health');
  assert(health.configured, 'Health probe reports incomplete configuration');
  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert(login.success && login.token, 'Admin login did not return a token');
  const headers = { authorization: `Bearer ${login.token}` };
  if (login.systemRole === 'super_admin') {
    const sectorId = Number(process.env.SMOKE_SECTOR_ID);
    assert(Number.isInteger(sectorId) && sectorId > 0, 'SMOKE_SECTOR_ID is required for a super-admin smoke');
    headers['x-sector-id'] = String(sectorId);
  }
  const status = await request('/api/auth/status', { headers });
  assert(status.authenticated, 'Authenticated status check failed');

  const [monthsResponse, settingsResponse, allExpenses] = await Promise.all([
    request('/api/months', { headers }),
    request('/api/settings', { headers }),
    request('/api/expenses', { headers }),
  ]);
  const months = monthsResponse.data;
  assert(Array.isArray(months) && months.length, 'No migrated months were returned');
  const monthResults = [];
  let paymentConflictVerified = false;
  for (const month of months) {
    const encoded = encodeURIComponent(month);
    const [members, expenses, followUps] = await Promise.all([
      request(`/api/members?month=${encoded}`, { headers }),
      request(`/api/expenses?month=${encoded}`, { headers }),
      request(`/api/followups?month=${encoded}`, { headers }),
    ]);
    assert(Array.isArray(members.data), `Members payload is invalid for ${month}`);
    assert(Array.isArray(expenses.data), `Expenses payload is invalid for ${month}`);
    assert(Array.isArray(followUps.data), `Follow-ups payload is invalid for ${month}`);
    if (members.data.length) {
      await request(`/api/export/csv?month=${encoded}`, { headers });
      if (!paymentConflictVerified) {
        const member = members.data[0];
        const currentPaid = Number(member['Amount Paid']) || 0;
        const conflict = await request(`/api/payments/${member._rowId}`, {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({
            month,
            expectedAmountPaid: currentPaid + 1,
            amountPaid: currentPaid,
            paymentDate: member['Payment Date'] || '',
            remarks: member.Remarks || '',
          }),
        }, 409);
        assert(conflict.success === false, 'Stale payment request did not return the conflict payload');
        paymentConflictVerified = true;
      }
    }
    monthResults.push({ month, members: members.data.length, expenses: expenses.data.length, followUps: followUps.data.length });
  }

  const campaignId = settingsResponse.data?.SPECIAL_FUND_CAMPAIGN_ID;
  let contributions = null;
  if (campaignId) {
    const response = await request(`/api/special-fund?campaignId=${encodeURIComponent(campaignId)}`, { headers });
    assert(Array.isArray(response.data), 'Special-fund payload is invalid');
    contributions = response.data.length;
  }
  assert(paymentConflictVerified, 'No payment row was available for conflict verification');
  const backup = await request('/api/export/sheets-backup', {
    method: 'POST',
    headers,
  });
  assert(backup.success && backup.data?.counts, 'Sheets backup did not return verified counts');
  console.log(JSON.stringify({
    health: health.configured,
    authenticated: status.authenticated,
    role: status.role,
    months: monthResults,
    totalExpenses: allExpenses.data.length,
    settings: Object.keys(settingsResponse.data || {}).length,
    contributions,
    paymentConflictHttp409: true,
    csvExport: true,
    sheetsBackup: backup.data.counts,
  }, null, 2));
}

main().catch((error) => {
  console.error(`Phase 1 smoke test failed: ${error.message}`);
  process.exitCode = 1;
});
