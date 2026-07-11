import { api } from './api.js';
import { utils } from './utils.js';

let appInstance = null;
let allMembers = [];
let allFollowUps = [];
let currentReminderMembers = [];
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
        el = document.getElementById('btn-due-reminders');
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
        const [membersRes, followUpsRes] = await Promise.all([
            api.get('/api/members?month=' + encodeURIComponent(appInstance.state.currentMonth)),
            api.get('/api/followups?month=' + encodeURIComponent(appInstance.state.currentMonth)).catch(function () {
                return { success: false, data: [] };
            })
        ]);
        if (membersRes.success) {
            allMembers = membersRes.data || [];
            allFollowUps = followUpsRes && followUpsRes.success ? followUpsRes.data || [] : [];
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
    const followupFilter = document.getElementById('followup-filter').value;

    let filtered = allMembers.filter(function (m) {
        const followSummary = getFollowUpSummary(m);
        const matchesSearch = (m['Name'] || '').toLowerCase().includes(searchTerm) ||
            (m['Phone Number'] || '').includes(searchTerm) ||
            (m['Member Category'] || '').toLowerCase().includes(searchTerm) ||
            (followSummary.reason || '').toLowerCase().includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || m['Payment Status'] === statusFilter;
        return matchesSearch && matchesStatus && matchesFollowUpFilter(followSummary, followupFilter);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted p-md">No members found.</td></tr>';
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
        const followSummary = getFollowUpSummary(m);
        let statusBadge = '<span class="badge badge-default">' + (m['Payment Status'] || '') + '</span>';
        if (m['Payment Status'] === 'Paid') statusBadge = '<span class="badge badge-success">Paid</span>';
        if (m['Payment Status'] === 'Partially Paid') statusBadge = '<span class="badge badge-warning">Partially Paid</span>';
        if (m['Payment Status'] === 'Pending') statusBadge = '<span class="badge badge-danger">Pending</span>';

        let actionsHtml = '<span class="text-muted text-sm">Read only</span>';
        if (!isReadOnly) {
            actionsHtml = '<div class="flex gap-sm">' +
                '<button class="btn-icon" title="Mark Payment" onclick="window.membersJS.openPaymentModal(' + m._rowId + ')"><i data-lucide="dollar-sign"></i></button>' +
                '<button class="btn-icon" title="Send WhatsApp" onclick="window.membersJS.sendWhatsApp(' + m._rowId + ')"><i data-lucide="message-circle"></i></button>' +
                '<button class="btn-icon" title="Log Reply" onclick="window.membersJS.openFollowUpModal(' + m._rowId + ')"><i data-lucide="message-square-plus"></i></button>' +
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
            '<td data-label="Follow-up">' + renderFollowUpCell(followSummary) + '</td>' +
            '<td data-label="Actions">' + actionsHtml + '</td>';
        tbody.appendChild(tr);
    });
    renderIcons();
}

function normalizePhone(phone) {
    return String(phone || '').replace(/\D/g, '');
}

function memberFollowUps(member) {
    const phone = normalizePhone(member['Phone Number']);
    const name = String(member['Name'] || '').trim().toLowerCase();
    return allFollowUps.filter(function (item) {
        const samePhone = phone && normalizePhone(item['Phone Number']) === phone;
        const sameName = name && String(item['Member Name'] || '').trim().toLowerCase() === name;
        return samePhone || sameName;
    }).sort(function (a, b) {
        return new Date(a['Event Date'] || 0) - new Date(b['Event Date'] || 0);
    });
}

function getFollowUpSummary(member) {
    const items = memberFollowUps(member);
    const reminders = items.filter(function (item) { return item['Event Type'] === 'Reminder Sent'; });
    const responseLogs = items.filter(function (item) { return item['Event Type'] === 'Reply Received'; });
    const replies = responseLogs.filter(function (item) { return item['Reply Status'] !== 'No Reply'; });
    const latestReminder = reminders[reminders.length - 1] || null;
    const latestReply = replies[replies.length - 1] || null;
    const latestResponseLog = responseLogs[responseLogs.length - 1] || null;
    const latestItem = items[items.length - 1] || null;
    const nextDate = latestItem ? latestItem['Next Reminder Date'] : '';
    const paymentStatus = member['Payment Status'] || 'Pending';
    const paid = paymentStatus === 'Paid' || (Number(member['Remaining Balance']) || 0) <= 0;
    const nextDue = !paid && nextDate && startOfDay(nextDate) <= startOfDay(new Date());
    const awaitingReply = !paid && !!latestReminder && (!latestReply || new Date(latestReply['Event Date'] || 0) < new Date(latestReminder['Event Date'] || 0));
    return {
        items: items,
        reminderCount: reminders.length,
        lastReminderDate: latestReminder ? latestReminder['Event Date'] : '',
        latestReplyStatus: latestResponseLog ? latestResponseLog['Reply Status'] : (latestReminder ? 'No Reply' : ''),
        reason: latestResponseLog ? latestResponseLog['Reason / Reply'] : '',
        nextDate: nextDate,
        paid: paid,
        nextDue: nextDue,
        awaitingReply: awaitingReply,
        hasReason: !!(latestResponseLog && latestResponseLog['Reason / Reply']),
        promised: latestReply && latestReply['Reply Status'] === 'Promised'
    };
}

function startOfDay(value) {
    const d = value instanceof Date ? new Date(value) : new Date(value);
    if (isNaN(d.getTime())) return new Date(8640000000000000);
    d.setHours(0, 0, 0, 0);
    return d;
}

function matchesFollowUpFilter(summary, filter) {
    if (filter === 'all') return true;
    if (filter === 'due') return summary.nextDue || (!summary.paid && summary.reminderCount === 0);
    if (filter === 'awaiting') return summary.awaitingReply;
    if (filter === 'promised') return !!summary.promised;
    if (filter === 'reason') return summary.hasReason;
    return true;
}

function renderFollowUpCell(summary) {
    if (summary.paid) {
        return '<div class="followup-cell"><span class="badge badge-success">Paid</span><small>No reminder needed</small></div>';
    }
    if (summary.reminderCount === 0) {
        return '<div class="followup-cell"><span class="badge badge-warning">Not reminded</span><small>Ready to contact</small></div>';
    }

    var badge = '<span class="badge badge-default">' + summary.reminderCount + ' reminder' + (summary.reminderCount === 1 ? '' : 's') + '</span>';
    if (summary.nextDue) badge = '<span class="badge badge-danger">Reminder due</span>';
    if (summary.promised) badge = '<span class="badge badge-warning">Promised</span>';

    var details = 'Last: ' + utils.formatDate(summary.lastReminderDate);
    if (summary.latestReplyStatus) details += ' | ' + summary.latestReplyStatus;
    if (summary.nextDate) details += ' | Next: ' + utils.formatDate(summary.nextDate);
    if (summary.reason) details += '<br><span class="followup-reason">' + escapeHtml(summary.reason) + '</span>';
    return '<div class="followup-cell">' + badge + '<small>' + details + '</small></div>';
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function setupEventListeners() {
    document.getElementById('search-input').addEventListener('input', renderTable);
    document.getElementById('status-filter').addEventListener('change', renderTable);
    document.getElementById('followup-filter').addEventListener('change', renderTable);

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
            const paidMember = allMembers.find(function (x) { return String(x._rowId) === String(pid); });
            if (paidMember) {
                try {
                    await recordFollowUp(paidMember, {
                        'Event Type': 'Payment Recorded',
                        'Reply Status': 'Paid',
                        'Reason / Reply': 'Payment received: ' + utils.formatCurrency(pdata.amountPaid),
                        'Notes': pdata.remarks || ''
                    }, true);
                } catch (followError) {
                    console.warn('Payment saved, but follow-up history was not recorded', followError);
                }
            }
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
    document.getElementById('btn-due-reminders').addEventListener('click', generateDueReminders);
    document.getElementById('btn-copy-all-reminders').addEventListener('click', copyAllReminders);
    document.getElementById('btn-open-pending-reminders').addEventListener('click', function () { openReminderQueueByStatus('Pending'); });
    document.getElementById('btn-open-partial-reminders').addEventListener('click', function () { openReminderQueueByStatus('Partially Paid'); });
    document.querySelectorAll('.reason-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
            const input = document.getElementById('f-reason');
            const reason = this.dataset.reason || '';
            input.value = input.value ? input.value + '; ' + reason : reason;
            input.focus();
        });
    });
    document.getElementById('followup-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        const id = document.getElementById('f-member-id').value;
        const member = allMembers.find(function (x) { return String(x._rowId) === String(id); });
        if (!member) return;
        const btn = document.getElementById('btn-save-followup');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        try {
            await recordFollowUp(member, {
                'Event Type': 'Reply Received',
                'Reply Status': document.getElementById('f-reply-status').value,
                'Reason / Reply': document.getElementById('f-reason').value,
                'Next Reminder Date': document.getElementById('f-next-date').value,
                'Notes': document.getElementById('f-notes').value
            });
            utils.showToast('Follow-up saved');
            document.getElementById('followup-modal').classList.remove('active');
            await loadMembers();
        } catch (error) {
            utils.showToast(error.message || 'Failed to save follow-up', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save Follow-up';
        }
    });
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

    openFollowUpModal: function (id) {
        const m = allMembers.find(function (x) { return x._rowId === id; });
        if (!m) return;
        const summary = getFollowUpSummary(m);
        document.getElementById('f-member-id').value = m._rowId;
        document.getElementById('f-member-name').textContent = m['Name'] || '';
        document.getElementById('f-reply-status').value = summary.awaitingReply ? 'No Reply' : (summary.latestReplyStatus || 'Replied');
        document.getElementById('f-reason').value = summary.reason || '';
        document.getElementById('f-next-date').value = summary.nextDate ? dateInputValue(summary.nextDate) : '';
        document.getElementById('f-notes').value = '';
        document.getElementById('followup-modal').classList.add('active');
    },

    sendWhatsApp: async function (id) {
        const m = allMembers.find(function (x) { return x._rowId === id; });
        if (!m) return;
        const msg = generateReminderText(m);
        const link = utils.generateWhatsAppLink(m['Phone Number'], msg);
        try {
            await recordFollowUp(m, {
                'Event Type': 'Reminder Sent',
                'Reply Status': 'No Reply',
                'Reason / Reply': '',
                'Notes': 'WhatsApp reminder opened from members table'
            });
            await loadMembers();
        } catch (error) {
            utils.showToast('WhatsApp opened, but reminder history was not saved', 'warning');
        }
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
                html += renderMemberFollowUpHistory(m);
                showHistoryModal(m['Name'], html);
            }
        } catch (error) {
            utils.showToast('Failed to load history', 'error');
        } finally {
            utils.hideLoader();
        }
    }
};

