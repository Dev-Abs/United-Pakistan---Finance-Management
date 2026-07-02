import { api } from './api.js';
import { utils } from './utils.js';

let appInstance = null;

export async function init(app) {
    appInstance = app;
    
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
        const res = await api.get(`/api/members?month=${encodeURIComponent(appInstance.state.currentMonth)}`);
        if (res.success) {
            updateStats(res.data);
            updateRecentPayments(res.data);
        }
    } catch (error) {
        console.error('Failed to load dashboard data', error);
        utils.showToast('Failed to load data', 'error');
    } finally {
        utils.hideLoader();
    }
}

function updateStats(members) {
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

    const pct = totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 0;

    document.getElementById('stat-collected').textContent = utils.formatCurrency(totalCollected);
    document.getElementById('stat-outstanding').textContent = utils.formatCurrency(totalOutstanding);
    document.getElementById('stat-collected-pct').textContent = pct;
    
    document.getElementById('stat-paid-members').textContent = paidCount;
    document.getElementById('stat-total-members').textContent = members.length;
    document.getElementById('stat-pending-members').textContent = pendingCount;
}

function updateRecentPayments(members) {
    const tbody = document.querySelector('#recent-payments-table tbody');
    const noMsg = document.getElementById('no-payments-msg');
    const table = document.getElementById('recent-payments-table');
    
    tbody.innerHTML = '';
    
    // Filter to those who have paid something, sort by date descending
    let recent = members.filter(m => (Number(m['Amount Paid']) || 0) > 0);
    recent.sort((a, b) => {
        const da = new Date(a['Payment Date'] || 0);
        const db = new Date(b['Payment Date'] || 0);
        return db - da;
    });
    
    // Take top 5
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

function setupEventListeners() {
    document.getElementById('btn-new-month').addEventListener('click', () => {
        document.getElementById('new-month-modal').classList.add('active');
        // Suggest next month name
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        const nextMonthStr = date.toLocaleString('default', { month: 'long' }) + ' ' + date.getFullYear();
        document.getElementById('new-month-name').value = nextMonthStr;
    });
    
    document.getElementById('new-month-form').addEventListener('submit', async (e) => {
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
                await appInstance.loadMonths(); // Reload months list
            }
        } catch (error) {
            utils.showToast(error.message || 'Failed to create month', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create Month';
        }
    });

    document.getElementById('btn-generate-reminders').addEventListener('click', () => {
        // Will implement in members/reminders
        appInstance.navigate('members');
        // setTimeout(() => { document.getElementById('btn-bulk-reminders')?.click(); }, 500);
    });
}
