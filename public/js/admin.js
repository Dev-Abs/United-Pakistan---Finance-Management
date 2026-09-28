import { api } from './api.js';
import { utils } from './utils.js';

function cell(value) { const td = document.createElement('td'); td.textContent = value == null ? '' : String(value); return td; }
function row(values) { const tr = document.createElement('tr'); values.forEach((v) => tr.appendChild(v instanceof Node ? v : cell(v))); return tr; }
let auditPage = 1;
let sectorPage = 1;
let sectorsState = [];
const SECTOR_PAGE_SIZE = 10;
function showOneTimeCredential(email, password) {
    const backdrop = document.createElement('div'); backdrop.className = 'modal-backdrop active';
    const dialog = document.createElement('section'); dialog.className = 'modal-dialog card'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'credential-title');
    const title = document.createElement('h3'); title.id = 'credential-title'; title.textContent = 'One-time secretary credential';
    const copy = document.createElement('p'); copy.className = 'text-muted'; copy.textContent = `Share this with ${email}. It will not be shown again.`;
    const value = document.createElement('code'); value.className = 'credential-value'; value.textContent = password;
    const actions = document.createElement('div'); actions.className = 'dialog-actions';
    const copyButton = document.createElement('button'); copyButton.className = 'btn btn-primary'; copyButton.textContent = 'Copy password'; copyButton.addEventListener('click', async () => { try { await navigator.clipboard.writeText(password); copyButton.textContent = 'Copied'; } catch { utils.showToast('Clipboard access unavailable; select the password to copy it.', 'error'); } });
    const close = document.createElement('button'); close.className = 'btn btn-secondary'; close.textContent = 'Done'; close.addEventListener('click', () => backdrop.remove());
    actions.append(copyButton, close); dialog.append(title, copy, value, actions); backdrop.append(dialog); backdrop.addEventListener('click', (event) => { if (event.target === backdrop) backdrop.remove(); }); document.body.append(backdrop); close.focus();
}

function renderSectorTable() {
    const body = document.getElementById('admin-sectors');
    if (!body) return;
    const query = document.getElementById('admin-sector-search')?.value.trim().toLowerCase() || '';
    const status = document.getElementById('admin-sector-status')?.value || 'all';
    const filtered = sectorsState.filter((sector) => {
        const matchesQuery = !query || sector.name.toLowerCase().includes(query) || sector.slug.toLowerCase().includes(query);
        const matchesStatus = status === 'all' || (status === 'active' ? sector.active : !sector.active);
        return matchesQuery && matchesStatus;
    });
    const pageCount = Math.max(1, Math.ceil(filtered.length / SECTOR_PAGE_SIZE));
    sectorPage = Math.min(sectorPage, pageCount);
    const start = (sectorPage - 1) * SECTOR_PAGE_SIZE;
    body.replaceChildren();
    filtered.slice(start, start + SECTOR_PAGE_SIZE).forEach((sector) => {
        const actions = document.createElement('div'); actions.className = 'inline-actions';
        const secretary = document.createElement('button'); secretary.className = 'btn btn-secondary btn-sm'; secretary.textContent = 'Create/reset secretary';
        secretary.addEventListener('click', async () => {
            const email = window.prompt('Secretary email'); if (!email) return;
            try { const result = await api.post(`/api/admin/sectors/${sector.id}/secretary`, { email }); showOneTimeCredential(result.data.email, result.data.oneTimePassword); await load(); } catch (e) { utils.showToast(e.message || 'Unable to provision secretary', 'error'); }
        });
        const toggle = document.createElement('button'); toggle.className = 'btn btn-secondary btn-sm'; toggle.textContent = sector.active ? 'Deactivate' : 'Activate';
        toggle.addEventListener('click', async () => { try { await api.patch(`/api/admin/sectors/${sector.id}`, { active: !sector.active }); await load(); } catch (e) { utils.showToast(e.message || 'Unable to update sector', 'error'); } });
        actions.append(secretary, toggle); body.appendChild(row([sector.name, sector.slug, sector.active ? 'Active' : 'Inactive', sector.secretary_count, actions]));
    });
    document.getElementById('admin-sector-results').textContent = `${filtered.length} matching sector${filtered.length === 1 ? '' : 's'}`;
    document.getElementById('admin-sector-page').textContent = `Page ${sectorPage} of ${pageCount}`;
    document.getElementById('admin-sector-prev').disabled = sectorPage <= 1;
    document.getElementById('admin-sector-next').disabled = sectorPage >= pageCount;
}