async function recordFollowUp(member, extraData, silent) {
    const data = {
        'Month': appInstance.state.currentMonth,
        'Member Name': member['Name'] || '',
        'Phone Number': member['Phone Number'] || '',
        'Member Category': member['Member Category'] || 'Fellow Member (FM)',
        'Event Date': new Date().toISOString(),
        'Created By': appSettings['SECRETARY_NAME'] || 'Admin',
        ...extraData
    };
    const res = await api.post('/api/followups', { data: data });
    if (res.success && res.data) {
        allFollowUps.push(res.data);
        if (!silent && data['Event Type'] === 'Reminder Sent') {
            utils.showToast('Reminder #' + res.data['Reminder Number'] + ' recorded');
        }
    }
    return res;
}

function dateInputValue(value) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toISOString().split('T')[0];
}

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

function renderMemberFollowUpHistory(member) {
    const items = memberFollowUps(member).slice().sort(function (a, b) {
        return new Date(b['Event Date'] || 0) - new Date(a['Event Date'] || 0);
    });
    let html = '<div class="history-section"><div class="history-section-header"><h4>Reminder & Reply History</h4><span>' + items.length + ' records</span></div>';
    if (!items.length) {
        return html + '<div class="text-center text-muted p-md">No reminder or reply history yet.</div></div>';
    }
    html += '<div class="table-responsive"><table class="table mobile-card-table"><thead><tr>' +
        '<th>Date</th><th>Event</th><th>Reminder #</th><th>Reply</th><th>Reason</th><th>Next Reminder</th><th>By</th></tr></thead><tbody>';
    items.forEach(function (item) {
        html += '<tr>' +
            '<td data-label="Date">' + utils.formatDate(item['Event Date']) + '</td>' +
            '<td data-label="Event">' + escapeHtml(item['Event Type']) + '</td>' +
            '<td data-label="Reminder #">' + (item['Reminder Number'] || '-') + '</td>' +
            '<td data-label="Reply">' + escapeHtml(item['Reply Status'] || '-') + '</td>' +
            '<td data-label="Reason">' + escapeHtml(item['Reason / Reply'] || item['Notes'] || '-') + '</td>' +
            '<td data-label="Next Reminder">' + utils.formatDate(item['Next Reminder Date']) + '</td>' +
            '<td data-label="By">' + escapeHtml(item['Created By'] || '-') + '</td>' +
            '</tr>';
    });
    html += '</tbody></table></div></div>';
    return html;
}

