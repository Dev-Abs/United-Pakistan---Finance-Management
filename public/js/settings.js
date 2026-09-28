import { api } from './api.js';
import { utils } from './utils.js';

export async function init(app) {
    await loadSettings();

    // Disable editing for read-only users
    if (app.isReadOnly()) {
        document.querySelectorAll('#settings-form input').forEach(el => el.disabled = true);
        const btn = document.getElementById('btn-save-settings');
        if (btn) btn.style.display = 'none';
        const diagCard = document.getElementById('diagnostics-card');
        if (diagCard) diagCard.style.display = 'none';
        return;
    }

    await initTeamManagement(app);

    document.getElementById('btn-run-diagnostics')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-run-diagnostics');
        const out = document.getElementById('diagnostics-output');
        btn.disabled = true;
        btn.textContent = 'Running...';
        try {
            const month = app.state.currentMonth || '';
            const res = await api.get('/api/diagnostics?month=' + encodeURIComponent(month));
            out.textContent = JSON.stringify(res.data, null, 2);
            out.style.display = 'block';
        } catch (error) {
            utils.showToast(error.message || 'Diagnostics failed', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Run Diagnostics';
        }
    });

    document.getElementById('btn-repair-months')?.addEventListener('click', async () => {
        if (!window.confirm('This will rewrite any corrupted Month cells (dates) back to text in the Expenses and FollowUps sheets. Continue?')) {
            return;
        }
        const btn = document.getElementById('btn-repair-months');
        const out = document.getElementById('diagnostics-output');
        btn.disabled = true;
        btn.textContent = 'Repairing...';
        try {
            const res = await api.post('/api/diagnostics/repair-month-columns', {});
            out.textContent = JSON.stringify(res.data, null, 2);
            out.style.display = 'block';
            utils.showToast('Repair complete');
        } catch (error) {
            utils.showToast(error.message || 'Repair failed', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Repair Corrupted Month Values';
        }
    });

    document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
            'ORG_NAME': document.getElementById('s-org-name').value,
            'SECTOR_NAME': document.getElementById('s-sector-name').value,
            'SECRETARY_NAME': document.getElementById('s-secretary-name').value,
            'DEFAULT_MONTHLY_FUND': document.getElementById('s-default-fund').value,
            'EASYPAISA_NUMBER': document.getElementById('s-easypaisa').value,
            'ACCOUNT_TITLE': document.getElementById('s-account-title').value
        };
        
        const btn = document.getElementById('btn-save-settings');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        
        try {
            await api.post('/api/settings', { data });
            utils.showToast('Settings saved successfully');
        } catch (error) {
            utils.showToast(error.message || 'Failed to save settings', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save Settings';
        }
    });
}

async function initTeamManagement(app) {
    const card = document.getElementById('team-management-card');
    if (!card || !['secretary', 'super_admin'].includes(app.state.systemRole)) return;
    card.hidden = false;
    const form = document.getElementById('team-user-form');
    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('team-user-email').value.trim();
        const button = document.getElementById('team-user-create');
        button.disabled = true;
        try {
            const response = await api.post('/api/team/users', { email });
            form.reset();
            showTeamCredential(response.data.oneTimePassword);
            await loadTeamUsers();
        } catch (error) {
            utils.showToast(error.message || 'Unable to create viewer', 'error');
        } finally {
            button.disabled = false;
        }
    });
    document.getElementById('team-credential-copy')?.addEventListener('click', copyTeamCredential);
    document.getElementById('team-credential-close')?.addEventListener('click', closeTeamCredential);
    await loadTeamUsers();
}

async function loadTeamUsers() {
    const body = document.getElementById('team-users-body');
    const status = document.getElementById('team-status');
    if (!body || !status) return;
    body.replaceChildren();
    status.textContent = 'Loading team accounts…';
    try {
        const response = await api.get('/api/team/users');
        const users = response.data || [];
        users.forEach((user) => body.appendChild(teamUserRow(user)));
        status.textContent = users.length ? `${users.length} read-only account${users.length === 1 ? '' : 's'}` : 'No read-only accounts yet.';
    } catch (error) {
        status.textContent = error.message || 'Unable to load team accounts.';
    }
}

function teamUserRow(user) {
    const row = document.createElement('tr');
    const values = [
        user.email,
        user.active ? 'Active' : 'Inactive',
        user.must_change_password ? 'Change required' : 'Updated',
        user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never',
    ];
    values.forEach((value) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
    });
    const actions = document.createElement('td');
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'btn btn-outline btn-sm';
    reset.textContent = 'Reset password';
    reset.addEventListener('click', () => resetTeamPassword(user));
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'btn btn-outline btn-sm';
    toggle.textContent = user.active ? 'Deactivate' : 'Activate';
    toggle.addEventListener('click', () => toggleTeamUser(user));
    actions.append(reset, document.createTextNode(' '), toggle);
    row.appendChild(actions);
    return row;
}

async function resetTeamPassword(user) {
    if (!window.confirm(`Reset the password for ${user.email}? Existing sessions will be revoked.`)) return;
    try {
        const response = await api.post(`/api/team/users/${user.id}/reset`, {});
        showTeamCredential(response.data.oneTimePassword);
        await loadTeamUsers();
    } catch (error) {
        utils.showToast(error.message || 'Unable to reset password', 'error');
    }
}

async function toggleTeamUser(user) {
    const action = user.active ? 'deactivate' : 'activate';
    if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} ${user.email}?`)) return;
    try {
        await api.patch(`/api/team/users/${user.id}`, { active: !user.active });
        await loadTeamUsers();
        utils.showToast(`Account ${action}d`);
    } catch (error) {
        utils.showToast(error.message || `Unable to ${action} account`, 'error');
    }
}

function showTeamCredential(password) {
    const dialog = document.getElementById('team-credential-dialog');
    const input = document.getElementById('team-credential-password');
    const status = document.getElementById('team-credential-copy-status');
    input.value = password || '';
    status.textContent = '';
    dialog.showModal();
    input.select();
}

async function copyTeamCredential() {
    const input = document.getElementById('team-credential-password');
    const status = document.getElementById('team-credential-copy-status');
    try {
        await navigator.clipboard.writeText(input.value);
        status.textContent = 'Password copied.';
    } catch (_) {
        input.select();
        status.textContent = 'Clipboard access was unavailable. Copy the selected password manually.';
    }
}

function closeTeamCredential() {
    const dialog = document.getElementById('team-credential-dialog');
    document.getElementById('team-credential-password').value = '';
    dialog.close();
}

async function loadSettings() {
    utils.showLoader();
    try {
        const res = await api.get('/api/settings');
        if (res.success && res.data) {
            document.getElementById('s-org-name').value = res.data['ORG_NAME'] || '';
            document.getElementById('s-sector-name').value = res.data['SECTOR_NAME'] || '';
            document.getElementById('s-secretary-name').value = res.data['SECRETARY_NAME'] || '';
            document.getElementById('s-default-fund').value = res.data['DEFAULT_MONTHLY_FUND'] || '';
            document.getElementById('s-easypaisa').value = res.data['EASYPAISA_NUMBER'] || '';
            document.getElementById('s-account-title').value = res.data['ACCOUNT_TITLE'] || '';
        }
    } catch (error) {
        utils.showToast('Failed to load settings', 'error');
    } finally {
        utils.hideLoader();
    }
}
