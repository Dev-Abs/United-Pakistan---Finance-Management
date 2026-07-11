import { api } from './api.js';
import { utils } from './utils.js';

let appInstance = null;
let chartInstances = {};
let currentDashboardSummary = null;
let currentDashboardMembers = [];
let currentDashboardExpenses = [];
let currentDashboardFollowUps = [];

export async function init(app) {
    appInstance = app;

    if (app.isReadOnly()) {
        ['btn-add-expense-dash', 'btn-dash-new-month'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        const shareBtn = document.getElementById('btn-dashboard-whatsapp-report');
        if (shareBtn) shareBtn.style.display = 'none';
    }

    if (app.state.currentMonth) {
        await loadDashboardData();
    }

    window.addEventListener('monthChanged', loadDashboardData);
    setupEventListeners();
}

function showDashboardContent() {
    document.querySelectorAll('#dash-stats-grid .skeleton').forEach(function(el) { el.style.display = 'none'; });
    document.querySelectorAll('#dash-stats-grid .dash-stat-loaded').forEach(function(el) { el.style.display = 'grid'; });
    document.querySelectorAll('#dash-charts-grid .skeleton').forEach(function(el) { el.style.display = 'none'; });
    document.querySelectorAll('#dash-charts-grid .dash-chart-loaded').forEach(function(el) { el.style.display = 'block'; });
    document.getElementById('dash-payments-tbody') && (document.getElementById('dash-payments-tbody').innerHTML = '');
    document.getElementById('dash-expenses-tbody') && (document.getElementById('dash-expenses-tbody').innerHTML = '');
}

async function loadDashboardData() {
    if (!appInstance.state.currentMonth) return;

    try {
        const prevMonth = getPreviousMonth();
        const [membersRes, expensesRes, followUpsRes] = await Promise.all([
            api.get('/api/members?month=' + encodeURIComponent(appInstance.state.currentMonth)),
            api.get('/api/expenses?month=' + encodeURIComponent(appInstance.state.currentMonth)),
            api.get('/api/followups?month=' + encodeURIComponent(appInstance.state.currentMonth)).catch(function () {
                return { success: false, data: [] };
            })
        ]);

        if (membersRes.success) {
            const members = membersRes.data || [];
            const expenses = (expensesRes.success ? expensesRes.data : []) || [];
            const followUps = (followUpsRes.success ? followUpsRes.data : []) || [];
            let previousSummary = null;
            if (prevMonth) {
                try {
                    const [prevMembersRes, prevExpensesRes] = await Promise.all([
                        api.get('/api/members?month=' + encodeURIComponent(prevMonth)),
                        api.get('/api/expenses?month=' + encodeURIComponent(prevMonth))
                    ]);
                    previousSummary = buildSummary(prevMembersRes.success ? prevMembersRes.data || [] : [], prevExpensesRes.success ? prevExpensesRes.data || [] : []);
                } catch (e) {
                    previousSummary = null;
                }
            }
            currentDashboardMembers = members;
            currentDashboardExpenses = expenses;
            currentDashboardFollowUps = followUps;
            showDashboardContent();
            updateStats(members, expenses, previousSummary);
            updateTopPendingMembers(members);
            updateFollowUpTracker(members, followUps);
            updateActivityLog(members, expenses);
            updateRecentPayments(members);
            updateRecentExpenses(expenses);
            renderCharts(members, expenses);
        }
    } catch (error) {
        console.error('Failed to load dashboard data', error);
        utils.showToast('Failed to load data', 'error');
        showDashboardContent();
    }
}

function getPreviousMonth() {
    const months = appInstance.state.months || [];
    const index = months.indexOf(appInstance.state.currentMonth);
    return index > 0 ? months[index - 1] : '';
}

function buildSummary(members, expenses) {
    let totalCollected = 0;
    let totalOutstanding = 0;
    let totalDue = 0;
    let totalMonthlyFund = 0;
    let totalPreviousBalance = 0;
    let monthlyFundCollected = 0;
    let previousBalanceCollected = 0;
    let dueMonthlyFund = 0;
    let duePreviousBalance = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let partialCount = 0;

    members.forEach(function(m) {
        var paid = Number(m['Amount Paid']) || 0;
        var remaining = Number(m['Remaining Balance']) || 0;
        var payable = Number(m['Total Payable']) || 0;
        var monthlyFund = Number(m['Monthly Fund']) || 0;
        var previousBalance = Number(m['Previous Balance']) || 0;
        var memberFundCollected = Math.min(paid, monthlyFund);
        var memberPrevCollected = Math.min(Math.max(paid - monthlyFund, 0), previousBalance);

        totalCollected += paid;
        totalOutstanding += remaining;
        totalDue += payable;
        totalMonthlyFund += monthlyFund;
        totalPreviousBalance += previousBalance;
        monthlyFundCollected += memberFundCollected;
        previousBalanceCollected += memberPrevCollected;
        dueMonthlyFund += Math.max(monthlyFund - memberFundCollected, 0);
        duePreviousBalance += Math.max(previousBalance - memberPrevCollected, 0);

        if (m['Payment Status'] === 'Paid') paidCount++;
        else if (m['Payment Status'] === 'Partially Paid') partialCount++;
        else pendingCount++;
    });

    const totalExpense = expenses.reduce(function(sum, e) { return sum + (Number(e['Amount']) || 0); }, 0);
    const netAmount = monthlyFundCollected - totalExpense;
    const pct = totalMonthlyFund > 0 ? Math.round((monthlyFundCollected / totalMonthlyFund) * 100) : 0;
    const collectionRate = totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 0;
    const memberTotal = members.length || 0;
    const paidPct = memberTotal > 0 ? Math.round((paidCount / memberTotal) * 100) : 0;
    const partialPct = memberTotal > 0 ? Math.round((partialCount / memberTotal) * 100) : 0;
    const pendingPct = memberTotal > 0 ? Math.max(0, 100 - paidPct - partialPct) : 0;

    return {
        totalCollected,
        totalOutstanding,
        totalDue,
        totalMonthlyFund,
        totalPreviousBalance,
        monthlyFundCollected,
        previousBalanceCollected,
        dueMonthlyFund,
        duePreviousBalance,
        paidCount,
        pendingCount,
        partialCount,
        totalExpense,
        netAmount,
        monthlyFundCollectionPct: pct,
        collectionRate,
        memberTotal,
        paidPct,
        partialPct,
        pendingPct
    };
}

function updateStats(members, expenses, previousSummary) {
    const summary = buildSummary(members, expenses);
    currentDashboardSummary = summary;

    document.getElementById('dashboard-month-label').textContent = appInstance.state.currentMonth || 'Current month';
    document.getElementById('stat-total-due').textContent = utils.formatCurrency(summary.totalDue);
    document.getElementById('stat-collection-rate').textContent = summary.collectionRate + '%';
    document.getElementById('stat-monthly-total').textContent = utils.formatCurrency(summary.totalMonthlyFund);
    document.getElementById('stat-monthly-due').textContent = utils.formatCurrency(summary.dueMonthlyFund);
    document.getElementById('stat-prev-due').textContent = utils.formatCurrency(summary.duePreviousBalance);
    document.getElementById('stat-monthly-collected').textContent = utils.formatCurrency(summary.monthlyFundCollected);
    document.getElementById('stat-monthly-collected-pct').textContent = summary.monthlyFundCollectionPct;
    document.getElementById('stat-collected').textContent = utils.formatCurrency(summary.totalCollected);
    document.getElementById('stat-prev-total').textContent = utils.formatCurrency(summary.totalPreviousBalance);
    document.getElementById('stat-prev-collected').textContent = utils.formatCurrency(summary.previousBalanceCollected);
    document.getElementById('stat-outstanding').textContent = utils.formatCurrency(summary.totalOutstanding);
    document.getElementById('stat-expense').textContent = utils.formatCurrency(summary.totalExpense);
    document.getElementById('stat-expense-count').textContent = expenses.length;
    updateComparison(previousSummary, summary);
    updateCollectionHealth(summary);

    var netEl = document.getElementById('stat-net');
    var netLabel = document.getElementById('stat-net-label');
    netEl.textContent = utils.formatCurrency(summary.netAmount);
    if (summary.netAmount < 0) {
        netEl.className = 'metric-value text-danger';
        netLabel.textContent = 'Expenses exceed monthly fund collected';
    } else {
        netEl.className = 'metric-value text-success';
        netLabel.textContent = 'Monthly fund left after expenses';
    }

    document.getElementById('stat-paid-members').textContent = summary.paidCount;
    document.getElementById('stat-paid-members-badge').textContent = summary.paidCount;
    document.getElementById('stat-partial-members').textContent = summary.partialCount;
    document.getElementById('stat-total-members').textContent = members.length;
    document.getElementById('stat-status-total-members').textContent = members.length;
    document.getElementById('stat-pending-members').textContent = summary.pendingCount;
    document.getElementById('stat-pending-members-badge').textContent = summary.pendingCount;
    document.getElementById('status-paid-bar').style.width = summary.paidPct + '%';
    document.getElementById('status-partial-bar').style.width = summary.partialPct + '%';
    document.getElementById('status-pending-bar').style.width = summary.pendingPct + '%';
}

function updateComparison(previousSummary, summary) {
    setComparisonText('compare-total-due', previousSummary, summary.totalDue, previousSummary ? previousSummary.totalDue : 0, true, 'currency');
    setComparisonText('compare-collection-rate', previousSummary, summary.collectionRate, previousSummary ? previousSummary.collectionRate : 0, false, 'percent');
    setComparisonText('compare-collected', previousSummary, summary.totalCollected, previousSummary ? previousSummary.totalCollected : 0, false, 'currency');
    setComparisonText('compare-expenses', previousSummary, summary.totalExpense, previousSummary ? previousSummary.totalExpense : 0, true, 'currency');
    setComparisonText('compare-remaining', previousSummary, summary.netAmount, previousSummary ? previousSummary.netAmount : 0, false, 'currency');
    setComparisonText('compare-pending', previousSummary, summary.pendingCount, previousSummary ? previousSummary.pendingCount : 0, true, 'count');
}

function setComparisonText(id, previousSummary, currentValue, previousValue, lowerIsBetter, format) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!previousSummary) {
        el.textContent = 'No previous month';
        el.className = 'comparison-note';
        return;
    }
    const diff = currentValue - previousValue;
    if (diff === 0) {
        el.textContent = 'No change vs previous month';
        el.className = 'comparison-note';
        return;
    }
    const improved = lowerIsBetter ? diff < 0 : diff > 0;
    const sign = diff > 0 ? '+' : '-';
    let display = sign + Math.abs(diff);
    if (format === 'currency') display = sign + utils.formatCurrency(Math.abs(diff));
    if (format === 'percent') display = sign + Math.abs(diff) + '%';
    if (format === 'count') display = sign + Math.abs(diff);
    el.textContent = display + ' vs previous month';
    el.className = 'comparison-note ' + (improved ? 'comparison-good' : 'comparison-bad');
}

