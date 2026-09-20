import { api } from './api.js';
import { utils } from './utils.js';

// Bump this whenever any view script changes so clients don't serve stale JS.
const ASSET_VERSION = '20260920-modern-ui';

class App {
    constructor() {
        this.currentView = '';
        this.viewRequest = 0;
        this.viewCache = new Map();
        this.state = {
            currentMonth: '',
            months: [],
            userRole: null
        };
        this.routes = {
            'dashboard': { url: '/', title: 'Dashboard', script: `/js/dashboard.js?v=${ASSET_VERSION}` },
            'members': { url: '/members', title: 'Members', script: `/js/members.js?v=${ASSET_VERSION}` },
            'expenses': { url: '/expenses', title: 'Expenses', script: `/js/expenses.js?v=${ASSET_VERSION}` },
            'special-fund': { url: '/special-fund', title: 'Special Fund', script: `/js/special-fund.js?v=${ASSET_VERSION}` },
            'reports': { url: '/reports', title: 'Reports', script: `/js/reports.js?v=${ASSET_VERSION}` },
            'settings': { url: '/settings', title: 'Settings', script: `/js/settings.js?v=${ASSET_VERSION}` }
        };
    }

    renderIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    isReadOnly() {
        return this.state.userRole === 'reader';
    }

    updateRoleBadge() {
        const badge = document.getElementById('user-role-badge');
        if (!badge) return;
        const readOnly = this.isReadOnly();
        badge.textContent = readOnly ? 'Read Only' : 'Admin';
        badge.className = 'role-badge ' + (readOnly ? 'role-reader' : 'role-admin');
    }

