import { api } from './api.js';
import { utils } from './utils.js';

let appInstance = null;
let allExpenses = [];

export async function init(app) {
    appInstance = app;
    if (!app.isReadOnly()) {
        document.getElementById('btn-add-expense').style.display = 'inline-flex';
    }
    document.getElementById('expense-month-label').textContent = app.state.currentMonth || '-';
    if (app.state.currentMonth) {
        await loadExpenses();
    }
    window.addEventListener('monthChanged', async (e) => {
        document.getElementById('expense-month-label').textContent = e.detail || '-';
        await loadExpenses();
    });
    setupEventListeners();
    setupSortableAndExport();
}

function setupSortableAndExport() {
    setTimeout(function() {
        var headers = document.querySelectorAll('#expenses-table thead th.sortable');
        headers.forEach(function(th) {
            th.addEventListener('click', function() {
                var field = this.dataset.sort;
                var table = document.getElementById('expenses-table');
                var cf = table.dataset.sortField || '';
                var cd = table.dataset.sortDir || 'asc';
                table.dataset.sortField = field;
                table.dataset.sortDir = (field === cf && cd === 'asc') ? 'desc' : 'asc';
                var arrows = document.querySelectorAll('#expenses-table thead th.sortable .sort-arrow');
                arrows.forEach(function(a) { a.textContent = ''; });
                var arrow = this.querySelector('.sort-arrow');
                if (arrow) arrow.textContent = table.dataset.sortDir === 'asc' ? ' ▲' : ' ▼';
                renderTable();
            });
        });

        document.getElementById('btn-export-expenses-csv').addEventListener('click', function() {
            downloadExport('csv');
        });
        document.getElementById('btn-export-expenses-excel').addEventListener('click', function() {
            downloadExport('excel');
        });
    }, 50);
}

async function downloadExport(fmt) {
    if (!appInstance.state.currentMonth) return;
    utils.showLoader();
    try {
        var month = encodeURIComponent(appInstance.state.currentMonth);
        var token = localStorage.getItem('auth_token');
        var res = await fetch('/api/export/expense/' + fmt + '?month=' + month, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) { var errText = await res.text(); throw new Error(errText || 'Export failed'); }
        var blob = await res.blob();
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        var ext = fmt === 'csv' ? 'csv' : 'xlsx';
        a.download = 'Expenses_' + appInstance.state.currentMonth.replace(/\s+/g, '_') + '.' + ext;
        a.click();
        URL.revokeObjectURL(url);
        utils.showToast('Export downloaded');
    } catch (error) {
        utils.showToast(error.message || 'Export failed', 'error');
    } finally {
        utils.hideLoader();
    }
}

async function loadExpenses() {
    if (!appInstance.state.currentMonth) return;
    utils.showLoader();
    try {
        var res = await api.get('/api/expenses?month=' + encodeURIComponent(appInstance.state.currentMonth));
        if (res.success) { allExpenses = res.data; updateStats(); renderTable(); }
    } catch (error) {
        utils.showToast('Failed to load expenses', 'error');
    } finally { utils.hideLoader(); }
}

function updateStats() {
    var total = 0, maxAmt = 0, maxDesc = '-';
    allExpenses.forEach(function(exp) {
        var amt = Number(exp.Amount) || 0; total += amt;
        if (amt > maxAmt) { maxAmt = amt; maxDesc = exp.Description || '-'; }
    });
    document.getElementById('exp-total').textContent = utils.formatCurrency(total);
    document.getElementById('exp-highest').textContent = utils.formatCurrency(maxAmt);
    document.getElementById('exp-highest-cat').textContent = maxDesc;
    var avg = allExpenses.length ? Math.round(total / allExpenses.length) : 0;
    document.getElementById('exp-avg').textContent = utils.formatCurrency(avg);
}