function updateCollectionHealth(summary) {
    const badge = document.getElementById('collection-health-badge');
    const rate = document.getElementById('collection-health-rate');
    const text = document.getElementById('collection-health-text');
    if (!badge || !rate || !text) return;

    let status = 'Healthy';
    let className = 'health-badge health-good';
    let message = 'Collections are in a strong position for this month.';

    if (summary.collectionRate < 60 || summary.netAmount < 0) {
        status = 'Critical';
        className = 'health-badge health-critical';
        message = 'Collection needs urgent attention, especially pending dues and expenses.';
    } else if (summary.collectionRate < 85 || summary.pendingCount > 0) {
        status = 'Needs Attention';
        className = 'health-badge health-warning';
        message = 'Follow up pending and partially paid members to improve collection health.';
    }

    badge.textContent = status;
    badge.className = className;
    rate.textContent = summary.collectionRate + '%';
    text.textContent = message;
}

function updateTopPendingMembers(members) {
    const list = document.getElementById('top-pending-list');
    if (!list) return;
    const pending = members
        .filter(function(m) { return (Number(m['Remaining Balance']) || 0) > 0; })
        .sort(function(a, b) { return (Number(b['Remaining Balance']) || 0) - (Number(a['Remaining Balance']) || 0); })
        .slice(0, 5);

    if (!pending.length) {
        list.innerHTML = '<div class="empty-list">No pending dues. Everyone is clear.</div>';
        return;
    }

    list.innerHTML = pending.map(function(m) {
        return '<div class="dashboard-list-item">' +
            '<div><strong>' + (m['Name'] || 'Member') + '</strong><span>' + (m['Payment Status'] || 'Pending') + '</span></div>' +
            '<b class="text-danger">' + utils.formatCurrency(m['Remaining Balance']) + '</b>' +
            '</div>';
    }).join('');
}