function generateReminderText(m) {
    const summary = getFollowUpSummary(m);
    const nextReminderNumber = summary.reminderCount + 1;
    const isPartial = m['Payment Status'] === 'Partially Paid';
    const amountPaid = Number(m['Amount Paid']) || 0;
    const remainingDue = Number(m['Remaining Balance']) || 0;
    const totalPayable = Number(m['Total Payable']) || 0;
    let msg = '*United Pakistan - ' + (appSettings['SECTOR_NAME'] || '[Sector Name]') + '*\n\n';
    msg += 'Assalamu Alaikum ' + (m['Name'] || '') + ' sb!\n\n';
    msg += buildReminderOpening(summary, nextReminderNumber, isPartial);
    msg += '\n\n';
    msg += 'Fund Details:\n';
    msg += '- Member Category: ' + (m['Member Category'] || 'Fellow Member (FM)') + '\n';
    msg += '- Monthly Fund: ' + utils.formatCurrency(m['Monthly Fund']) + '\n';
    if (Number(m['Previous Balance']) > 0) {
        msg += '- Previous Balance: ' + utils.formatCurrency(m['Previous Balance']) + '\n';
    }
    msg += '- Total Payable: ' + utils.formatCurrency(totalPayable) + '\n';
    if (isPartial) {
        msg += '- Amount Paid: ' + utils.formatCurrency(amountPaid) + '\n';
        msg += '- Remaining Due: ' + utils.formatCurrency(remainingDue) + '\n\n';
    } else {
        msg += '- Due Payable: ' + utils.formatCurrency(remainingDue || totalPayable) + '\n\n';
    }
    msg += 'Payment Details:\n';
    msg += 'Easypaisa: ' + (appSettings['EASYPAISA_NUMBER'] || '[Number]') + '\n';
    msg += 'Account Title: ' + (appSettings['ACCOUNT_TITLE'] || '[Title]') + '\n\n';
    msg += isPartial ? 'Kindly transfer the remaining amount and share the receipt.\n\n' : 'Kindly transfer the amount and share the receipt.\n\n';
    msg += 'Thank you.\n';
    msg += (appSettings['SECRETARY_NAME'] || '[Secretary Name]') + '\nSecretary Finance';
    return msg;
}

