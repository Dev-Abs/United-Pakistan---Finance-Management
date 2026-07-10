import { api } from './api.js';
import { utils } from './utils.js';

let appInstance = null;
let chartInstances = {};

export async function init(app) {
    appInstance = app;

    if (app.isReadOnly()) {
        ['btn-add-expense-dash', 'btn-dash-new-month'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
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
        const [membersRes, expensesRes] = await Promise.all([
            api.get('/api/members?month=' + encodeURIComponent(appInstance.state.currentMonth)),
            api.get('/api/expenses?month=' + encodeURIComponent(appInstance.state.currentMonth))
        ]);

        if (membersRes.success) {
            const members = membersRes.data || [];
            const expenses = (expensesRes.success ? expensesRes.data : []) || [];
            showDashboardContent();
            updateStats(members, expenses);
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

function updateStats(members, expenses) {
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

    document.getElementById('dashboard-month-label').textContent = appInstance.state.currentMonth || 'Current month';
    document.getElementById('stat-total-due').textContent = utils.formatCurrency(totalDue);
    document.getElementById('stat-collection-rate').textContent = collectionRate + '%';
    document.getElementById('stat-monthly-total').textContent = utils.formatCurrency(totalMonthlyFund);
    document.getElementById('stat-monthly-due').textContent = utils.formatCurrency(dueMonthlyFund);
    document.getElementById('stat-prev-due').textContent = utils.formatCurrency(duePreviousBalance);
    document.getElementById('stat-monthly-collected').textContent = utils.formatCurrency(monthlyFundCollected);
    document.getElementById('stat-monthly-collected-pct').textContent = pct;
    document.getElementById('stat-collected').textContent = utils.formatCurrency(totalCollected);
    document.getElementById('stat-prev-total').textContent = utils.formatCurrency(totalPreviousBalance);
    document.getElementById('stat-prev-collected').textContent = utils.formatCurrency(previousBalanceCollected);
    document.getElementById('stat-outstanding').textContent = utils.formatCurrency(totalOutstanding);
    document.getElementById('stat-expense').textContent = utils.formatCurrency(totalExpense);
    document.getElementById('stat-expense-count').textContent = expenses.length;

    var netEl = document.getElementById('stat-net');
    var netLabel = document.getElementById('stat-net-label');
    netEl.textContent = utils.formatCurrency(netAmount);
    if (netAmount < 0) {
        netEl.className = 'metric-value text-danger';
        netLabel.textContent = 'Expenses exceed monthly fund collected';
    } else {
        netEl.className = 'metric-value text-success';
        netLabel.textContent = 'Monthly fund left after expenses';
    }

    document.getElementById('stat-paid-members').textContent = paidCount;
    document.getElementById('stat-paid-members-badge').textContent = paidCount;
    document.getElementById('stat-partial-members').textContent = partialCount;
    document.getElementById('stat-total-members').textContent = members.length;
    document.getElementById('stat-status-total-members').textContent = members.length;
    document.getElementById('stat-pending-members').textContent = pendingCount;
    document.getElementById('stat-pending-members-badge').textContent = pendingCount;
    document.getElementById('status-paid-bar').style.width = paidPct + '%';
    document.getElementById('status-partial-bar').style.width = partialPct + '%';
    document.getElementById('status-pending-bar').style.width = pendingPct + '%';
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
    });

    document.getElementById('btn-dash-new-month')?.addEventListener('click', function() {
        document.getElementById('new-month-modal').classList.add('active');
        var date = new Date();
        date.setMonth(date.getMonth() + 1);
        document.getElementById('new-month-name').value = date.toLocaleString('default', { month: 'long' }) + ' ' + date.getFullYear();
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