function updateFollowUpTracker(members, followUps) {
    const remindedEl = document.getElementById('dash-followup-reminded');
    const awaitingEl = document.getElementById('dash-followup-awaiting');
    const dueEl = document.getElementById('dash-followup-due');
    const list = document.getElementById('dashboard-followup-list');
    if (!list) return;

    const summaries = members
        .filter(function(m) { return m['Payment Status'] !== 'Paid' && (Number(m['Remaining Balance']) || 0) > 0; })
        .map(function(member) { return buildMemberFollowUpSummary(member, followUps); });

    const reminded = summaries.filter(function(item) { return item.reminderCount > 0; }).length;
    const awaiting = summaries.filter(function(item) { return item.awaitingReply; }).length;
    const due = summaries.filter(function(item) { return item.nextDue || item.reminderCount === 0; }).length;

    remindedEl.textContent = reminded;
    awaitingEl.textContent = awaiting;
    dueEl.textContent = due;

    const priority = summaries.sort(function(a, b) {
        if ((a.nextDue || a.reminderCount === 0) !== (b.nextDue || b.reminderCount === 0)) return (b.nextDue || b.reminderCount === 0) - (a.nextDue || a.reminderCount === 0);
        if (a.awaitingReply !== b.awaitingReply) return b.awaitingReply - a.awaitingReply;
        return (Number(b.member['Remaining Balance']) || 0) - (Number(a.member['Remaining Balance']) || 0);
    }).slice(0, 5);

    if (!priority.length) {
        list.innerHTML = '<div class="empty-list">No unpaid follow-ups pending.</div>';
        return;
    }

    list.innerHTML = priority.map(function(item) {
        var status = item.reminderCount === 0 ? 'Not reminded yet' : item.reminderCount + ' reminders';
        if (item.awaitingReply) status += ' | awaiting reply';
        if (item.latestReplyStatus) status += ' | ' + item.latestReplyStatus;
        var meta = status;
        if (item.reason) meta += '<br>' + escapeHtml(item.reason);
        if (item.nextDate) meta += '<br>Next: ' + utils.formatDate(item.nextDate);
        return '<div class="dashboard-list-item">' +
            '<div><strong>' + escapeHtml(item.member['Name'] || 'Member') + '</strong><span>' + meta + '</span></div>' +
            '<b class="text-danger">' + utils.formatCurrency(item.member['Remaining Balance']) + '</b>' +
            '</div>';
    }).join('');
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
    const awaitingReply = !!latestReminder && (!latestReply || new Date(latestReply['Event Date'] || 0) < new Date(latestReminder['Event Date'] || 0));
    return {
        member: member,
        reminderCount: reminders.length,
        awaitingReply: awaitingReply,
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

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function updateActivityLog(members, expenses) {
    const list = document.getElementById('dashboard-activity-list');
    if (!list) return;
    const paymentActivities = members
        .filter(function(m) { return (Number(m['Amount Paid']) || 0) > 0; })
        .map(function(m) {
            return {
                date: m['Payment Date'] || '',
                title: (m['Name'] || 'Member') + ' payment',
                detail: utils.formatCurrency(m['Amount Paid']) + ' collected',
                type: 'Payment'
            };
        });
    const expenseActivities = expenses.map(function(e) {
        return {
            date: e.Date || '',
            title: e.Description || 'Expense',
            detail: utils.formatCurrency(e.Amount) + ' - ' + (e.Category || 'Uncategorized'),
            type: 'Expense'
        };
    });
    const items = paymentActivities.concat(expenseActivities)
        .sort(function(a, b) { return new Date(b.date || 0) - new Date(a.date || 0); })
        .slice(0, 5);

    if (!items.length) {
        list.innerHTML = '<div class="empty-list">No recent activity for this month.</div>';
        return;
    }

    list.innerHTML = items.map(function(item) {
        return '<div class="dashboard-list-item">' +
            '<div><strong>' + item.title + '</strong><span>' + item.type + ' - ' + utils.formatDate(item.date) + '</span></div>' +
            '<b>' + item.detail + '</b>' +
            '</div>';
    }).join('');
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

function buildDashboardWhatsAppMessage() {
    const summary = currentDashboardSummary || buildSummary(currentDashboardMembers, currentDashboardExpenses);
    const followSummary = buildFollowUpReportSummary(currentDashboardMembers, currentDashboardFollowUps);
    let msg = '*United Pakistan - Monthly Finance Summary*\n';
    msg += '*' + (appInstance.state.currentMonth || 'Current Month') + '*\n\n';
    msg += '*Collection Health:* ' + summary.collectionRate + '%\n';
    msg += '- Total Members: ' + summary.memberTotal + '\n';
    msg += '- Paid: ' + summary.paidCount + '\n';
    msg += '- Partially Paid: ' + summary.partialCount + '\n';
    msg += '- Pending: ' + summary.pendingCount + '\n\n';
    msg += '*Follow-up Summary*\n';
    msg += '- Members Reminded: ' + followSummary.reminded + '\n';
    msg += '- Awaiting Reply: ' + followSummary.awaiting + '\n';
    msg += '- Promised to Pay: ' + followSummary.promised + '\n';
    msg += '- Due Follow-ups Today: ' + followSummary.due + '\n';
    msg += '- Reasons Recorded: ' + followSummary.withReason + '\n\n';
    msg += '*Financial Position*\n';
    msg += '- Total Due: ' + utils.formatCurrency(summary.totalDue) + '\n';
    msg += '- Total Collected: ' + utils.formatCurrency(summary.totalCollected) + '\n';
    msg += '- Outstanding: ' + utils.formatCurrency(summary.totalOutstanding) + '\n';
    msg += '- Expenses: ' + utils.formatCurrency(summary.totalExpense) + '\n';
    msg += '- Remaining After Expenses: ' + utils.formatCurrency(summary.netAmount) + '\n\n';
    if (followSummary.reasonItems.length > 0) {
        msg += '*Pending Reasons / Replies*\n';
        followSummary.reasonItems.slice(0, 8).forEach(function(item) {
            msg += '- ' + (item.member['Name'] || 'Member') + ': ' + item.reason + '\n';
        });
        msg += '\n';
    }
    msg += 'Please clear pending dues as soon as possible.';
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
        withReason: summaries.filter(function(item) { return !!item.reason; }).length,
        reasonItems: summaries.filter(function(item) { return !!item.reason; })
    };
}

function updateRecentPayments(members) {
    var tbody = document.getElementById('dash-payments-tbody');
    var noMsg = document.getElementById('no-payments-msg');
    var table = document.getElementById('recent-payments-table');
    tbody.innerHTML = '';

    var recent = members.filter(function(m) { return (Number(m['Amount Paid']) || 0) > 0; });
    recent.sort(function(a, b) { return new Date(b['Payment Date'] || 0) - new Date(a['Payment Date'] || 0); });
    recent = recent.slice(0, 5);

    if (recent.length === 0) {
        table.classList.add('hidden');
        noMsg.classList.remove('hidden');
        return;
    }
    table.classList.remove('hidden');
    noMsg.classList.add('hidden');

    recent.forEach(function(m) {
        var tr = document.createElement('tr');
        var badge = '<span class="badge badge-warning">Partially Paid</span>';
        if (m['Payment Status'] === 'Paid') badge = '<span class="badge badge-success">Paid</span>';
        tr.innerHTML = '<td>' + (m['Name'] || '') + '</td><td class="font-bold">' + utils.formatCurrency(m['Amount Paid']) + '</td><td class="text-sm text-muted">' + utils.formatDate(m['Payment Date']) + '</td><td>' + badge + '</td>';
        tbody.appendChild(tr);
    });
}

function updateRecentExpenses(expenses) {
    var tbody = document.getElementById('dash-expenses-tbody');
    var noMsg = document.getElementById('no-expenses-msg');
    var table = document.getElementById('recent-expenses-table');
    tbody.innerHTML = '';

    var recent = expenses.slice();
    recent.sort(function(a, b) { return new Date(b['Date'] || 0) - new Date(a['Date'] || 0); });
    recent = recent.slice(0, 5);

    if (recent.length === 0) {
        table.classList.add('hidden');
        noMsg.classList.remove('hidden');
        return;
    }
    table.classList.remove('hidden');
    noMsg.classList.add('hidden');

    recent.forEach(function(e) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td class="text-sm">' + utils.formatDate(e['Date']) + '</td><td class="text-sm">' + (e['Description'] || '-') + '</td><td class="font-bold text-danger">' + utils.formatCurrency(e['Amount']) + '</td>';
        tbody.appendChild(tr);
    });
}

function renderCharts(members, expenses) {
    if (typeof Chart === 'undefined') return;
    destroyCharts();

    var monthlyFundCollected = members.reduce(function(s, m) {
        return s + Math.min(Number(m['Amount Paid']) || 0, Number(m['Monthly Fund']) || 0);
    }, 0);
    var totalExpense = expenses.reduce(function(s, e) { return s + (Number(e['Amount']) || 0); }, 0);

    var barCtx = document.getElementById('collectedVsExpenseChart');
    var barNoData = document.getElementById('collected-vs-expense-no-data');

    if (monthlyFundCollected === 0 && totalExpense === 0) {
        barCtx.style.display = 'none';
        barNoData.classList.remove('hidden');
    } else {
        barCtx.style.display = 'block';
        barNoData.classList.add('hidden');
        chartInstances.collectedVsExpense = new Chart(barCtx, {
            type: 'bar',
            data: { labels: ['Monthly Fund Collected', 'Expenses'], datasets: [{ label: 'Amount (Rs.)', data: [monthlyFundCollected, totalExpense], backgroundColor: ['#10b981', '#ef4444'], borderRadius: 6, maxBarThickness: 60 }] },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: function(v) { return 'Rs. ' + (v/1000).toFixed(0) + 'k'; } } } } }
        });
    }

    var categoryTotals = {};
    expenses.forEach(function(e) {
        var cat = e['Category'] || 'Miscellaneous';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(e['Amount']) || 0);
    });

    var pieCtx = document.getElementById('categoryChart');
    var pieNoData = document.getElementById('category-chart-no-data');

    if (Object.keys(categoryTotals).length === 0) {
        pieCtx.style.display = 'none';
        pieNoData.classList.remove('hidden');
    } else {
        pieCtx.style.display = 'block';
        pieNoData.classList.add('hidden');
        var labels = Object.keys(categoryTotals);
        var data = labels.map(function(l) { return categoryTotals[l]; });
        var catColors = { 'Rent':'#ef4444','Electricity':'#f59e0b','Water':'#3b82f6','Gas':'#8b5cf6','Internet':'#06b6d4','Transport':'#f97316','Food':'#10b981','Stationery':'#6366f1','Maintenance':'#ec4899','Events':'#14b8a6','Salary':'#84cc16','Miscellaneous':'#6b7280' };
        var colors = labels.map(function(l) { return catColors[l] || '#6b7280'; });
        chartInstances.category = new Chart(pieCtx, {
            type: 'doughnut',
            data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 1 }] },
            options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { padding: 16, font: { size: 11 } } } } }
        });
    }
}

