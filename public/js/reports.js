import { api } from './api.js';
import { utils } from './utils.js';
import { setupExportListeners } from './export.js';

let appInstance = null;
let chartInstance = null;
let currentMembers = [];
let currentFollowUps = [];
let currentSummary = null;

export async function init(app) {
    appInstance = app;
    setupExportListeners(appInstance);
    setupWhatsAppReport();

    if (app.state.currentMonth) {
        await loadReportData();
    }

    window.addEventListener('monthChanged', loadReportData);
}

async function loadReportData() {
    if (!appInstance.state.currentMonth) return;

    try {
        const [membersRes, expensesRes, followUpsRes] = await Promise.all([
            api.get('/api/members?month=' + encodeURIComponent(appInstance.state.currentMonth)),
            api.get('/api/expenses?month=' + encodeURIComponent(appInstance.state.currentMonth)),
            api.get('/api/followups?month=' + encodeURIComponent(appInstance.state.currentMonth)).catch(function () {
                return { success: false, data: [] };
            })
        ]);

        const members = membersRes.success ? membersRes.data : [];
        const expenses = expensesRes.success ? expensesRes.data : [];
        const followUps = followUpsRes.success ? followUpsRes.data : [];
        currentMembers = members;
        currentFollowUps = followUps;

        document.getElementById('reports-skeleton').style.display = 'none';
        document.getElementById('reports-content').style.display = 'block';

        updateStats(members, expenses, followUps);
        renderExpenseCategoryBreakdown(expenses);
        renderChart(members);
    } catch (error) {
        utils.showToast('Failed to load report data', 'error');
        document.getElementById('reports-skeleton').style.display = 'none';
        document.getElementById('reports-content').style.display = 'block';
    }
}

