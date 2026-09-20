import { api } from './api.js';
import { utils } from './utils.js';

let appInstance;
let settings = {};
let members = [];
let contributions = [];

export async function init(app) {
    appInstance = app;
    bindEvents();
    applyReadOnlyState();
    await loadAll();

    if (window.__specialFundMonthHandler) window.removeEventListener('monthChanged', window.__specialFundMonthHandler);
    window.__specialFundMonthHandler = loadAll;
    window.addEventListener('monthChanged', window.__specialFundMonthHandler);
}

async function loadAll() {
    if (!appInstance.state.currentMonth) return;
    try {
        const settingsRes = await api.get('/api/settings');
        settings = settingsRes.data || {};
        const campaignId = settings.SPECIAL_FUND_CAMPAIGN_ID || 'central-convention-2027';
        const [membersRes, fundRes] = await Promise.all([
            api.get('/api/members?month=' + encodeURIComponent(appInstance.state.currentMonth)),
            api.get('/api/special-fund?campaignId=' + encodeURIComponent(campaignId))
        ]);
        members = membersRes.data || [];
        contributions = fundRes.data || [];
        render();
    } catch (error) {
        utils.showToast(error.message || 'Failed to load special fund', 'error');
        const tbody = document.querySelector('#sf-members-table tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger p-md">Could not load special fund data.</td></tr>';
    }
}

function bindEvents() {
    document.getElementById('sf-search')?.addEventListener('input', renderMemberTable);
    document.getElementById('sf-status-filter')?.addEventListener('change', renderMemberTable);
    document.getElementById('sf-add-contribution')?.addEventListener('click', () => openContributionModal());
    document.getElementById('sf-configure')?.addEventListener('click', openConfigModal);
    document.getElementById('sf-copy-message')?.addEventListener('click', copyAppeal);
    document.getElementById('sf-share-message')?.addEventListener('click', () => openWhatsApp('', buildAppeal()));
    document.getElementById('sf-contribution-form')?.addEventListener('submit', saveContribution);
    document.getElementById('sf-config-form')?.addEventListener('submit', saveConfiguration);
    document.querySelectorAll('#sf-contribution-modal .modal-close, #sf-contribution-modal .sf-modal-cancel').forEach(el => el.addEventListener('click', () => closeModal('sf-contribution-modal')));
    document.querySelectorAll('#sf-config-modal .modal-close, #sf-config-modal .sf-modal-cancel').forEach(el => el.addEventListener('click', () => closeModal('sf-config-modal')));
    document.getElementById('sf-members-table')?.addEventListener('click', handleMemberAction);
    document.getElementById('sf-ledger-table')?.addEventListener('click', handleLedgerAction);
}

function applyReadOnlyState() {
    if (!appInstance.isReadOnly()) return;
    ['sf-add-contribution', 'sf-configure'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    });
}

function render() {
    document.getElementById('sf-campaign-title').textContent = settings.SPECIAL_FUND_CAMPAIGN_NAME || 'Special Fund';
    document.getElementById('sf-campaign-meta').textContent = (settings.SPECIAL_FUND_EVENT_TIMING || '') + ' • ' + (settings.SPECIAL_FUND_EVENT_VENUE || '');
    populateMemberSelect();
    renderSummary();
    renderMemberTable();
    renderLedger();
    if (window.lucide) window.lucide.createIcons();
}

function memberKey(item) {
    const phone = String(item['Phone Number'] || '').replace(/\D/g, '');
    return phone ? 'p:' + phone : 'n:' + String(item['Name'] || item['Member Name'] || '').trim().toLowerCase();
}

function minimumFor(category) {
    const value = String(category || '').toLowerCase();
    if (value.includes('jaiza') || value.includes('(jp)')) return Number(settings.SPECIAL_FUND_JP_MINIMUM) || 0;
    if (value.includes('study') || value.includes('(sc)')) return Number(settings.SPECIAL_FUND_SC_MINIMUM) || 0;
    return Number(settings.SPECIAL_FUND_FM_MINIMUM) || 0;
}

function paidByMember(member) {
    const key = memberKey(member);
    return contributions.reduce((sum, entry) => sum + (memberKey(entry) === key ? Number(entry['Amount Paid']) || 0 : 0), 0);
}

function statusFor(member) {
    const minimum = minimumFor(member['Member Category']);
    const paid = paidByMember(member);
    if (minimum <= 0) return paid > 0 ? 'Contributed' : 'Pending';
    if (paid >= minimum) return 'Completed';
    if (paid > 0) return 'Partially Paid';
    return 'Pending';
}