function sortExpenses(list) {
    var sf = document.getElementById('expenses-table').dataset.sortField || '';
    var sd = document.getElementById('expenses-table').dataset.sortDir || 'asc';
    if (!sf) return list.sort(function(a,b) { return new Date(b.Date||0) - new Date(a.Date||0); });
    return list.sort(function(a,b) {
        var va = a[sf] !== undefined ? a[sf] : '';
        var vb = b[sf] !== undefined ? b[sf] : '';
        if (sf === 'Amount') return sd === 'asc' ? (Number(va)||0)-(Number(vb)||0) : (Number(vb)||0)-(Number(va)||0);
        if (sf === 'Date') return sd === 'asc' ? new Date(va)-new Date(vb) : new Date(vb)-new Date(va);
        return sd === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
}

function renderTable() {
    var tbody = document.querySelector('#expenses-table tbody');
    tbody.innerHTML = '';
    var st = document.getElementById('exp-search').value.toLowerCase();
    var filtered = allExpenses.filter(function(exp) {
        var desc = (exp.Description || '').toLowerCase();
        var paid = (exp['Paid By'] || '').toLowerCase();
        var remarks = (exp.Remarks || '').toLowerCase();
        return desc.indexOf(st) >= 0 || paid.indexOf(st) >= 0 || remarks.indexOf(st) >= 0;
    });
    filtered = sortExpenses(filtered);
    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan=6 class="text-center text-muted p-md">No expenses found.</td></tr>';
        return;
    }
    var ro = appInstance.isReadOnly();
    filtered.forEach(function(exp) {
        var tr = document.createElement('tr');
        var act = '<span class="text-muted text-sm">-</span>';
        if (!ro) act = '<div class="flex gap-sm"><button class="btn-icon" onclick="window.expensesJS.openEditModal(' + exp._rowId + ')">✏️</button><button class="btn-icon" onclick="window.expensesJS.deleteExpense(' + exp._rowId + ')">🗑️</button></div>';
        tr.innerHTML = '<td class="text-sm">' + utils.formatDate(exp.Date) + '</td>' +
            '<td>' + (exp.Description || '-') + '</td>' +
            '<td class="font-bold text-danger">' + utils.formatCurrency(exp.Amount) + '</td>' +
            '<td>' + (exp['Paid By'] || '-') + '</td>' +
            '<td class="text-sm text-muted">' + (exp.Remarks || '-') + '</td>' +
            '<td>' + act + '</td>';
        tbody.appendChild(tr);
    });
}

function setupEventListeners() {
    document.getElementById('exp-search').addEventListener('input', renderTable);
    document.getElementById('btn-add-expense').addEventListener('click', function() {
        document.getElementById('expense-form').reset();
        document.getElementById('e-id').value = '';
        document.getElementById('expense-modal-title').textContent = 'Add Expense';
        document.getElementById('e-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('expense-modal').classList.add('active');
    });
    document.getElementById('expense-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        var id = document.getElementById('e-id').value;
        var data = {
            Month: appInstance.state.currentMonth,
            Date: document.getElementById('e-date').value,
            Description: document.getElementById('e-description').value,
            Amount: document.getElementById('e-amount').value,
            'Paid By': document.getElementById('e-paid-by').value,
            Remarks: document.getElementById('e-remarks').value
        };
        var btn = document.getElementById('btn-save-expense');
        btn.disabled = true; btn.textContent = 'Saving...';
        try {
            if (id) await api.put('/api/expenses/' + id, { data: data });
            else await api.post('/api/expenses', { data: data });
            document.getElementById('expense-modal').classList.remove('active');
            await loadExpenses();
        } catch (error) { utils.showToast(error.message || 'Failed to save', 'error'); }
        finally { btn.disabled = false; btn.textContent = 'Save Expense'; }
    });
}

window.expensesJS = {
    openEditModal: function(id) {
        var exp = allExpenses.find(function(x) { return x._rowId === id; });
        if (!exp) return;
        document.getElementById('e-id').value = exp._rowId;
        document.getElementById('e-date').value = exp.Date || '';
        document.getElementById('e-description').value = exp.Description || '';
        document.getElementById('e-amount').value = exp.Amount || '';
        document.getElementById('e-paid-by').value = exp['Paid By'] || '';
        document.getElementById('e-remarks').value = exp.Remarks || '';
        document.getElementById('expense-modal-title').textContent = 'Edit Expense';
        document.getElementById('expense-modal').classList.add('active');
    },
    deleteExpense: async function(id) {
        if (!confirm('Are you sure?')) return;
        try { await api.delete('/api/expenses/' + id); utils.showToast('Expense deleted'); await loadExpenses(); }
        catch (e) { utils.showToast('Failed to delete', 'error'); }
    }
};