function updateStats(members, expenses, followUps) {
    let totalCollected = 0;
    let totalOutstanding = 0;
    let totalDue = 0;
    let totalMonthlyFund = 0;
    let totalPrevBal = 0;
    let paidCount = 0, partialCount = 0, pendingCount = 0;
    let paidAmt = 0, partialAmt = 0;
    let pendingAmt = 0;
    let partialRemainingAmt = 0;

    members.forEach(function(m) {
        const paid = Number(m['Amount Paid']) || 0;
        const remaining = Number(m['Remaining Balance']) || 0;
        const due = Number(m['Total Payable']) || 0;
        const fund = Number(m['Monthly Fund']) || 0;
        const prev = Number(m['Previous Balance']) || 0;

        totalCollected += paid;
        totalOutstanding += remaining;
        totalDue += due;
        totalMonthlyFund += fund;
        totalPrevBal += prev;

        if (m['Payment Status'] === 'Paid') { paidCount++; paidAmt += paid; }
        else if (m['Payment Status'] === 'Partially Paid') { partialCount++; partialAmt += paid; partialRemainingAmt += remaining; }
        else { pendingCount++; pendingAmt += remaining; }
    });

    const totalExpense = expenses.reduce(function(s, e) { return s + (Number(e['Amount']) || 0); }, 0);
    const collectionPct = totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 0;
    const targetPct = members.length > 0 ? Math.round((paidCount / members.length) * 100) : 0;

    let fundCollected = 0;
    let fundRemaining = 0;
    members.forEach(function(m) {
        const paid = Number(m['Amount Paid']) || 0;
        const fund = Number(m['Monthly Fund']) || 0;
        const memberFundCollected = Math.min(paid, fund);
        fundCollected += memberFundCollected;
        fundRemaining += Math.max(fund - memberFundCollected, 0);
    });

    // Collection overview
    document.getElementById('r-collected').textContent = utils.formatCurrency(totalCollected);
    document.getElementById('r-total-due').textContent = utils.formatCurrency(totalDue);
    document.getElementById('r-outstanding').textContent = utils.formatCurrency(totalOutstanding);
    document.getElementById('r-rate').textContent = collectionPct + '%';
    document.getElementById('r-target-pct').textContent = targetPct + '%';
    document.getElementById('r-target-text').textContent = paidCount + ' of ' + members.length + ' members';

    document.getElementById('r-fund-total').textContent = utils.formatCurrency(totalMonthlyFund);
    document.getElementById('r-prev-balances').textContent = utils.formatCurrency(totalPrevBal);
    document.getElementById('r-fund-collected').textContent = utils.formatCurrency(fundCollected);
    document.getElementById('r-fund-remaining').textContent = utils.formatCurrency(fundRemaining);

    // Expense overview
    const expenseRatio = fundCollected > 0 ? Math.round((totalExpense / fundCollected) * 100) : 0;
    document.getElementById('r-total-expense').textContent = utils.formatCurrency(totalExpense);
    document.getElementById('r-expense-count').textContent = expenses.length + ' transactions';
    if (expenses.length === 0) {
        document.getElementById('r-expense-count').textContent = '0 transactions';
    }

    var netEl = document.getElementById('r-net');
    var netLabel = document.getElementById('r-net-label');
    const fundAfterExpense = fundCollected - totalExpense;
    netEl.textContent = utils.formatCurrency(fundAfterExpense);
    if (fundAfterExpense >= 0) {
        netEl.className = 'text-2xl font-bold mt-sm text-success';
        netLabel.textContent = 'Monthly fund left after expenses';
    } else {
        netEl.className = 'text-2xl font-bold mt-sm text-danger';
        netLabel.textContent = 'Expenses exceed monthly fund collected';
    }

    document.getElementById('r-expense-ratio').textContent = expenseRatio + '%';
    document.getElementById('r-avg-expense').textContent = utils.formatCurrency(
        totalExpense && expenses.length ? Math.round(totalExpense / expenses.length) : 0
    );

    // Member status breakdown
    document.getElementById('r-total-members').textContent = members.length;
    document.getElementById('r-paid-count').textContent = paidCount;
    document.getElementById('r-paid-amount').textContent = utils.formatCurrency(paidAmt) + ' collected';
    document.getElementById('r-partial-count').textContent = partialCount;
    document.getElementById('r-partial-amount').textContent = utils.formatCurrency(partialAmt) + ' collected';
    document.getElementById('r-pending-count').textContent = pendingCount;
    document.getElementById('r-pending-amount').textContent = utils.formatCurrency(totalOutstanding) + ' due';

    currentSummary = {
        totalMembers: members.length,
        paidCount,
        partialCount,
        pendingCount,
        paidAmt,
        partialAmt,
        pendingAmt,
        partialRemainingAmt,
        totalCollected,
        totalOutstanding,
        totalDue,
        totalMonthlyFund,
        totalPrevBal,
        fundCollected,
        fundRemaining,
        totalExpense,
        fundAfterExpense,
        collectionPct,
        followUps: buildFollowUpReportSummary(members, followUps)
    };
}