function renderSummary() {
    const target = members.reduce((sum, member) => sum + minimumFor(member['Member Category']), 0);
    const collected = contributions.reduce((sum, item) => sum + (Number(item['Amount Paid']) || 0), 0);
    const remaining = members.reduce((sum, member) => sum + Math.max(0, minimumFor(member['Member Category']) - paidByMember(member)), 0);
    const contributors = members.filter(member => paidByMember(member) > 0).length;
    const percent = target > 0 ? Math.round((Math.min(collected, target) / target) * 100) : 0;
    document.getElementById('sf-target').textContent = utils.formatCurrency(target);
    document.getElementById('sf-collected').textContent = utils.formatCurrency(collected);
    document.getElementById('sf-remaining').textContent = utils.formatCurrency(remaining);
    document.getElementById('sf-target-meta').textContent = 'Across ' + members.length + ' current members';
    document.getElementById('sf-contributors').textContent = contributors + ' contributor' + (contributors === 1 ? '' : 's');
    document.getElementById('sf-progress').textContent = percent + '% of minimum target funded';
}

function renderMemberTable() {
    const tbody = document.querySelector('#sf-members-table tbody');
    if (!tbody) return;
    const search = String(document.getElementById('sf-search')?.value || '').trim().toLowerCase();
    const status = document.getElementById('sf-status-filter')?.value || 'all';
    const filtered = members.filter(member => {
        const text = [member['Name'], member['Phone Number'], member['Member Category']].join(' ').toLowerCase();
        return (!search || text.includes(search)) && (status === 'all' || statusFor(member) === status);
    });
    document.getElementById('sf-member-count').textContent = filtered.length + ' member' + (filtered.length === 1 ? '' : 's');
    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted p-md">No members match this filter.</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map(member => {
        const minimum = minimumFor(member['Member Category']);
        const paid = paidByMember(member);
        const remaining = Math.max(0, minimum - paid);
        const statusName = statusFor(member);
        const badge = statusName === 'Completed' || statusName === 'Contributed' ? 'badge-success' : statusName === 'Partially Paid' ? 'badge-warning' : 'badge-danger';
        const key = encodeURIComponent(memberKey(member));
        const recordButton = appInstance.isReadOnly() ? '' : '<button class="btn-icon" data-action="record" data-key="' + key + '" title="Record contribution"><i data-lucide="circle-dollar-sign"></i></button>';
        return '<tr>' +
            '<td data-label="Member"><strong>' + escapeHtml(member['Name']) + '</strong><br><span class="text-sm text-muted">' + escapeHtml(member['Phone Number']) + '</span></td>' +
            '<td data-label="Category"><span class="badge badge-default">' + escapeHtml(member['Member Category'] || 'Fellow Member (FM)') + '</span></td>' +
            '<td data-label="Minimum">' + (minimum > 0 ? utils.formatCurrency(minimum) : '<span class="text-muted">Open</span>') + '</td>' +
            '<td data-label="Collected" class="text-success font-bold">' + utils.formatCurrency(paid) + '</td>' +
            '<td data-label="Remaining" class="' + (remaining > 0 ? 'text-danger' : 'text-muted') + '">' + (minimum > 0 ? utils.formatCurrency(remaining) : '—') + '</td>' +
            '<td data-label="Status"><span class="badge ' + badge + '">' + statusName + '</span></td>' +
            '<td data-label="Actions"><div class="flex gap-sm">' + recordButton + '<button class="btn-icon" data-action="message" data-key="' + key + '" title="Send appeal"><i data-lucide="message-circle"></i></button></div></td>' +
            '</tr>';
    }).join('');
    if (window.lucide) window.lucide.createIcons();
}

function renderLedger() {
    const tbody = document.querySelector('#sf-ledger-table tbody');
    document.getElementById('sf-entry-count').textContent = contributions.length + ' entr' + (contributions.length === 1 ? 'y' : 'ies');
    if (!contributions.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted p-md">No contributions recorded yet.</td></tr>';
        return;
    }
    const ordered = contributions.slice().sort((a, b) => new Date(b['Payment Date'] || b['Recorded At'] || 0) - new Date(a['Payment Date'] || a['Recorded At'] || 0));
    tbody.innerHTML = ordered.map(entry => {
        let actions = '<span class="text-sm text-muted">Read only</span>';
        if (!appInstance.isReadOnly()) {
            actions = '<div class="flex gap-sm"><button class="btn-icon" data-action="edit" data-id="' + entry._rowId + '" title="Edit"><i data-lucide="pencil"></i></button><button class="btn-icon text-danger" data-action="delete" data-id="' + entry._rowId + '" title="Delete"><i data-lucide="trash-2"></i></button></div>';
        }
        const receiptUrl = safeHttpUrl(entry['Receipt Link']);
        const receipt = receiptUrl ? ' <a href="' + escapeAttribute(receiptUrl) + '" target="_blank" rel="noopener" title="Open receipt"><i data-lucide="external-link"></i></a>' : '';
        return '<tr><td data-label="Date">' + utils.formatDate(entry['Payment Date']) + '</td>' +
            '<td data-label="Member"><strong>' + escapeHtml(entry['Member Name']) + '</strong></td>' +
            '<td data-label="Category">' + escapeHtml(entry['Member Category']) + '</td>' +
            '<td data-label="Amount" class="text-success font-bold">' + utils.formatCurrency(entry['Amount Paid']) + receipt + '</td>' +
            '<td data-label="Remarks">' + escapeHtml(entry['Remarks'] || '—') + '</td><td data-label="Actions">' + actions + '</td></tr>';
    }).join('');
    if (window.lucide) window.lucide.createIcons();
}

