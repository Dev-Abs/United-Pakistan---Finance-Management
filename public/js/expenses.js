import { api } from './api.js';
import { utils } from './utils.js';

let appInstance = null;
let allExpenses = [];

const CATEGORY_COLORS = {
    'Rent': '#ef4444',
    'Electricity': '#f59e0b',
    'Water': '#3b82f6',
    'Gas': '#8b5cf6',
    'Internet': '#06b6d4',
    'Transport': '#f97316',
    'Food': '#10b981',
    'Stationery': '#6366f1',
    'Maintenance': '#ec4899',
    'Events': '#14b8a6',
    'Salary': '#84cc16',
    'Miscellaneous': '#6b7280'
};

export async function init(app) {
    appInstance = app;

    // Show/hide add button based on role
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
}

async function loadExpenses() {
    if (!appInstance.state.currentMonth) return;

    utils.showLoader();
    try {
        const res = await api.get(`/api/expenses?month=${encodeURIComponent(appInstance.state.currentMonth)}`);
        if (res.success) {
            allExpenses = res.data;
            updateStats();
            populateCategoryFilter();
            renderTable();
        }
    } catch (error) {
        utils.showToast('Failed to load expenses', 'error');
    } finally {
        utils.hideLoader();
    }
}

function updateStats() {
    let total = 0;
    const categoryTotals = {};
    let maxAmount = 0;
    let maxCategory = '-';

    allExpenses.forEach(exp => {
        const amt = Number(exp['Amount']) || 0;
        total += amt;

        const cat = exp['Category'] || 'Miscellaneous';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;

        if (amt > maxAmount) {
            maxAmount = amt;
            maxCategory = cat;
        }
    });

    const categoriesUsed = Object.keys(categoryTotals).length;
    const avg = allExpenses.length > 0 ? Math.round(total / allExpenses.length) : 0;

    document.getElementById('exp-total').textContent = utils.formatCurrency(total);
    document.getElementById('exp-categories-count').textContent = categoriesUsed;
    document.getElementById('exp-highest').textContent = utils.formatCurrency(maxAmount);
    document.getElementById('exp-highest-cat').textContent = maxCategory;
    document.getElementById('exp-avg').textContent = utils.formatCurrency(avg);
}

function populateCategoryFilter() {
    const filter = document.getElementById('exp-category-filter');
    const currentVal = filter.value;

    // Keep "All Categories"
    filter.innerHTML = '<option value="all">All Categories</option>';

    const cats = [...new Set(allExpenses.map(e => e['Category'] || 'Miscellaneous'))];
    cats.sort().forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        filter.appendChild(opt);
    });

    filter.value = currentVal;
}

function renderTable() {
    const tbody = document.querySelector('#expenses-table tbody');
    tbody.innerHTML = '';

    const searchTerm = document.getElementById('exp-search').value.toLowerCase();
    const categoryFilter = document.getElementById('exp-category-filter').value;

    let filtered = allExpenses.filter(exp => {
        const desc = (exp['Description'] || '').toLowerCase();
        const cat = (exp['Category'] || '').toLowerCase();
        const paidBy = (exp['Paid By'] || '').toLowerCase();
        const matchesSearch = desc.includes(searchTerm) || cat.includes(searchTerm) || paidBy.includes(searchTerm);
        const matchesCat = categoryFilter === 'all' || (exp['Category'] || 'Miscellaneous') === categoryFilter;
        return matchesSearch && matchesCat;
    });

    // Sort by date descending
    filtered.sort((a, b) => {
        const da = new Date(a['Date'] || 0);
        const db = new Date(b['Date'] || 0);
        return db - da;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted p-md">No expenses found.</td></tr>`;
        return;
    }

    const isReadOnly = appInstance.isReadOnly();

    filtered.forEach(exp => {
        const tr = document.createElement('tr');

        const catColor = CATEGORY_COLORS[exp['Category']] || '#6b7280';
        const categoryBadge = `<span style="background:${catColor}20; color:${catColor}; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:500;">${exp['Category'] || '-'}</span>`;

        let actionsHtml = `<span class="text-muted text-sm">-</span>`;
        if (!isReadOnly) {
            actionsHtml = `
                <div class="flex gap-sm">
                    <button class="btn-icon" title="Edit" onclick="window.expensesJS.openEditModal(${exp._rowId})">✏️</button>
                    <button class="btn-icon text-danger" title="Delete" onclick="window.expensesJS.deleteExpense(${exp._rowId})">🗑️</button>
                </div>
            `;
        }

        tr.innerHTML = `
            <td class="text-sm">${utils.formatDate(exp['Date'])}</td>
            <td>${categoryBadge}</td>
            <td>${exp['Description'] || '-'}</td>
            <td class="font-bold text-danger">${utils.formatCurrency(exp['Amount'])}</td>
            <td>${exp['Paid By'] || '-'}</td>
            <td class="text-sm text-muted">${exp['Remarks'] || '-'}</td>
            <td>${actionsHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

function setupEventListeners() {
    document.getElementById('exp-search').addEventListener('input', renderTable);
    document.getElementById('exp-category-filter').addEventListener('change', renderTable);

    document.getElementById('btn-add-expense').addEventListener('click', () => {
        document.getElementById('expense-form').reset();
        document.getElementById('e-id').value = '';
        document.getElementById('expense-modal-title').textContent = 'Add Expense';
        document.getElementById('e-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('expense-modal').classList.add('active');
    });

    document.getElementById('expense-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('e-id').value;
        const data = {
            'Month': appInstance.state.currentMonth,
            'Date': document.getElementById('e-date').value,
            'Category': document.getElementById('e-category').value,
            'Description': document.getElementById('e-description').value,
            'Amount': document.getElementById('e-amount').value,
            'Paid By': document.getElementById('e-paid-by').value,
            'Remarks': document.getElementById('e-remarks').value
        };

        const btn = document.getElementById('btn-save-expense');
        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
            if (id) {
                await api.put(`/api/expenses/${id}`, { data });
                utils.showToast('Expense updated');
            } else {
                await api.post('/api/expenses', { data });
                utils.showToast('Expense added');
            }
            document.getElementById('expense-modal').classList.remove('active');
            await loadExpenses();
        } catch (error) {
            utils.showToast(error.message || 'Failed to save', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save Expense';
        }
    });
}

// Expose functions to window for inline onclick
window.expensesJS = {
    openEditModal: (id) => {
        const exp = allExpenses.find(x => x._rowId === id);
        if (!exp) return;

        document.getElementById('e-id').value = exp._rowId;
        document.getElementById('e-date').value = exp['Date'] || '';
        document.getElementById('e-category').value = exp['Category'] || '';
        document.getElementById('e-description').value = exp['Description'] || '';
        document.getElementById('e-amount').value = exp['Amount'] || '';
        document.getElementById('e-paid-by').value = exp['Paid By'] || '';
        document.getElementById('e-remarks').value = exp['Remarks'] || '';

        document.getElementById('expense-modal-title').textContent = 'Edit Expense';
        document.getElementById('expense-modal').classList.add('active');
    },

    deleteExpense: async (id) => {
        if (!confirm('Are you sure you want to delete this expense?')) return;

        try {
            await api.delete(`/api/expenses/${id}`);
            utils.showToast('Expense deleted');
            await loadExpenses();
        } catch (e) {
            utils.showToast('Failed to delete', 'error');
        }
    }
};