function buildReminderOpening(summary, nextReminderNumber, isPartial) {
    if (summary.promised && summary.nextDate && startOfDay(summary.nextDate) <= startOfDay(new Date())) {
        return 'You had kindly shared that payment would be made by ' + utils.formatDate(summary.nextDate) + '. This is a follow-up reminder regarding the ' + (isPartial ? 'remaining balance.' : 'pending monthly fund.');
    }
    if (isPartial) {
        if (nextReminderNumber <= 1) {
            return 'Thank you for the partial payment. This is a gentle reminder for the remaining balance.';
        }
        if (nextReminderNumber === 2) {
            return 'This is a follow-up reminder for your remaining balance. Kindly clear the balance at your earliest convenience.';
        }
        return 'This is another follow-up for the remaining balance. If there is any issue or delay, kindly reply with the reason so we can update our record.';
    }
    if (nextReminderNumber <= 1) {
        return 'This is a gentle reminder regarding your monthly fund.';
    }
    if (nextReminderNumber === 2) {
        return 'This is a follow-up reminder regarding your pending monthly fund. Kindly clear it at your earliest convenience.';
    }
    return 'This is another follow-up regarding your pending monthly fund. If there is any issue or delay, kindly reply with the reason so we can update our record.';
}

function getPendingMembers() {
    return allMembers.filter(function (m) {
        return m['Payment Status'] === 'Pending' || m['Payment Status'] === 'Partially Paid';
    });
}

function getDueReminderMembers() {
    return getPendingMembers().filter(function (m) {
        const summary = getFollowUpSummary(m);
        return summary.reminderCount === 0 || summary.nextDue;
    });
}

function generateBulkReminders() {
    renderReminderModal(getPendingMembers(), 'Pending Reminders');
}

function generateDueReminders() {
    renderReminderModal(getDueReminderMembers(), 'Due Reminders');
}

function renderReminderModal(pending, title) {
    currentReminderMembers = pending;
    const list = document.getElementById('reminders-list');
    document.querySelector('#reminders-modal .modal-title').textContent = title;
    list.innerHTML = '';
    if (pending.length === 0) {
        list.innerHTML = '<div class="p-md text-center text-muted">No reminders are due right now.</div>';
    } else {
        renderReminderSection(list, 'Pending Members', pending.filter(function (m) { return m['Payment Status'] === 'Pending'; }));
        renderReminderSection(list, 'Partially Paid Members', pending.filter(function (m) { return m['Payment Status'] === 'Partially Paid'; }));
    }
    updateReminderQueueButtons();
    document.getElementById('reminders-modal').classList.add('active');
}

