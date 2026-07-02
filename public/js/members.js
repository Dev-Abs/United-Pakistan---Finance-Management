import { api } from './api.js';
import { utils } from './utils.js';

let appInstance = null;
let allMembers = [];
let appSettings = {};

export async function init(app) {
    appInstance = app;
    
    // Load settings for reminders
    try {
        const res = await api.get('/api/settings');
        if (res.success) appSettings = res.data;
    } catch (e) { console.error('Failed to load settings'); }

    if (app.state.currentMonth) {
        await loadMembers();
    }
    
    window.addEventListener('monthChanged', loadMembers);
    setupEventListeners();
}

async function loadMembers() {
    if (!appInstance.state.currentMonth) return;
    
    utils.showLoader();
    try {
        const res = await api.get(`/api/members?month=${encodeURIComponent(appInstance.state.currentMonth)}`);
        if (res.success) {
            allMembers = res.data;
            renderTable();
        }
    } catch (error) {
        utils.showToast('Failed to load members', 'error');
    } finally {
        utils.hideLoader();
    }
}

function renderTable() {
    const tbody = document.querySelector('#members-table tbody');
    tbody.innerHTML = '';
    
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const statusFilter = document.getElementById('status-filter').value;
    
    let filtered = allMembers.filter(m => {
        const matchesSearch = (m['Name'] || '').toLowerCase().includes(searchTerm) || 
                              (m['Phone Number'] || '').includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || m['Payment Status'] === statusFilter;
        return matchesSearch && matchesStatus;
    });
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted p-md">No members found.</td></tr>`;
        return;
    }
    
    filtered.forEach(m => {
        const tr = document.createElement('tr');
        
        let statusBadge = `<span class="badge badge-default">${m['Payment Status']}</span>`;
        if (m['Payment Status'] === 'Paid') statusBadge = `<span class="badge badge-success">Paid</span>`;
        if (m['Payment Status'] === 'Partially Paid') statusBadge = `<span class="badge badge-warning">Partially Paid</span>`;
        if (m['Payment Status'] === 'Pending') statusBadge = `<span class="badge badge-danger">Pending</span>`;
        
        tr.innerHTML = `
            <td class="font-bold">${m['Name']}</td>
            <td>${m['Phone Number']}</td>
            <td>${utils.formatCurrency(m['Monthly Fund'])}</td>
            <td class="font-bold">${utils.formatCurrency(m['Total Payable'])}</td>
            <td class="text-success">${utils.formatCurrency(m['Amount Paid'])}</td>
            <td class="text-danger">${utils.formatCurrency(m['Remaining Balance'])}</td>
            <td>${statusBadge}</td>
            <td>
                <div class="flex gap-sm">
                    <button class="btn-icon" title="Mark Payment" onclick="window.membersJS.openPaymentModal(${m._rowId})">💰</button>
                    <button class="btn-icon" title="Send WhatsApp" onclick="window.membersJS.sendWhatsApp(${m._rowId})">💬</button>
                    <button class="btn-icon" title="Edit" onclick="window.membersJS.openEditModal(${m._rowId})">✏️</button>
                    <button class="btn-icon text-danger" title="Delete" onclick="window.membersJS.deleteMember(${m._rowId})">🗑️</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function setupEventListeners() {
    document.getElementById('search-input').addEventListener('input', renderTable);
    document.getElementById('status-filter').addEventListener('change', renderTable);
    
    document.getElementById('btn-add-member').addEventListener('click', () => {
        document.getElementById('member-form').reset();
        document.getElementById('member-id').value = '';
        document.getElementById('member-modal-title').textContent = 'Add Member';
        document.getElementById('m-fund').value = appSettings['DEFAULT_MONTHLY_FUND'] || 500;
        document.getElementById('member-modal').classList.add('active');
    });
    
    document.getElementById('member-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('member-id').value;
        const data = {
            'Name': document.getElementById('m-name').value,
            'Phone Number': document.getElementById('m-phone').value,
            'Designation': document.getElementById('m-designation').value,
            'Monthly Fund': document.getElementById('m-fund').value,
            'Remarks': document.getElementById('m-remarks').value
        };
        
        // Initial defaults for new member
        if (!id) {
            data['Previous Balance'] = 0;
            data['Total Payable'] = data['Monthly Fund'];
            data['Amount Paid'] = 0;
            data['Remaining Balance'] = data['Total Payable'];
            data['Payment Status'] = 'Pending';
        }
        
        const btn = document.getElementById('btn-save-member');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        
        try {
            if (id) {
                await api.put(`/api/members/${id}`, { month: appInstance.state.currentMonth, data });
                utils.showToast('Member updated');
            } else {
                await api.post('/api/members', { month: appInstance.state.currentMonth, data });
                utils.showToast('Member added');
            }
            document.getElementById('member-modal').classList.remove('active');
            await loadMembers();
        } catch (error) {
            utils.showToast(error.message || 'Failed to save', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save Member';
        }
    });

    document.getElementById('payment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('p-member-id').value;
        const data = {
            month: appInstance.state.currentMonth,
            amountPaid: document.getElementById('p-amount').value,
            paymentDate: document.getElementById('p-date').value,
            remarks: document.getElementById('p-remarks').value,
            totalPayable: document.getElementById('p-total-payable').value
        };
        
        const btn = document.getElementById('btn-save-payment');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        
        try {
            await api.post(`/api/payments/${id}`, data);
            utils.showToast('Payment saved');
            document.getElementById('payment-modal').classList.remove('active');
            await loadMembers();
        } catch (error) {
            utils.showToast(error.message || 'Failed to save payment', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Confirm Payment';
        }
    });

    document.getElementById('btn-bulk-reminders').addEventListener('click', generateBulkReminders);
    document.getElementById('btn-copy-all-reminders').addEventListener('click', copyAllReminders);
}

// Export functions to window so inline onclick can use them
window.membersJS = {
    openEditModal: (id) => {
        const m = allMembers.find(x => x._rowId === id);
        if (!m) return;
        
        document.getElementById('member-id').value = m._rowId;
        document.getElementById('m-name').value = m['Name'];
        document.getElementById('m-phone').value = m['Phone Number'];
        document.getElementById('m-designation').value = m['Designation'];
        document.getElementById('m-fund').value = m['Monthly Fund'];
        document.getElementById('m-remarks').value = m['Remarks'];
        
        document.getElementById('member-modal-title').textContent = 'Edit Member';
        document.getElementById('member-modal').classList.add('active');
    },
    
    deleteMember: async (id) => {
        if (!confirm('Are you sure you want to delete this member?')) return;
        
        try {
            await api.delete(`/api/members/${id}?month=${encodeURIComponent(appInstance.state.currentMonth)}`);
            utils.showToast('Member deleted');
            await loadMembers();
        } catch (e) {
            utils.showToast('Failed to delete', 'error');
        }
    },
    
    openPaymentModal: (id) => {
        const m = allMembers.find(x => x._rowId === id);
        if (!m) return;
        
        document.getElementById('p-member-id').value = m._rowId;
        document.getElementById('p-member-name').textContent = m['Name'];
        document.getElementById('p-total-payable').value = m['Total Payable'];
        document.getElementById('p-display-due').textContent = utils.formatCurrency(m['Total Payable']);
        
        document.getElementById('p-amount').value = m['Total Payable']; // prefill with full amount
        document.getElementById('p-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('p-remarks').value = m['Remarks'] || '';
        
        document.getElementById('payment-modal').classList.add('active');
    },
    
    sendWhatsApp: (id) => {
        const m = allMembers.find(x => x._rowId === id);
        if (!m) return;
        
        const msg = generateReminderText(m);
        const link = utils.generateWhatsAppLink(m['Phone Number'], msg);
        window.open(link, '_blank');
    },
    
    copyText: (btn, text) => {
        navigator.clipboard.writeText(text).then(() => {
            const original = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = original; }, 2000);
        });
    }
};

function generateReminderText(m) {
    let msg = `Assalamu Alaikum ${m['Name']}!\nHope you're doing well.\n\n`;
    msg += `This is a gentle reminder that I, ${appSettings['SECRETARY_NAME'] || '[Secretary Name]'}, am now the Secretary Finance for the ${appSettings['SECTOR_NAME'] || '[Sector Name]'}.\n\n`;
    msg += `Your Fund Details:\n`;
    msg += `• Monthly Fund: ${utils.formatCurrency(m['Monthly Fund'])}\n`;
    if (Number(m['Previous Balance']) > 0) {
        msg += `• Previous Balance: ${utils.formatCurrency(m['Previous Balance'])}\n`;
    }
    msg += `• Total Payable: *${utils.formatCurrency(m['Total Payable'])}*\n\n`;
    msg += `Kindly transfer the amount to the following account and share the payment receipt.\n\n`;
    msg += `Easypaisa: *${appSettings['EASYPAISA_NUMBER'] || '[Number]'}*\n`;
    msg += `Account Title: ${appSettings['ACCOUNT_TITLE'] || '[Title]'}\n\n`;
    msg += `Thank you.`;
    
    return msg;
}

function generateBulkReminders() {
    const pending = allMembers.filter(m => m['Payment Status'] === 'Pending' || m['Payment Status'] === 'Partially Paid');
    const list = document.getElementById('reminders-list');
    list.innerHTML = '';
    
    if (pending.length === 0) {
        list.innerHTML = `<div class="p-md text-center text-muted">Everyone is fully paid! 🎉</div>`;
    } else {
        pending.forEach(m => {
            const msg = generateReminderText(m);
            const item = document.createElement('div');
            item.className = 'p-md border-bottom';
            item.innerHTML = `
                <div class="flex justify-between align-center mb-sm">
                    <h4 class="font-bold">${m['Name']}</h4>
                    <div class="flex gap-sm">
                        <button class="btn btn-sm btn-outline copy-btn">Copy</button>
                        <a href="${utils.generateWhatsAppLink(m['Phone Number'], msg)}" target="_blank" class="btn btn-sm btn-primary">WhatsApp</a>
                    </div>
                </div>
                <pre class="text-sm bg-gray p-sm" style="white-space: pre-wrap; font-family: inherit; border-radius: 4px;">${msg}</pre>
            `;
            
            item.querySelector('.copy-btn').addEventListener('click', function() {
                window.membersJS.copyText(this, msg);
            });
            
            list.appendChild(item);
        });
    }
    
    document.getElementById('reminders-modal').classList.add('active');
}

function copyAllReminders() {
    const pending = allMembers.filter(m => m['Payment Status'] === 'Pending' || m['Payment Status'] === 'Partially Paid');
    let allText = '';
    pending.forEach(m => {
        allText += `--- TO: ${m['Name']} (${m['Phone Number']}) ---\n`;
        allText += generateReminderText(m) + '\n\n';
    });
    
    if (!allText) {
        utils.showToast('No reminders to copy');
        return;
    }
    
    const btn = document.getElementById('btn-copy-all-reminders');
    navigator.clipboard.writeText(allText).then(() => {
        btn.textContent = 'Copied All!';
        setTimeout(() => { btn.textContent = 'Copy All Text'; }, 2000);
    });
}