async function load() {
    const actionFilter = document.getElementById('admin-audit-action')?.value.trim() || '';
    const auditQuery = new URLSearchParams({ page: String(auditPage), limit: '50' }); if (actionFilter) auditQuery.set('action', actionFilter);
    const [overview, sectors, audit, status, onboarding] = await Promise.all([api.get('/api/admin/overview'), api.get('/api/admin/sectors'), api.get(`/api/admin/audit-log?${auditQuery}`), api.get('/api/admin/status'), api.get('/api/onboarding/requests')]);
    const statusData = status.data || {};
    document.getElementById('admin-status-text').textContent = `Database: ${statusData.database}; deployment: ${statusData.deploymentConfigured ? 'configured' : 'incomplete'}; AI: ${statusData.aiFeaturesEnabled ? 'enabled' : 'disabled'}${statusData.aiControlledActionsEnabled ? ' (controlled actions enabled)' : ''}.`;
    const summary = overview.data || {};
    document.getElementById('admin-active-sectors').textContent = `${summary.active_sectors || 0} / ${summary.total_sectors || 0}`;
    document.getElementById('admin-members').textContent = Number(summary.total_members || 0).toLocaleString();
    document.getElementById('admin-collected').textContent = Number(summary.total_collected || 0).toLocaleString();
    document.getElementById('admin-expenses').textContent = Number(summary.total_expenses || 0).toLocaleString();
    const cards = document.getElementById('admin-sector-cards'); cards.replaceChildren();
    (summary.sectors || []).forEach((item) => {
        const card = document.createElement('article'); card.className = 'card';
        const title = document.createElement('h4'); title.textContent = item.name;
        const status = document.createElement('p'); status.className = 'text-muted'; status.textContent = `${item.active ? 'Active' : 'Inactive'} • ${item.members} members`;
        const detail = document.createElement('p'); detail.textContent = `Collected ${Number(item.collected || 0).toLocaleString()} of ${Number(item.due || 0).toLocaleString()}`;
        const enter = document.createElement('button'); enter.className = 'btn btn-primary btn-sm'; enter.textContent = 'Enter sector';
        enter.addEventListener('click', () => { localStorage.setItem('selected_sector_id', item.id); localStorage.setItem('selected_sector_name', item.name); window.location.href = '/'; });
        card.append(title, status, detail, enter); cards.appendChild(card);
    });
    const sectorRows = sectors.data || [];
    sectorsState = sectorRows;
    const userSector = document.getElementById('admin-user-sector');
    if (userSector) {
        const current = userSector.value;
        userSector.replaceChildren(...sectorRows.map((sector) => { const option = document.createElement('option'); option.value = sector.id; option.textContent = sector.name; return option; }));
        if (sectorRows.some((sector) => String(sector.id) === current)) userSector.value = current;
        userSector.onchange = () => loadUsers(userSector.value);
        if (userSector.value) await loadUsers(userSector.value);
    }
    renderSectorTable();
    const auditBody = document.getElementById('admin-audit'); auditBody.replaceChildren();
    (audit.data || []).forEach((item) => auditBody.appendChild(row([new Date(item.created_at).toLocaleString(), item.action, item.actor_email, item.sector_id, JSON.stringify(item.metadata || {})])));
    const auditPageLabel = document.getElementById('admin-audit-page'); if (auditPageLabel) auditPageLabel.textContent = `Page ${auditPage}`;
    const requestBody = document.getElementById('admin-onboarding'); const requestStatus = document.getElementById('admin-onboarding-status');
    if (requestBody) { requestBody.replaceChildren(); const requests = onboarding.data || []; requests.forEach((request) => { const actions = document.createElement('div'); actions.className = 'inline-actions'; const approve = document.createElement('button'); approve.className = 'btn btn-primary btn-sm'; approve.textContent = 'Approve'; approve.addEventListener('click', async () => { try { await api.post(`/api/onboarding/requests/${request.id}/approve`, {}); utils.showToast('Sector approved', 'success'); await load(); } catch (e) { utils.showToast(e.message || 'Approval failed', 'error'); } }); const reject = document.createElement('button'); reject.className = 'btn btn-secondary btn-sm'; reject.textContent = 'Reject'; reject.addEventListener('click', async () => { try { await api.post(`/api/onboarding/requests/${request.id}/reject`, {}); utils.showToast('Request rejected', 'success'); await load(); } catch (e) { utils.showToast(e.message || 'Rejection failed', 'error'); } }); actions.append(approve, reject); requestBody.appendChild(row([request.sector_name, request.requester_email, request.notes || '—', new Date(request.created_at).toLocaleString(), actions])); }); requestStatus.textContent = requests.length ? `${requests.length} pending request${requests.length === 1 ? '' : 's'}.` : 'No pending requests.'; }
}

async function loadUsers(sectorId) {
    const body = document.getElementById('admin-users'); const status = document.getElementById('admin-users-status');
    if (!body || !sectorId) return;
    body.replaceChildren(); status.textContent = 'Loading sector users…';
    try {
        const result = await api.get(`/api/admin/sectors/${encodeURIComponent(sectorId)}/users`);
        const users = result.data || [];
        users.forEach((user) => body.appendChild(row([user.email, user.role, user.active ? 'Active' : 'Inactive', user.must_change_password ? 'Change required' : 'Set', user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'])));
        status.textContent = `${users.length} account${users.length === 1 ? '' : 's'} in this sector.`;
    } catch (error) { status.textContent = error.message || 'Unable to load sector users.'; }
}

export async function init() {
    document.getElementById('admin-sector-form')?.addEventListener('submit', async (event) => { event.preventDefault(); const name = document.getElementById('admin-sector-name').value; const slug = document.getElementById('admin-sector-slug').value; try { await api.post('/api/admin/sectors', { name, slug }); event.target.reset(); utils.showToast('Sector created', 'success'); await load(); } catch (e) { utils.showToast(e.message || 'Unable to create sector', 'error'); } });
    document.getElementById('admin-refresh')?.addEventListener('click', load);
    document.getElementById('admin-onboarding-refresh')?.addEventListener('click', load);
    document.getElementById('admin-audit-action')?.addEventListener('change', () => { auditPage = 1; load(); });
    document.getElementById('admin-audit-prev')?.addEventListener('click', () => { if (auditPage > 1) { auditPage -= 1; load(); } });
    document.getElementById('admin-audit-next')?.addEventListener('click', () => { auditPage += 1; load(); });
    document.getElementById('admin-sector-search')?.addEventListener('input', () => { sectorPage = 1; renderSectorTable(); });
    document.getElementById('admin-sector-status')?.addEventListener('change', () => { sectorPage = 1; renderSectorTable(); });
    document.getElementById('admin-sector-prev')?.addEventListener('click', () => { if (sectorPage > 1) { sectorPage -= 1; renderSectorTable(); } });
    document.getElementById('admin-sector-next')?.addEventListener('click', () => { sectorPage += 1; renderSectorTable(); });
    await load();
}
