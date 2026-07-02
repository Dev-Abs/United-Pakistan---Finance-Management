import { api } from './api.js';
import { utils } from './utils.js';
import { setupExportListeners } from './export.js';

let appInstance = null;
let chartInstance = null;

export async function init(app) {
    appInstance = app;
    setupExportListeners(appInstance);
    
    if (app.state.currentMonth) {
        await loadReportData();
    }
    
    window.addEventListener('monthChanged', loadReportData);
}

async function loadReportData() {
    if (!appInstance.state.currentMonth) return;
    
    utils.showLoader();
    try {
        const res = await api.get(`/api/members?month=${encodeURIComponent(appInstance.state.currentMonth)}`);
        if (res.success) {
            updateStats(res.data);
            renderChart(res.data);
        }
    } catch (error) {
        utils.showToast('Failed to load report data', 'error');
    } finally {
        utils.hideLoader();
    }
}

function updateStats(members) {
    let totalCollected = 0;
    let totalOutstanding = 0;
    let totalDue = 0;

    members.forEach(m => {
        totalCollected += Number(m['Amount Paid']) || 0;
        totalOutstanding += Number(m['Remaining Balance']) || 0;
        totalDue += Number(m['Total Payable']) || 0;
    });

    const pct = totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 0;

    document.getElementById('r-collected').textContent = utils.formatCurrency(totalCollected);
    document.getElementById('r-outstanding').textContent = utils.formatCurrency(totalOutstanding);
    document.getElementById('r-rate').textContent = `${pct}%`;
}

function renderChart(members) {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;
    
    let paidCount = 0;
    let partialCount = 0;
    let pendingCount = 0;
    
    members.forEach(m => {
        if (m['Payment Status'] === 'Paid') paidCount++;
        else if (m['Payment Status'] === 'Partially Paid') partialCount++;
        else pendingCount++;
    });
    
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    // Check if Chart is available globally (loaded via CDN)
    if (typeof Chart === 'undefined') return;
    
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Paid', 'Partially Paid', 'Pending'],
            datasets: [{
                data: [paidCount, partialCount, pendingCount],
                backgroundColor: [
                    '#10b981', // success
                    '#f59e0b', // warning
                    '#ef4444'  // danger
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });
}
