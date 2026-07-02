import { api } from './api.js';
import { utils } from './utils.js';

let appInstance = null;
let chartInstances = {};

export async function init(app) {
    appInstance = app;

    // Hide write actions for read-only users
    if (app.isReadOnly()) {
        ['btn-add-expense-dash', 'btn-dash-new-month'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    if (app.state.currentMonth) {
        await loadDashboardData();
    }

    // Listen for month changes
    window.addEventListener('monthChanged', loadDashboardData);

    // Set up listeners
    setupEventListeners();
}

async function loadDashboardData() {
    if (!appInstance.state.currentMonth) return;

    utils.showLoader();
    try {
        const [membersRes, expensesRes] = await Promise.all([
            api.get(`/api/members?month=${encodeURIComponent(appInstance.state.currentMonth)}`),
            api.get(`/api/expenses?month=${encodeURIComponent(appInstance.state.currentMonth)}`)
        ]);

        if (membersRes.success) {
            const members = membersRes.data || [];
            const expenses = (expensesRes.success ? expensesRes.data : []) || [];
            updateStats(members, expenses);
            updateRecentPayments(members);
            updateRecentExpenses(expenses);
            renderCharts(members, expenses);
        }
    } catch (error) {
        console.error('Failed to load dashboard data', error);
        utils.showToast('Failed to load data', 'error');
    } finally {
        utils.hideLoader();
    }
}

function updateStats(members, expenses) {
    let totalCollected = 0;
    let totalOutstanding = 0;
    let totalDue = 0;
    let paidCount = 0;
    let pendingCount = 0;

    members.forEach(m => {
        const paid = Number(m['Amount Paid']) || 0;
        const remaining = Number(m['Remaining Balance']) || 0;
        const due = Number(m['Total Payable']) || 0;

        totalCollected += paid;
        totalOutstanding += remaining;
        totalDue += due;

        if (m['Payment Status'] === 'Paid') paidCount++;
        if (m['Payment Status'] === 'Pending') pendingCount++;
    });

    const totalExpense = expenses.reduce((sum, e) => sum + (Number(e['Amount']) || 0), 0);
    const netAmount = totalCollected - totalExpense;

    const pct = totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 0;

    document.getElementById('stat-collected').textContent = utils.formatCurrency(totalCollected);
    document.getElementById('stat-collected-pct').textContent = pct;

    document.getElementById('stat-expense').textContent = utils.formatCurrency(totalExpense);
    document.getElementById('stat-expense-count').textContent = expenses.length;

    const netEl = document.getElementById('stat-net');
    const netLabel = document.getElementById('stat-net-label');
    netEl.textContent = utils.formatCurrency(netAmount);
    if (netAmount < 0) {
        netEl.className = 'text-2xl font-bold mt-sm text-danger';
        netLabel.textContent = 'Loss this month';
    } else {
        netEl.className = 'text-2xl font-bold mt-sm text-success';
        netLabel.textContent = 'Surplus this month';
    }

    document.getElementById('stat-paid-members').textContent = paidCount;
    document.getElementById('stat-total-members').textContent = members.length;
    document.getElementById('stat-pending-members').textContent = pendingCount;
}

function updateRecentPayments(members) {
    const tbody = document.querySelector('#recent-payments-table tbody');
    const noMsg = document.getElementById('no-payments-msg');
    const table = document.getElementById('recent-payments-table');

    tbody.innerHTML = '';

    let recent = members.filter(m => (Number(m['Amount Paid']) || 0) > 0);
    recent.sort((a, b) => {
        const da = new Date(a['Payment Date'] || 0);
        const db = new Date(b['Payment Date'] || 0);
        return db - da;
    });
    recent = recent.slice(0, 5);

    if (recent.length === 0) {
        table.classList.add('hidden');
        noMsg.classList.remove('hidden');
        return;
    }

    table.classList.remove('hidden');
    noMsg.classList.add('hidden');

    recent.forEach(m => {
        const tr = document.createElement('tr');
        let statusBadge = `<span class="badge badge-warning">Partially Paid</span>`;
        if (m['Payment Status'] === 'Paid') {
            statusBadge = `<span class="badge badge-success">Paid</span>`;
        }
        tr.innerHTML = `
            <td>${m['Name']}</td>
            <td class="font-bold">${utils.formatCurrency(m['Amount Paid'])}</td>
            <td class="text-sm text-muted">${utils.formatDate(m['Payment Date'])}</td>
            <td>${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateRecentExpenses(expenses) {
    const tbody = document.querySelector('#recent-expenses-table tbody');
    const noMsg = document.getElementById('no-expenses-msg');
    const table = document.getElementById('recent-expenses-table');

    tbody.innerHTML = '';

    let recent = [...expenses];
    recent.sort((a, b) => {
        const da = new Date(a['Date'] || 0);
        const db = new Date(b['Date'] || 0);
        return db - da;
    });
    recent = recent.slice(0, 5);

    if (recent.length === 0) {
        table.classList.add('hidden');
        noMsg.classList.remove('hidden');
        return;
    }

    table.classList.remove('hidden');
    noMsg.classList.add('hidden');

    recent.forEach(e => {
        const tr = document.createElement('tr');
        const catColor = CATEGORY_COLORS[e['Category']] || '#6b7280';
        tr.innerHTML = `
            <td class="text-sm text-muted">${utils.formatDate(e['Date'])}</td>
            <td><span style="background:${catColor}20; color:${catColor}; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:500;">${e['Category'] || '-'}</span></td>
            <td class="text-sm">${e['Description'] || '-'}</td>
            <td class="font-bold text-danger">${utils.formatCurrency(e['Amount'])}</td>
        `;
        tbody.appendChild(tr);
    });
}

const CATEGORY_COLORS = {
    'Rent': '#ef4444', 'Electricity': '#f59e0b', 'Water': '#3b82f6',
    'Gas': '#8b5cf6', 'Internet': '#06b6d4', 'Transport': '#f97316',
    'Food': '#10b981', 'Stationery': '#6366f1', 'Maintenance': '#ec4899',
    'Events': '#14b8a6', 'Salary': '#84cc16', 'Miscellaneous': '#6b7280'
};

function renderCharts(members, expenses) {
    if (typeof Chart === 'undefined') return;

    destroyCharts();

    // Collected vs Expense Bar Chart
    const totalCollected = members.reduce((s, m) => s + (Number(m['Amount Paid']) || 0), 0);
    const totalExpense = expenses.reduce((s, e) => s + (Number(e['Amount']) || 0), 0);

    const barCtx = document.getElementById('collectedVsExpenseChart');
    const barNoData = document.getElementById('collected-vs-expense-no-data');

    if (totalCollected === 0 && totalExpense === 0) {
        barCtx.style.display = 'none';
        barNoData.classList.remove('hidden');
    } else {
        barCtx.style.display = 'block';
        barNoData.classList.add('hidden');
        chartInstances.collectedVsExpense = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: ['Collected', 'Expenses'],
                datasets: [{
                    label: 'Amount (Rs.)',
                    data: [totalCollected, totalExpense],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderRadius: 6,
                    maxBarThickness: 60
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (v) => 'Rs. ' + (v / 1000).toFixed(0) + 'k'
                        }
                    }
                }
            }
        });
    }

    // Expense Category Pie Chart
    const categoryTotals = {};
    expenses.forEach(e => {
        const cat = e['Category'] || 'Miscellaneous';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(e['Amount']) || 0);
    });

    const pieCtx = document.getElementById('categoryChart');
    const pieNoData = document.getElementById('category-chart-no-data');

    if (Object.keys(categoryTotals).length === 0) {
        pieCtx.style.display = 'none';
        pieNoData.classList.remove('hidden');
    } else {
        pieCtx.style.display = 'block';
        pieNoData.classList.add('hidden');

        const labels = Object.keys(categoryTotals);
        const data = labels.map(l => categoryTotals[l]);
        const colors = labels.map(l => CATEGORY_COLORS[l] || '#6b7280');

        chartInstances.category = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { padding: 16, font: { size: 11 } }
                    }
                }
            }
        });
    }
}

function destroyCharts() {
    Object.values(chartInstances).forEach(c => {
        if (c) c.destroy();
    });
    chartInstances = {};
}

function setupEventListeners() {
    // Dashboard quick actions — use app.navigate or redirect based on role
    document.getElementById('btn-add-expense-dash')?.addEventListener('click', () => {
        if (appInstance.isReadOnly()) {
            utils.showToast('You have read-only access. Cannot add expenses.', 'warning');
            return;
        }
        appInstance.navigate('expenses');
        // Small delay for the view to load, then open add modal
        setTimeout(() => {
            const btn = document.getElementById('btn-add-expense');
            if (btn) btn.click();
        }, 500);
    });

    document.getElementById('btn-generate-reminders-dash')?.addEventListener('click', () => {
        appInstance.navigate('members');
    });

    // New month modal
    document.getElementById('btn-dash-new-month')?.addEventListener('click', () => {
        document.getElementById('new-month-modal').classList.add('active');
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        const nextMonthStr = date.toLocaleString('default', { month: 'long' }) + ' ' + date.getFullYear();
        document.getElementById('new-month-name').value = nextMonthStr;
    });

    document.getElementById('new-month-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const monthName = document.getElementById('new-month-name').value;
        const carryBalances = document.getElementById('carry-balances').checked;
        const btn = document.getElementById('btn-confirm-new-month');

        btn.disabled = true;
        btn.textContent = 'Creating...';

        try {
            const res = await api.post('/api/months/new', { monthName, carryBalances });
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