function destroyCharts() {
    Object.values(chartInstances).forEach(function(c) { if (c) c.destroy(); });
    chartInstances = {};
}

function setupEventListeners() {
    document.getElementById('btn-add-expense-dash')?.addEventListener('click', function() {
        if (appInstance.isReadOnly()) { utils.showToast('You have read-only access. Cannot add expenses.', 'warning'); return; }
        appInstance.navigate('expenses');
        setTimeout(function() { var btn = document.getElementById('btn-add-expense'); if (btn) btn.click(); }, 500);
    });

    document.getElementById('btn-generate-reminders-dash')?.addEventListener('click', function() {
        appInstance.navigate('members');
        setTimeout(function() {
            var filter = document.getElementById('followup-filter');
            if (filter) {
                filter.value = 'due';
                filter.dispatchEvent(new Event('change'));
            }
            var btn = document.getElementById('btn-due-reminders');
            if (btn) btn.click();
        }, 500);
    });

    document.getElementById('btn-dashboard-due-reminders')?.addEventListener('click', function() {
        appInstance.navigate('members');
        setTimeout(function() {
            var filter = document.getElementById('followup-filter');
            if (filter) {
                filter.value = 'due';
                filter.dispatchEvent(new Event('change'));
            }
            var btn = document.getElementById('btn-due-reminders');
            if (btn) btn.click();
        }, 500);
    });

    document.getElementById('btn-dash-new-month')?.addEventListener('click', function() {
        document.getElementById('new-month-modal').classList.add('active');
        var date = new Date();
        date.setMonth(date.getMonth() + 1);
        document.getElementById('new-month-name').value = date.toLocaleString('default', { month: 'long' }) + ' ' + date.getFullYear();
    });

    document.getElementById('btn-dashboard-whatsapp-report')?.addEventListener('click', async function() {
        if (appInstance.isReadOnly()) {
            utils.showToast('Only admins can share WhatsApp summaries', 'warning');
            return;
        }
        try {
            const message = buildDashboardWhatsAppMessage();
            const opened = openWhatsAppSummary(message);
            await copyText(message);
            utils.showToast(opened ? 'Monthly summary copied and WhatsApp opened' : 'Monthly summary copied. Allow popups to open WhatsApp.');
        } catch (error) {
            utils.showToast('Could not copy monthly summary', 'error');
        }
    });

    document.getElementById('new-month-form')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        var monthName = document.getElementById('new-month-name').value;
        var carryBalances = document.getElementById('carry-balances').checked;
        var btn = document.getElementById('btn-confirm-new-month');
        btn.disabled = true;
        btn.textContent = 'Creating...';
        try {
            var res = await api.post('/api/months/new', { monthName: monthName, carryBalances: carryBalances });
            if (res.success) {
                utils.showToast('New month created successfully');
                document.getElementById('new-month-modal').classList.remove('active');
                await appInstance.loadMonths();
            }
        } catch (error) {
            utils.showToast(error.message || 'Failed to create month', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create Month';
        }
    });
}

function openWhatsAppSummary(message) {
    const win = window.open('https://wa.me/?text=' + encodeURIComponent(message), '_blank');
    if (win) {
        try { win.opener = null; } catch (e) {}
        return true;
    }
    return false;
}