function populateMemberSelect() {
    const select = document.getElementById('sf-member-select');
    select.innerHTML = '<option value="">Select a member</option>' + members.map(member => '<option value="' + escapeAttribute(memberKey(member)) + '">' + escapeHtml(member['Name']) + ' — ' + escapeHtml(member['Member Category'] || 'Fellow Member (FM)') + '</option>').join('');
}

function handleMemberAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const key = decodeURIComponent(button.dataset.key || '');
    const member = members.find(item => memberKey(item) === key);
    if (!member) return;
    if (button.dataset.action === 'record') openContributionModal(member);
    if (button.dataset.action === 'message') openWhatsApp(member['Phone Number'], buildAppeal());
}

function handleLedgerAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const entry = contributions.find(item => Number(item._rowId) === Number(button.dataset.id));
    if (!entry) return;
    if (button.dataset.action === 'edit') openContributionModal(null, entry);
    if (button.dataset.action === 'delete') deleteContribution(entry);
}

function openContributionModal(member, entry) {
    const form = document.getElementById('sf-contribution-form');
    form.reset();
    const select = document.getElementById('sf-member-select');
    document.getElementById('sf-entry-id').value = entry ? entry._rowId : '';
    document.getElementById('sf-contribution-title').textContent = entry ? 'Edit Contribution' : 'Record Contribution';
    select.disabled = !!entry;
    if (entry) {
        const match = members.find(item => memberKey(item) === memberKey(entry));
        select.value = match ? memberKey(match) : '';
        document.getElementById('sf-amount').value = entry['Amount Paid'] || '';
        document.getElementById('sf-payment-date').value = dateInputValue(entry['Payment Date']);
        document.getElementById('sf-receipt').value = entry['Receipt Link'] || '';
        document.getElementById('sf-remarks').value = entry['Remarks'] || '';
    } else {
        select.value = member ? memberKey(member) : '';
        document.getElementById('sf-payment-date').value = localToday();
    }
    document.getElementById('sf-contribution-modal').classList.add('active');
}

async function saveContribution(event) {
    event.preventDefault();
    const rowId = document.getElementById('sf-entry-id').value;
    const existing = rowId ? contributions.find(item => Number(item._rowId) === Number(rowId)) : null;
    const selected = existing
        ? (members.find(item => memberKey(item) === memberKey(existing)) || {
            'Name': existing['Member Name'],
            'Phone Number': existing['Phone Number'],
            'Member Category': existing['Member Category']
        })
        : members.find(item => memberKey(item) === document.getElementById('sf-member-select').value);
    if (!selected) return utils.showToast('Please select a member', 'warning');
    const data = {
        'Campaign ID': settings.SPECIAL_FUND_CAMPAIGN_ID || 'central-convention-2027',
        'Member Name': selected['Name'] || '',
        'Phone Number': selected['Phone Number'] || '',
        'Member Category': selected['Member Category'] || 'Fellow Member (FM)',
        'Minimum Amount': minimumFor(selected['Member Category']),
        'Amount Paid': Number(document.getElementById('sf-amount').value),
        'Payment Date': document.getElementById('sf-payment-date').value,
        'Receipt Link': document.getElementById('sf-receipt').value.trim(),
        'Remarks': document.getElementById('sf-remarks').value.trim()
    };
    const button = document.getElementById('sf-save-contribution');
    button.disabled = true;
    try {
        if (rowId) await api.put('/api/special-fund/' + rowId, { data });
        else await api.post('/api/special-fund', { data });
        closeModal('sf-contribution-modal');
        utils.showToast(rowId ? 'Contribution updated' : 'Contribution recorded');
        await reloadContributions();
    } catch (error) {
        utils.showToast(error.message || 'Could not save contribution', 'error');
    } finally {
        button.disabled = false;
    }
}