    async init() {
        // Check auth status first
        try {
            const authStatus = await api.get('/api/auth/status');
            if (!authStatus.authenticated && window.location.pathname !== '/login.html') {
                window.location.href = '/login.html';
                return;
            }
            if (authStatus.authenticated && window.location.pathname === '/login.html') {
                window.location.href = '/';
                return;
            }
            if (authStatus.authenticated) {
                this.state.userRole = authStatus.role || 'admin';
                this.updateRoleBadge();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            if (window.location.pathname !== '/login.html') {
                window.location.href = '/login.html';
            }
            return;
        }

        // Setup event listeners
        this.setupEventListeners();

        // Route immediately when cached month metadata exists, while refreshing
        // it in the background. This avoids a blank app during a slow Sheets call.
        this.restoreMonthState();
        const initialView = this.handleRoute();
        await Promise.all([initialView, this.loadMonths()]);
        if (this.currentView && this.state.currentMonth) {
            window.dispatchEvent(new CustomEvent('monthChanged', { detail: this.state.currentMonth }));
        }

        // Handle browser back/forward
        window.addEventListener('popstate', () => this.handleRoute());
    }

    restoreMonthState() {
        try {
            const cached = JSON.parse(localStorage.getItem('up_month_state') || '{}');
            if (Array.isArray(cached.months)) {
                this.state.months = cached.months.map(m => String(m).trim()).filter(Boolean);
                this.state.currentMonth = this.resolveCurrentMonth() || String(cached.currentMonth || '');
                this.renderMonthOptions();
            }
        } catch (_) {
            localStorage.removeItem('up_month_state');
        }
    }

    renderMonthOptions() {
        const select = document.getElementById('current-month-select');
        if (!select) return;
        select.replaceChildren(...this.state.months.map(month => {
            const option = document.createElement('option');
            option.value = month;
            option.textContent = month;
            return option;
        }));
        if (this.state.currentMonth) select.value = this.state.currentMonth;
    }

    setupEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const route = e.currentTarget.getAttribute('data-route');
                this.navigate(route);
                // Close sidebar on mobile after navigation
                document.getElementById('sidebar')?.classList.remove('active');
            });
        });

        // Bottom navigation
        document.querySelectorAll('.bottom-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const route = e.currentTarget.getAttribute('data-route');
                this.navigate(route);
            });
        });

        // Logout
        const logoutHandler = async () => {
            try {
                localStorage.removeItem('auth_token');
                window.location.href = '/login.html';
            } catch (error) {
                utils.showToast('Failed to logout', 'error');
            }
        };
        document.getElementById('logout-btn')?.addEventListener('click', logoutHandler);
        document.getElementById('bottom-logout-btn')?.addEventListener('click', logoutHandler);

        // Mobile menu toggle
        document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('active');
        });

        // Close sidebar when clicking main content (mobile)
        document.querySelector('.main-content')?.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            if (sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
            }
        });

        // Month selector change
        document.getElementById('current-month-select')?.addEventListener('change', (e) => {
            this.state.currentMonth = String(e.target.value || '').trim();
            this.updateStaleMonthNotice();
            // Dispatch custom event to notify current view to reload data
            window.dispatchEvent(new CustomEvent('monthChanged', { detail: this.state.currentMonth }));
        });
    }

    // Canonical month label for a date, e.g. "August 2026".
    // Must match the naming convention used for month sheet tabs.
    static monthLabel(date) {
        const d = date || new Date();
        return d.toLocaleString('en-US', { month: 'long' }) + ' ' + d.getFullYear();
    }

    currentCalendarMonth() {
        return App.monthLabel();
    }

    hasMonth(name) {
        const target = String(name || '').trim().toLowerCase();
        return this.state.months.some(m => String(m).trim().toLowerCase() === target);
    }

    // Resolve the month tab that matches today's calendar month, ignoring
    // whitespace/case drift in the sheet tab names. Falls back to the last
    // tab so the app still works before the new month sheet is created.
    resolveCurrentMonth() {
        const target = App.monthLabel().trim().toLowerCase();
        const match = this.state.months.find(m => String(m).trim().toLowerCase() === target);
        if (match) return match;
        return this.state.months[this.state.months.length - 1];
    }

    // True when the selected month is not the actual calendar month — the app
    // is reading/writing into a stale month tab.
    isViewingStaleMonth() {
        if (!this.state.currentMonth) return false;
        return this.state.currentMonth.trim().toLowerCase() !== App.monthLabel().trim().toLowerCase();
    }

    updateStaleMonthNotice() {
        const notice = document.getElementById('stale-month-notice');
        if (!notice) return;
        const expected = App.monthLabel();
        const hasExpected = this.hasMonth(expected);
        if (this.isViewingStaleMonth()) {
            notice.textContent = hasExpected
                ? `Viewing ${this.state.currentMonth} — the current month is ${expected}.`
                : `No sheet exists for ${expected} yet. Entries will be saved under ${this.state.currentMonth}. Create the new month first.`;
            notice.style.display = 'block';
        } else {
            notice.style.display = 'none';
        }
    }

    async loadMonths() {
        try {
            const res = await api.get('/api/months');
            if (res.success && res.data) {
                // Trim tab names so stray whitespace can never break the exact
                // string matching used to filter expenses/follow-ups by month.
                this.state.months = res.data.map(m => String(m).trim()).filter(Boolean);

                if (this.state.months.length > 0) {
                    this.state.currentMonth = this.resolveCurrentMonth();
                }

                this.renderMonthOptions();
                localStorage.setItem('up_month_state', JSON.stringify({
                    months: this.state.months,
                    currentMonth: this.state.currentMonth
                }));

                this.updateStaleMonthNotice();
            }
        } catch (error) {
            console.error('Failed to load months', error);
            utils.showToast('Could not load months. Data may be incomplete.', 'error');
        }
    }

    navigate(routeName) {
        if (!this.routes[routeName]) return;

        const route = this.routes[routeName];
        window.history.pushState({}, '', route.url);
        this.loadView(routeName);
    }

    handleRoute() {
        const path = window.location.pathname;
        let matchedRoute = 'dashboard';

        for (const [name, route] of Object.entries(this.routes)) {
            if (route.url === path && path !== '/') {
                matchedRoute = name;
                break;
            }
        }

        return this.loadView(matchedRoute);
    }

    async loadView(routeName) {
        if (this.currentView === routeName) return;

        const route = this.routes[routeName];
        if (!route) return;

        const requestId = ++this.viewRequest;
        const view = document.getElementById('main-view');
        document.body.classList.add('is-navigating');
        view?.setAttribute('aria-busy', 'true');

        try {
            // Update UI — sidebar active state
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            const activeNav = document.querySelector(`.nav-item[data-route="${routeName}"]`);
            if (activeNav) activeNav.classList.add('active');

            // Bottom nav active state
            document.querySelectorAll('.bottom-nav-item').forEach(item => item.classList.remove('active'));
            const activeBottom = document.querySelector(`.bottom-nav-item[data-route="${routeName}"]`);
            if (activeBottom) activeBottom.classList.add('active');

            document.getElementById('page-title').textContent = route.title;

            // Fetch template
            let html = this.viewCache.get(routeName);
            if (!html) {
                const response = await fetch(`/views/${routeName}.html`, { signal: AbortSignal.timeout(10000) });
                if (!response.ok) throw new Error('View not found');
                html = await response.text();
                this.viewCache.set(routeName, html);
            }
            if (requestId !== this.viewRequest) return;

            view.innerHTML = html;

            // Dynamically load associated script
            if (route.script) {
                const module = await import(route.script);
                if (module && typeof module.init === 'function') {
                    await module.init(this);
                }
            }

            this.renderIcons();

            this.currentView = routeName;
            view.classList.remove('view-enter');
            requestAnimationFrame(() => view.classList.add('view-enter'));

            // Close mobile menu if open
            document.getElementById('sidebar')?.classList.remove('active');

        } catch (error) {
            console.error('Error loading view:', error);
            utils.showToast('Error loading page', 'error');
            view.innerHTML = `<div class="card empty-state"><h2>We couldn't open this page</h2><p class="text-muted">Check your connection and try again.</p><button class="btn btn-primary" onclick="location.reload()">Try again</button></div>`;
        } finally {
            if (requestId === this.viewRequest) {
                document.body.classList.remove('is-navigating');
                view?.setAttribute('aria-busy', 'false');
            }
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.renderIcons();
    // Only init if we are on the main app page (not login)
    if (document.getElementById('app')) {
        window.app.init();
    }
});
