import { api } from './api.js';
import { utils } from './utils.js';

export async function init(app) {
    await loadSettings();
    
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
