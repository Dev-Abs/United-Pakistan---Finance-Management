import { api } from './api.js';
import { utils } from './utils.js';

let appInstance = null;
let allMembers = [];
let appSettings = {};

function renderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

export async function init(app) {
    appInstance = app;

    if (app.isReadOnly()) {
        let el = document.getElementById('btn-add-member');
        if (el) el.style.display = 'none';
        el = document.getElementById('btn-bulk-reminders');
        if (el) el.style.display = 'none';
    }

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
    try {
        const res = await api.get('/api/members?month=' + encodeURIComponent(appInstance.state.currentMonth));
        if (res.success) {
            allMembers = res.data;
            document.getElementById('members-skeleton').style.display = 'none';
            document.getElementById('members-content').style.display = 'block';
            renderTable();
        }
    } catch (error) {
        utils.showToast('Failed to load members', 'error');
        document.getElementById('members-skeleton').style.display = 'none';
        document.getElementById('members-content').style.display = 'block';
    }
}

function renderTable() {
    const tbody = document.querySelector('#members-table tbody');
    tbody.innerHTML = '';
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const statusFilter = document.getElementById('status-filter').value;

    let filtered = allMembers.filter(function (m) {
        const matchesSearch = (m['Name'] || '').toLowerCase().includes(searchTerm) ||
            (m['Phone Number'] || '').includes(searchTerm) ||
            (m['Member Category'] || '').toLowerCase().includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || m['Payment Status'] === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted p-md">No members found.</td></tr>';
        return;
    }

    const isReadOnly = appInstance.isReadOnly();
    const sortField = document.getElementById('members-table').dataset.sortField || '';
    const sortDir = document.getElementById('members-table').dataset.sortDir || 'asc';

    if (sortField) {
        filtered.sort(function (a, b) {
            let va = a[sortField] !== undefined ? a[sortField] : '';
            let vb = b[sortField] !== undefined ? b[sortField] : '';
            if (typeof va === 'number') return sortDir === 'asc' ? va - vb : vb - va;
            va = String(va).toLowerCase();
            vb = String(vb).toLowerCase();
            return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        });
    }

    filtered.forEach(function (m) {
        const tr = document.createElement('tr');
        let statusBadge = '<span class="badge badge-default">' + (m['Payment Status'] || '') + '</span>';
        if (m['Payment Status'] === 'Paid') statusBadge = '<span class="badge badge-success">Paid</span>';
        if (m['Payment Status'] === 'Partially Paid') statusBadge = '<span class="badge badge-warning">Partially Paid</span>';
        if (m['Payment Status'] === 'Pending') statusBadge = '<span class="badge badge-danger">Pending</span>';

        let actionsHtml = '<span class="text-muted text-sm">Read only</span>';
        if (!isReadOnly) {
            actionsHtml = '<div class="flex gap-sm">' +
                '<button class="btn-icon" title="Mark Payment" onclick="window.membersJS.openPaymentModal(' + m._rowId + ')"><i data-lucide="dollar-sign"></i></button>' +
                '<button class="btn-icon" title="Send WhatsApp" onclick="window.membersJS.sendWhatsApp(' + m._rowId + ')"><i data-lucide="message-circle"></i></button>' +
                '<button class="btn-icon" title="Edit" onclick="window.membersJS.openEditModal(' + m._rowId + ')"><i data-lucide="pencil"></i></button>' +
                '<button class="btn-icon text-danger" title="Delete" onclick="window.membersJS.deleteMember(' + m._rowId + ')"><i data-lucide="trash-2"></i></button>' +
                '</div>';
        }

        const prevBal = Number(m['Previous Balance']) || 0;

        tr.innerHTML =
            '<td data-label="Name" class="font-bold">' +
            '<a href="#" class="text-primary" style="text-decoration:none;" onclick="window.membersJS.showHistory(' + m._rowId + '); return false;">' + (m['Name'] || '') + '</a></td>' +
            '<td data-label="Phone">' + (m['Phone Number'] || '') + '</td>' +
            '<td data-label="Category"><span class="badge badge-default">' + (m['Member Category'] || 'Fellow Member (FM)') + '</span></td>' +
            '<td data-label="Monthly Fund">' + utils.formatCurrency(m['Monthly Fund']) + '</td>' +
            '<td data-label="Previous Balance" class="' + (prevBal > 0 ? 'text-danger' : 'text-muted') + '">' + utils.formatCurrency(prevBal) + '</td>' +
            '<td data-label="Total Due" class="font-bold">' + utils.formatCurrency(m['Total Payable']) + '</td>' +
            '<td data-label="Paid" class="text-success">' + utils.formatCurrency(m['Amount Paid']) + '</td>' +
            '<td data-label="Remaining" class="text-danger">' + utils.formatCurrency(m['Remaining Balance']) + '</td>' +
            '<td data-label="Status">' + statusBadge + '</td>' +
            '<td data-label="Actions">' + actionsHtml + '</td>';
        tbody.appendChild(tr);
    });
    renderIcons();
}

function setupEventListeners() {
    document.getElementById('search-input').addEventListener('input', renderTable);
    document.getElementById('status-filter').addEventListener('change', renderTable);

    document.querySelectorAll('#members-table thead th.sortable').forEach(function (th) {
        th.addEventListener('click', function () {
            const field = this.dataset.sort;
            const table = document.getElementById('members-table');
            const currentField = table.dataset.sortField || '';
            const currentDir = table.dataset.sortDir || 'asc';
            table.dataset.sortField = field;
            table.dataset.sortDir = (field === currentField && currentDir === 'asc') ? 'desc' : 'asc';
            document.querySelectorAll('#members-table thead th.sortable .sort-arrow').forEach(function (a) { a.textContent = ''; });
            const arrow = this.querySelector('.sort-arrow');
            if (arrow) arrow.textContent = table.dataset.sortDir === 'asc' ? ' asc' : ' desc';
            renderTable();
        });
    });

    document.getElementById('btn-add-member').addEventListener('click', function () {
        document.getElementById('member-form').reset();
        document.getElementById('member-id').value = '';
        document.getElementById('member-modal-title').textContent = 'Add Member';
        document.getElementById('m-category').value = 'Fellow Member (FM)';
        document.getElementById('m-fund').value = appSettings['DEFAULT_MONTHLY_FUND'] || 500;
        document.getElementById('member-modal').classList.add('active');
    });

    document.getElementById('member-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        const id = document.getElementById('member-id').value;
        const data = {
            'Name': document.getElementById('m-name').value,
            'Phone Number': document.getElementById('m-phone').value,
            'Designation': document.getElementById('m-designation').value,
            'Member Category': document.getElementById('m-category').value,
            'Monthly Fund': document.getElementById('m-fund').value,
            'Remarks': document.getElementById('m-remarks').value
        };
        if (!id) {
            data['Previous Balance'] = Number(document.getElementById('m-prev-balance').value) || 0;
            data['Total Payable'] = Number(data['Monthly Fund']) + data['Previous Balance'];
            data['Amount Paid'] = 0;
            data['Remaining Balance'] = data['Total Payable'];
            data['Payment Status'] = 'Pending';
        }
        const btn = document.getElementById('btn-save-member');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        try {
            if (id) {
                await api.put('/api/members/' + id, { month: appInstance.state.currentMonth, data: data });
                utils.showToast('Member updated');
            } else {
                await api.post('/api/members', { month: appInstance.state.currentMonth, data: data });
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

    document.getElementById('payment-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        const pid = document.getElementById('p-member-id').value;
        const pdata = {
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
            await api.post('/api/payments/' + pid, pdata);
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

window.membersJS = {
    openEditModal: function (id) {
        const m = allMembers.find(function (x) { return x._rowId === id; });
        if (!m) return;
        document.getElementById('member-id').value = m._rowId;
        document.getElementById('m-name').value = m['Name'];
        document.getElementById('m-phone').value = m['Phone Number'];
        document.getElementById('m-designation').value = m['Designation'];
        document.getElementById('m-category').value = m['Member Category'] || 'Fellow Member (FM)';
        document.getElementById('m-fund').value = m['Monthly Fund'];
        document.getElementById('m-prev-balance').value = m['Previous Balance'] || 0;
        document.getElementById('m-remarks').value = m['Remarks'];
        document.getElementById('member-modal-title').textContent = 'Edit Member';
        document.getElementById('member-modal').classList.add('active');
    },

    deleteMember: async function (id) {
        if (!confirm('Are you sure you want to delete this member?')) return;
        try {
            await api.delete('/api/members/' + id + '?month=' + encodeURIComponent(appInstance.state.currentMonth));
            utils.showToast('Member deleted');
            await loadMembers();
        } catch (e) {
            utils.showToast('Failed to delete', 'error');
        }
    },

    openPaymentModal: function (id) {
        const m = allMembers.find(function (x) { return x._rowId === id; });
        if (!m) return;
        document.getElementById('p-member-id').value = m._rowId;
        document.getElementById('p-member-name').textContent = m['Name'];
        document.getElementById('p-total-payable').value = m['Total Payable'];
        document.getElementById('p-display-due').textContent = utils.formatCurrency(m['Total Payable']);
        const existingPaid = Number(m['Amount Paid']) || 0;
        document.getElementById('p-amount').value = existingPaid > 0 ? existingPaid : m['Total Payable'];
        const existingDate = m['Payment Date'] || '';
        document.getElementById('p-date').value = existingDate || new Date().toISOString().split('T')[0];
        document.getElementById('p-remarks').value = m['Remarks'] || '';
        document.getElementById('payment-modal').classList.add('active');
    },

    sendWhatsApp: function (id) {
        const m = allMembers.find(function (x) { return x._rowId === id; });
        if (!m) return;
        const msg = generateReminderText(m);
        const link = utils.generateWhatsAppLink(m['Phone Number'], msg);
        window.open(link, '_blank');
    },

    copyText: function (btn, text) {
        navigator.clipboard.writeText(text).then(function () {
            const original = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(function () { btn.textContent = original; }, 2000);
        });
    },

    showHistory: async function (id) {
        const m = allMembers.find(function (x) { return x._rowId === id; });
        if (!m) return;
        utils.showLoader();
        try {
            const res = await api.get('/api/members/history?name=' + encodeURIComponent(m['Name']));
            if (res.success) {
                const history = res.data;
                let html = '';
                if (history.length === 0) {
                    html = '<div class="text-center text-muted p-md">No history found.</div>';
                } else {
                    html = '<div class="table-responsive"><table class="table"><thead><tr>' +
                        '<th>Month</th><th>Category</th><th>Monthly Fund</th><th>Prev Bal</th><th>Total Payable</th>' +
                        '<th>Amount Paid</th><th>Remaining</th><th>Status</th><th>Payment Date</th></tr></thead><tbody>';
                    var totalPaid = 0;
                    history.forEach(function (h) {
                        totalPaid += Number(h['Amount Paid']) || 0;
                        var sBadge = '<span class="badge badge-default">' + (h['Payment Status'] || '') + '</span>';
                        if (h['Payment Status'] === 'Paid') sBadge = '<span class="badge badge-success">Paid</span>';
                        if (h['Payment Status'] === 'Partially Paid') sBadge = '<span class="badge badge-warning">Partially Paid</span>';
                        if (h['Payment Status'] === 'Pending') sBadge = '<span class="badge badge-danger">Pending</span>';
                        html += '<tr><td>' + (h.month || '') + '</td>' +
                            '<td>' + (h['Member Category'] || 'Fellow Member (FM)') + '</td>' +
                            '<td>' + utils.formatCurrency(h['Monthly Fund']) + '</td>' +
                            '<td>' + utils.formatCurrency(h['Previous Balance']) + '</td>' +
                            '<td>' + utils.formatCurrency(h['Total Payable']) + '</td>' +
                            '<td class="text-success">' + utils.formatCurrency(h['Amount Paid']) + '</td>' +
                            '<td class="text-danger">' + utils.formatCurrency(h['Remaining Balance']) + '</td>' +
                            '<td>' + sBadge + '</td>' +
                            '<td>' + utils.formatDate(h['Payment Date']) + '</td></tr>';
                    });
                    html += '</tbody></table></div>';
                    html += '<div class="p-md text-right font-bold">Total Paid All Months: ' + utils.formatCurrency(totalPaid) + '</div>';
                }
                showHistoryModal(m['Name'], html);
            }
        } catch (error) {
            utils.showToast('Failed to load history', 'error');
        } finally {
            utils.hideLoader();
        }
    }
};

function showHistoryModal(name, html) {
    var existing = document.getElementById('history-modal-overlay');
    if (!existing) {
        var overlay = document.createElement('div');
        overlay.id = 'history-modal-overlay';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = '<div class="modal" style="max-width: 800px;"><div class="modal-header">' +
            '<h3 class="modal-title" id="history-modal-title">Member History</h3>' +
            '<button class="modal-close" onclick="document.getElementById(\'history-modal-overlay\').classList.remove(\'active\')">&times;</button></div>' +
            '<div class="modal-body" id="history-modal-body"></div>' +
            '<div class="modal-footer"><button class="btn btn-outline" onclick="document.getElementById(\'history-modal-overlay\').classList.remove(\'active\')">Close</button></div></div>';
        document.body.appendChild(overlay);
    }
    document.getElementById('history-modal-body').innerHTML = html;
    document.getElementById('history-modal-title').textContent = 'History - ' + name;
    document.getElementById('history-modal-overlay').classList.add('active');
}

function generateReminderText(m) {
    let msg = '*United Pakistan - ' + (appSettings['SECTOR_NAME'] || '[Sector Name]') + '*\n\n';
    msg += 'Assalamu Alaikum ' + (m['Name'] || '') + ' sb!\n\n';
    msg += 'This is a gentle reminder regarding your monthly fund.\n\n';
    msg += 'Fund Details:\n';
    msg += '- Member Category: ' + (m['Member Category'] || 'Fellow Member (FM)') + '\n';
    msg += '- Monthly Fund: ' + utils.formatCurrency(m['Monthly Fund']) + '\n';
    if (Number(m['Previous Balance']) > 0) {
        msg += '- Previous Balance: ' + utils.formatCurrency(m['Previous Balance']) + '\n';
    }
    msg += '- Total Payable: ' + utils.formatCurrency(m['Total Payable']) + '\n\n';
    msg += 'Payment Details:\n';
    msg += 'Easypaisa: ' + (appSettings['EASYPAISA_NUMBER'] || '[Number]') + '\n';
    msg += 'Account Title: ' + (appSettings['ACCOUNT_TITLE'] || '[Title]') + '\n\n';
    msg += 'Kindly transfer the amount and share the receipt.\n\n';
    msg += 'Thank you.\n';
    msg += (appSettings['SECRETARY_NAME'] || '[Secretary Name]') + '\nSecretary Finance';
    return msg;
}

function generateBulkReminders() {
    const pending = allMembers.filter(function (m) {
        return m['Payment Status'] === 'Pending' || m['Payment Status'] === 'Partially Paid';
    });
    const list = document.getElementById('reminders-list');
    list.innerHTML = '';
    if (pending.length === 0) {
        list.innerHTML = '<div class="p-md text-center text-muted">Everyone is fully paid!</div>';
    } else {
        pending.forEach(function (m) {
            const msg = generateReminderText(m);
            const item = document.createElement('div');
            item.className = 'p-md border-bottom';
            item.innerHTML = '<div class="flex justify-between align-center mb-sm">' +
                '<h4 class="font-bold">' + (m['Name'] || '') + '</h4>' +
                '<div class="flex gap-sm">' +
                '<button class="btn btn-sm btn-outline copy-btn">Copy</button>' +
                '<a href="' + utils.generateWhatsAppLink(m['Phone Number'], msg) + '" target="_blank" class="btn btn-sm btn-primary">WhatsApp</a>' +
                '</div></div>' +
                '<pre class="text-sm bg-gray p-sm" style="white-space: pre-wrap; font-family: inherit; border-radius: 4px;">' + msg + '</pre>';
            item.querySelector('.copy-btn').addEventListener('click', function () {
                window.membersJS.copyText(this, msg);
            });
            list.appendChild(item);
        });
    }
    document.getElementById('reminders-modal').classList.add('active');
}

function copyAllReminders() {
    const pending = allMembers.filter(function (m) {
        return m['Payment Status'] === 'Pending' || m['Payment Status'] === 'Partially Paid';
    });
    let allText = '';
    pending.forEach(function (m) {
        allText += '--- TO: ' + (m['Name'] || '') + ' (' + (m['Phone Number'] || '') + ') ---\n';
        allText += generateReminderText(m) + '\n\n';
    });
    if (!allText) {
        utils.showToast('No reminders to copy');
        return;
    }
    const btn = document.getElementById('btn-copy-all-reminders');
    navigator.clipboard.writeText(allText).then(function () {
        btn.textContent = 'Copied All!';
        setTimeout(function () { btn.textContent = 'Copy All Text'; }, 2000);
    });
}