function renderReminderSection(list, title, members) {
    if (!members.length) return;
    const section = document.createElement('div');
    section.className = 'reminder-section';
    section.innerHTML = '<div class="reminder-section-title"><h4>' + title + '</h4><span>' + members.length + '</span></div>';
    members.forEach(function (m) {
        const summary = getFollowUpSummary(m);
        const msg = generateReminderText(m);
        const item = document.createElement('div');
        item.className = 'p-md border-bottom';
        item.innerHTML = '<div class="flex justify-between align-center mb-sm">' +
            '<div><h4 class="font-bold">' + (m['Name'] || '') + '</h4><div class="text-sm text-muted">' + summary.reminderCount + ' reminders sent' + (summary.nextDate ? ' | Next: ' + utils.formatDate(summary.nextDate) : '') + ' | Due: ' + utils.formatCurrency(m['Remaining Balance']) + '</div></div>' +
            '<div class="flex gap-sm">' +
            '<button class="btn btn-sm btn-outline copy-btn">Copy</button>' +
            '<button class="btn btn-sm btn-primary whatsapp-btn">WhatsApp</button>' +
            '</div></div>' +
            '<pre class="text-sm bg-gray p-sm" style="white-space: pre-wrap; font-family: inherit; border-radius: 4px;">' + msg + '</pre>';
        item.querySelector('.copy-btn').addEventListener('click', function () {
            window.membersJS.copyText(this, msg);
        });
        item.querySelector('.whatsapp-btn').addEventListener('click', async function () {
            this.disabled = true;
            this.textContent = 'Opening...';
            try {
                await recordFollowUp(m, {
                    'Event Type': 'Reminder Sent',
                    'Reply Status': 'No Reply',
                    'Notes': 'WhatsApp reminder opened from ' + title.toLowerCase()
                });
                window.open(utils.generateWhatsAppLink(m['Phone Number'], msg), '_blank');
                this.textContent = 'Recorded';
                renderTable();
            } catch (error) {
                this.disabled = false;
                this.textContent = 'WhatsApp';
                utils.showToast('Could not record reminder', 'error');
            }
        });
        section.appendChild(item);
    });
    list.appendChild(section);
}

function updateReminderQueueButtons() {
    const pendingCount = currentReminderMembers.filter(function (m) { return m['Payment Status'] === 'Pending'; }).length;
    const partialCount = currentReminderMembers.filter(function (m) { return m['Payment Status'] === 'Partially Paid'; }).length;
    const pendingBtn = document.getElementById('btn-open-pending-reminders');
    const partialBtn = document.getElementById('btn-open-partial-reminders');
    pendingBtn.disabled = pendingCount === 0;
    partialBtn.disabled = partialCount === 0;
    pendingBtn.textContent = 'Open Pending Queue (' + pendingCount + ')';
    partialBtn.textContent = 'Open Partial Queue (' + partialCount + ')';
}

function copyAllReminders() {
    const pending = currentReminderMembers.length ? currentReminderMembers : getPendingMembers();
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

async function openReminderQueueByStatus(status) {
    const source = currentReminderMembers.length ? currentReminderMembers : getDueReminderMembers();
    const members = source.filter(function (m) { return m['Payment Status'] === status; });
    const btn = status === 'Partially Paid' ? document.getElementById('btn-open-partial-reminders') : document.getElementById('btn-open-pending-reminders');
    if (!members.length) {
        utils.showToast('No ' + status.toLowerCase() + ' reminders to open');
        return;
    }
    btn.disabled = true;
    btn.textContent = 'Opening...';
    var opened = 0;
    try {
        for (const m of members) {
            const msg = generateReminderText(m);
            await recordFollowUp(m, {
                'Event Type': 'Reminder Sent',
                'Reply Status': 'No Reply',
                'Notes': 'WhatsApp queue opened'
            }, true);
            const win = window.open(utils.generateWhatsAppLink(m['Phone Number'], msg), '_blank');
            if (win) opened++;
        }
        utils.showToast(opened + ' WhatsApp reminder tabs opened');
        await loadMembers();
        document.getElementById('reminders-modal').classList.remove('active');
    } catch (error) {
        utils.showToast(error.message || 'Could not open all reminders', 'error');
    } finally {
        btn.disabled = false;
        updateReminderQueueButtons();
    }
}
