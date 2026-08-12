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
