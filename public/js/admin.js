import { api } from './api.js';
import { utils } from './utils.js';

function cell(value) { const td = document.createElement('td'); td.textContent = value == null ? '' : String(value); return td; }
function row(values) { const tr = document.createElement('tr'); values.forEach((v) => tr.appendChild(v instanceof Node ? v : cell(v))); return tr; }

async function load() {
    const [sectors, audit] = await Promise.all([api.get('/api/admin/sectors'), api.get('/api/admin/audit-log')]);
    const body = document.getElementById('admin-sectors'); body.replaceChildren();
    (sectors.data || []).forEach((sector) => {
        const actions = document.createElement('div'); actions.className = 'inline-actions';
        const secretary = document.createElement('button'); secretary.className = 'btn btn-secondary btn-sm'; secretary.textContent = 'Create/reset secretary';
        secretary.addEventListener('click', async () => {
            const email = window.prompt('Secretary email'); if (!email) return;
            try { const result = await api.post(`/api/admin/sectors/${sector.id}/secretary`, { email }); window.prompt('Copy this one-time password. It is not stored or shown again.', result.data.oneTimePassword); await load(); } catch (e) { utils.showToast(e.message || 'Unable to provision secretary', 'error'); }
        });
        const toggle = document.createElement('button'); toggle.className = 'btn btn-secondary btn-sm'; toggle.textContent = sector.active ? 'Deactivate' : 'Activate';
        toggle.addEventListener('click', async () => { try { await api.patch(`/api/admin/sectors/${sector.id}`, { active: !sector.active }); await load(); } catch (e) { utils.showToast(e.message || 'Unable to update sector', 'error'); } });
        actions.append(secretary, toggle); body.appendChild(row([sector.name, sector.slug, sector.active ? 'Active' : 'Inactive', sector.secretary_count, actions]));
    });
    const auditBody = document.getElementById('admin-audit'); auditBody.replaceChildren();
    (audit.data || []).forEach((item) => auditBody.appendChild(row([new Date(item.created_at).toLocaleString(), item.action, item.actor_email, item.sector_id, JSON.stringify(item.metadata || {})])));
}

export async function init() {
    document.getElementById('admin-sector-form')?.addEventListener('submit', async (event) => { event.preventDefault(); const name = document.getElementById('admin-sector-name').value; const slug = document.getElementById('admin-sector-slug').value; try { await api.post('/api/admin/sectors', { name, slug }); event.target.reset(); utils.showToast('Sector created', 'success'); await load(); } catch (e) { utils.showToast(e.message || 'Unable to create sector', 'error'); } });
    document.getElementById('admin-refresh')?.addEventListener('click', load);
    await load();
}