function renderChart(members) {
    var ctx = document.getElementById('statusChart');
    if (!ctx) return;

    var paidCount = 0, partialCount = 0, pendingCount = 0;
    members.forEach(function(m) {
        if (m['Payment Status'] === 'Paid') paidCount++;
        else if (m['Payment Status'] === 'Partially Paid') partialCount++;
        else pendingCount++;
    });

    if (chartInstance) chartInstance.destroy();

    if (typeof Chart === 'undefined') return;

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Paid (' + paidCount + ')', 'Partially Paid (' + partialCount + ')', 'Pending (' + pendingCount + ')'],
            datasets: [{
                data: [paidCount, partialCount, pendingCount],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function renderExpenseCategoryBreakdown(expenses) {
    const tbody = document.getElementById('r-expense-category-tbody');
    if (!tbody) return;
    const total = expenses.reduce(function(sum, e) { return sum + (Number(e.Amount) || 0); }, 0);
    const categories = {};
    expenses.forEach(function(e) {
        const category = e.Category || 'Uncategorized';
        if (!categories[category]) categories[category] = { count: 0, total: 0 };
        categories[category].count += 1;
        categories[category].total += Number(e.Amount) || 0;
    });
    const rows = Object.keys(categories).sort(function(a, b) {
        return categories[b].total - categories[a].total;
    });
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted p-md">No expenses recorded.</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map(function(category) {
        const item = categories[category];
        const share = total > 0 ? Math.round((item.total / total) * 100) : 0;
        return '<tr>' +
            '<td data-label="Category"><span class="badge badge-default">' + category + '</span></td>' +
            '<td data-label="Transactions">' + item.count + '</td>' +
            '<td data-label="Total Amount" class="font-bold text-danger">' + utils.formatCurrency(item.total) + '</td>' +
            '<td data-label="Share">' + share + '%</td>' +
            '</tr>';
    }).join('');
}

function setupWhatsAppReport() {
    const btn = document.getElementById('btn-whatsapp-report');
    if (!btn) return;

    if (appInstance.isReadOnly()) {
        btn.classList.add('hidden');
        return;
    }

    btn.addEventListener('click', async function() {
        if (appInstance.isReadOnly()) {
            utils.showToast('Only admins can share WhatsApp reports', 'warning');
            return;
        }

        if (!currentSummary) {
            utils.showToast('Report data is still loading', 'warning');
            return;
        }

        const message = buildWhatsAppReportMessage();
        try {
            await copyText(message);
            utils.showToast('WhatsApp report copied');
            window.open('https://wa.me/?text=' + encodeURIComponent(message), '_blank');
        } catch (error) {
            utils.showToast('Could not copy report. Please try again.', 'error');
        }
    });
}

function buildWhatsAppReportMessage() {
    const month = appInstance.state.currentMonth || 'Current Month';
    const summary = currentSummary;
    const followSummary = summary.followUps || buildFollowUpReportSummary(currentMembers, currentFollowUps);
    const partialMembers = currentMembers.filter(function(m) { return m['Payment Status'] === 'Partially Paid'; });
    const pendingMembers = currentMembers.filter(function(m) {
        return m['Payment Status'] !== 'Paid' && m['Payment Status'] !== 'Partially Paid';
    });

    let msg = '*United Pakistan - Sector Finance Report*\n';
    msg += '*' + month + '*\n\n';
    msg += '*Members Summary*\n';
    msg += '- Total Members: ' + summary.totalMembers + '\n';
    msg += '- Fully Paid: ' + summary.paidCount + '\n';
    msg += '- Partially Paid: ' + summary.partialCount + ' (' + utils.formatCurrency(summary.partialRemainingAmt) + ' remaining)\n';
    msg += '- Pending: ' + summary.pendingCount + ' (' + utils.formatCurrency(summary.pendingAmt) + ' due)\n\n';
    msg += '*Follow-up Summary*\n';
    msg += '- Members Reminded: ' + followSummary.reminded + '\n';
    msg += '- Awaiting Reply: ' + followSummary.awaiting + '\n';
    msg += '- Promised to Pay: ' + followSummary.promised + '\n';
    msg += '- Due Follow-ups Today: ' + followSummary.due + '\n';
    msg += '- Reasons Recorded: ' + followSummary.withReason + '\n\n';

    msg += '*Collection Summary*\n';
    msg += '- Total Due: ' + utils.formatCurrency(summary.totalDue) + '\n';
    msg += '- Total Collected: ' + utils.formatCurrency(summary.totalCollected) + '\n';
    msg += '- Total Remaining: ' + utils.formatCurrency(summary.totalOutstanding) + '\n';
    msg += '- Collection Rate: ' + summary.collectionPct + '%\n\n';

    msg += '*Fund & Expenses*\n';
    msg += '- Monthly Fund Total: ' + utils.formatCurrency(summary.totalMonthlyFund) + '\n';
    msg += '- Monthly Fund Collected: ' + utils.formatCurrency(summary.fundCollected) + '\n';
    msg += '- Expenses Made: ' + utils.formatCurrency(summary.totalExpense) + '\n';
    msg += '- Remaining After Expenses: ' + utils.formatCurrency(summary.fundAfterExpense) + '\n';
    if (summary.totalPrevBal > 0) {
        msg += '- Previous Balances: ' + utils.formatCurrency(summary.totalPrevBal) + '\n';
    }

    if (partialMembers.length > 0) {
        msg += '\n*Partially Paid Members*\n';
        partialMembers.forEach(function(m) {
            msg += '- ' + (m['Name'] || 'Member') + ': paid ' + utils.formatCurrency(m['Amount Paid']) + ', remaining ' + utils.formatCurrency(m['Remaining Balance']) + '\n';
        });
    }

    if (pendingMembers.length > 0) {
        msg += '\n*Pending Members*\n';
        pendingMembers.forEach(function(m) {
            const follow = buildMemberFollowUpSummary(m, currentFollowUps);
            msg += '- ' + (m['Name'] || 'Member') + ': ' + utils.formatCurrency(m['Remaining Balance']) + ' due';
            if (follow.reminderCount > 0) msg += ', reminders ' + follow.reminderCount;
            if (follow.latestReplyStatus) msg += ', ' + follow.latestReplyStatus;
            if (follow.reason) msg += ', reason: ' + follow.reason;
            msg += '\n';
        });
    }

    msg += '\nPlease clear remaining dues at the earliest.\n';
    msg += 'Thank you.';
    return msg;
}

function buildFollowUpReportSummary(members, followUps) {
    const unpaid = members.filter(function(m) { return m['Payment Status'] !== 'Paid' && (Number(m['Remaining Balance']) || 0) > 0; });
    const summaries = unpaid.map(function(member) { return buildMemberFollowUpSummary(member, followUps); });
    return {
        reminded: summaries.filter(function(item) { return item.reminderCount > 0; }).length,
        awaiting: summaries.filter(function(item) { return item.awaitingReply; }).length,
        promised: summaries.filter(function(item) { return item.latestReplyStatus === 'Promised'; }).length,
        due: summaries.filter(function(item) { return item.reminderCount === 0 || item.nextDue; }).length,
        withReason: summaries.filter(function(item) { return !!item.reason; }).length
    };
}

function buildMemberFollowUpSummary(member, followUps) {
    const phone = normalizePhone(member['Phone Number']);
    const name = String(member['Name'] || '').trim().toLowerCase();
    const items = followUps.filter(function(item) {
        const samePhone = phone && normalizePhone(item['Phone Number']) === phone;
        const sameName = name && String(item['Member Name'] || '').trim().toLowerCase() === name;
        return samePhone || sameName;
    }).sort(function(a, b) {
        return new Date(a['Event Date'] || 0) - new Date(b['Event Date'] || 0);
    });
    const reminders = items.filter(function(item) { return item['Event Type'] === 'Reminder Sent'; });
    const responseLogs = items.filter(function(item) { return item['Event Type'] === 'Reply Received'; });
    const replies = responseLogs.filter(function(item) { return item['Reply Status'] !== 'No Reply'; });
    const latestReminder = reminders[reminders.length - 1] || null;
    const latestReply = replies[replies.length - 1] || null;
    const latestResponseLog = responseLogs[responseLogs.length - 1] || null;
    const latestItem = items[items.length - 1] || null;
    const nextDate = latestItem ? latestItem['Next Reminder Date'] : '';
    return {
        reminderCount: reminders.length,
        lastReminderDate: latestReminder ? latestReminder['Event Date'] : '',
        awaitingReply: !!latestReminder && (!latestReply || new Date(latestReply['Event Date'] || 0) < new Date(latestReminder['Event Date'] || 0)),
        latestReplyStatus: latestResponseLog ? latestResponseLog['Reply Status'] : '',
        reason: latestResponseLog ? latestResponseLog['Reason / Reply'] : '',
        nextDate: nextDate,
        nextDue: nextDate && startOfDay(nextDate) <= startOfDay(new Date())
    };
}

function normalizePhone(phone) {
    return String(phone || '').replace(/\D/g, '');
}

function startOfDay(value) {
    const d = value instanceof Date ? new Date(value) : new Date(value);
    if (isNaN(d.getTime())) return new Date(8640000000000000);
    d.setHours(0, 0, 0, 0);
    return d;
}

async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Copy failed');
}
