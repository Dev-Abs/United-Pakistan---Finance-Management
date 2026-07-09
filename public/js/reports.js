import { api } from './api.js';
import { utils } from './utils.js';
import { setupExportListeners } from './export.js';

let appInstance = null;
let chartInstance = null;
let currentMembers = [];
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
        const [membersRes, expensesRes] = await Promise.all([
            api.get('/api/members?month=' + encodeURIComponent(appInstance.state.currentMonth)),
            api.get('/api/expenses?month=' + encodeURIComponent(appInstance.state.currentMonth))
        ]);

        const members = membersRes.success ? membersRes.data : [];
        const expenses = expensesRes.success ? expensesRes.data : [];
        currentMembers = members;

        document.getElementById('reports-skeleton').style.display = 'none';
        document.getElementById('reports-content').style.display = 'block';

        updateStats(members, expenses);
        renderChart(members);
    } catch (error) {
        utils.showToast('Failed to load report data', 'error');
        document.getElementById('reports-skeleton').style.display = 'none';
        document.getElementById('reports-content').style.display = 'block';
    }
}

function updateStats(members, expenses) {
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
        collectionPct
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
            msg += '- ' + (m['Name'] || 'Member') + ': ' + utils.formatCurrency(m['Remaining Balance']) + ' due\n';
        });
    }

    msg += '\nPlease clear remaining dues at the earliest.\n';
    msg += 'Thank you.';
    return msg;
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