async function deleteContribution(entry) {
    if (!window.confirm('Delete the ' + utils.formatCurrency(entry['Amount Paid']) + ' contribution from ' + entry['Member Name'] + '?')) return;
    try {
        await api.delete('/api/special-fund/' + entry._rowId);
        utils.showToast('Contribution deleted');
        await reloadContributions();
    } catch (error) {
        utils.showToast(error.message || 'Could not delete contribution', 'error');
    }
}

async function reloadContributions() {
    const campaignId = settings.SPECIAL_FUND_CAMPAIGN_ID || 'central-convention-2027';
    const response = await api.get('/api/special-fund?campaignId=' + encodeURIComponent(campaignId));
    contributions = response.data || [];
    render();
}

function openConfigModal() {
    document.getElementById('sf-config-id').value = settings.SPECIAL_FUND_CAMPAIGN_ID || '';
    document.getElementById('sf-config-name').value = settings.SPECIAL_FUND_CAMPAIGN_NAME || '';
    document.getElementById('sf-config-timing').value = settings.SPECIAL_FUND_EVENT_TIMING || '';
    document.getElementById('sf-config-venue').value = settings.SPECIAL_FUND_EVENT_VENUE || '';
    document.getElementById('sf-config-jp').value = settings.SPECIAL_FUND_JP_MINIMUM || 0;
    document.getElementById('sf-config-sc').value = settings.SPECIAL_FUND_SC_MINIMUM || 0;
    document.getElementById('sf-config-fm').value = settings.SPECIAL_FUND_FM_MINIMUM || 0;
    document.getElementById('sf-config-template').value = settings.SPECIAL_FUND_MESSAGE_TEMPLATE || '';
    document.getElementById('sf-config-modal').classList.add('active');
}

async function saveConfiguration(event) {
    event.preventDefault();
    const specialSettings = {
        SPECIAL_FUND_CAMPAIGN_ID: document.getElementById('sf-config-id').value.trim(),
        SPECIAL_FUND_CAMPAIGN_NAME: document.getElementById('sf-config-name').value.trim(),
        SPECIAL_FUND_EVENT_TIMING: document.getElementById('sf-config-timing').value.trim(),
        SPECIAL_FUND_EVENT_VENUE: document.getElementById('sf-config-venue').value.trim(),
        SPECIAL_FUND_JP_MINIMUM: document.getElementById('sf-config-jp').value,
        SPECIAL_FUND_SC_MINIMUM: document.getElementById('sf-config-sc').value,
        SPECIAL_FUND_FM_MINIMUM: document.getElementById('sf-config-fm').value,
        SPECIAL_FUND_MESSAGE_TEMPLATE: document.getElementById('sf-config-template').value.trim()
    };
    const button = document.getElementById('sf-save-config');
    button.disabled = true;
    try {
        await api.post('/api/settings', { data: { ...settings, ...specialSettings } });
        settings = { ...settings, ...specialSettings };
        closeModal('sf-config-modal');
        utils.showToast('Special fund configuration saved');
        await reloadContributions();
    } catch (error) {
        utils.showToast(error.message || 'Could not save configuration', 'error');
    } finally {
        button.disabled = false;
    }
}

function buildAppeal() {
    const replacements = {
        event_timing: settings.SPECIAL_FUND_EVENT_TIMING || '',
        event_venue: settings.SPECIAL_FUND_EVENT_VENUE || '',
        jp_minimum: formatPlainNumber(settings.SPECIAL_FUND_JP_MINIMUM),
        sc_minimum: formatPlainNumber(settings.SPECIAL_FUND_SC_MINIMUM),
        fm_minimum: formatPlainNumber(settings.SPECIAL_FUND_FM_MINIMUM),
        campaign_name: settings.SPECIAL_FUND_CAMPAIGN_NAME || ''
    };
    return String(settings.SPECIAL_FUND_MESSAGE_TEMPLATE || '').replace(/\{(event_timing|event_venue|jp_minimum|sc_minimum|fm_minimum|campaign_name)\}/g, (_, key) => replacements[key]);
}

async function copyAppeal() {
    try {
        await navigator.clipboard.writeText(buildAppeal());
        utils.showToast('Urdu appeal copied');
    } catch (error) {
        utils.showToast('Could not copy the appeal', 'error');
    }
}

function openWhatsApp(phone, message) {
    const win = window.open(utils.generateWhatsAppLink(phone, message), '_blank');
    if (win) win.opener = null;
    else utils.showToast('WhatsApp popup was blocked', 'warning');
}

function closeModal(id) {
    document.getElementById(id)?.classList.remove('active');
}

function formatPlainNumber(value) {
    return (Number(value) || 0).toLocaleString('en-PK');
}

function localToday() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function dateInputValue(value) {
    if (!value) return localToday();
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
}

function safeHttpUrl(value) {
    try {
        const url = new URL(String(value || ''));
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch (error) {
        return '';
    }
}
