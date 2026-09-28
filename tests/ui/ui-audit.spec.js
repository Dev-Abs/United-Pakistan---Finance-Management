const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const path = require('node:path');

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
];

const routes = ['dashboard', 'members', 'expenses', 'special-fund', 'reports', 'settings'];
const colorSchemes = ['light', 'dark'];
const sampleMember = {
  'Name': 'Ayesha Khan', 'Phone Number': '03001234567', 'Member Category': 'Fellow Member (FM)',
  'Total Payable': 5000, 'Amount Paid': 3500, 'Remaining Balance': 1500, 'Status': 'Partial',
  'Payment Date': '2026-09-22', id: 1,
};

function responseFor(url) {
  const pathname = new URL(url).pathname;
  if (pathname === '/api/auth/status') return { authenticated: true, role: 'admin', systemRole: 'super_admin' };
  if (pathname === '/api/months') return { success: true, data: ['September 2026', 'August 2026'] };
  if (pathname === '/api/settings') return { success: true, data: { SECTOR_NAME: 'Central Sector', SPECIAL_FUND_CAMPAIGN_ID: '1', SPECIAL_FUND_CAMPAIGN_NAME: 'Community Relief' } };
  if (pathname === '/api/members') return { success: true, data: [sampleMember] };
  if (pathname.includes('/api/members/history')) return { success: true, data: [sampleMember] };
  if (pathname.startsWith('/api/expenses')) return { success: true, data: [{ id: 1, Date: '2026-09-18', Description: 'Community hall', Category: 'Operations', Amount: 1200, 'Paid By': 'Secretary' }] };
  if (pathname.startsWith('/api/followups')) return { success: true, data: [] };
  if (pathname.startsWith('/api/special-fund')) return { success: true, data: [{ id: 1, member_name: 'Ayesha Khan', amount: 2500, contribution_date: '2026-09-20' }] };
  if (pathname === '/api/notifications') return { success: true, data: [] };
  if (pathname === '/api/diagnostics') return { success: true, data: { database: 'connected' } };
  if (pathname === '/api/admin/overview') return { data: { active_sectors: 2, total_sectors: 2, total_members: 24, total_collected: 82000, total_expenses: 19000, sectors: [{ id: 1, name: 'Central Sector', active: true, members: 12, collected: 45000, due: 60000 }] } };
  if (pathname === '/api/admin/sectors') return { data: [{ id: 1, name: 'Central Sector', slug: 'central', active: true, secretary_count: 1 }, { id: 2, name: 'North Sector', slug: 'north', active: true, secretary_count: 1 }] };
  if (pathname.includes('/api/admin/audit-log')) return { data: [], pagination: { page: 1 } };
  if (pathname === '/api/admin/status') return { data: { database: 'connected', deploymentConfigured: true, aiFeaturesEnabled: true } };
  if (pathname === '/api/onboarding/requests') return { data: [] };
  if (/\/api\/admin\/sectors\/\d+\/users/.test(pathname)) return { data: [] };
  return { success: true, data: [] };
}

async function mockApi(page, { withSector = true } = {}) {
  await page.route(/^https:\/\//, route => route.abort());
  await page.route('**/api/**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responseFor(route.request().url())) });
  });
  await page.addInitScript(({ withSector }) => {
    localStorage.setItem('auth_token', 'visual-fixture-token');
    if (withSector) {
      localStorage.setItem('selected_sector_id', '1');
      localStorage.setItem('selected_sector_name', 'Central Sector');
    } else {
      localStorage.removeItem('selected_sector_id');
      localStorage.removeItem('selected_sector_name');
    }
  }, { withSector });
}

test('super-admin without context is routed to a searchable sector selection', async ({ page }) => {
  await mockApi(page, { withSector: false });
  await page.goto('/');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator('#main-view').getByRole('heading', { name: /sector administration/i })).toBeVisible();
  await expect(page.locator('#sector-context-banner')).toBeHidden();
  await expect(page.getByPlaceholder('Name or slug')).toBeVisible();
});

for (const viewport of viewports) {
  for (const colorScheme of colorSchemes) {
    for (const routeName of routes) {
    test(`${routeName} ${viewport.name} ${colorScheme} has no horizontal overflow and passes axe`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme });
      await mockApi(page);
      await page.goto(routeName === 'dashboard' ? '/' : `/${routeName}`);
      await page.locator('#main-view').waitFor({ state: 'visible' });
      await page.waitForTimeout(250);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
      const output = path.join('docs', 'ui', 'baseline', 'web', `${routeName}-${viewport.width}x${viewport.height}-${colorScheme}.png`);
      await page.screenshot({ path: output, fullPage: true });
    });
    }
  }
}
