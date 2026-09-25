import { api } from './api.js';
import { utils } from './utils.js';

// Bump this whenever any view script changes so clients don't serve stale JS.
const ASSET_VERSION = '20260925-enterprise';

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
        this.commands = [
            { label: 'Dashboard', hint: 'Overview and priorities', icon: 'layout-dashboard', route: 'dashboard', keywords: 'home overview' },
            { label: 'Members', hint: 'Members, payments and follow-ups', icon: 'users', route: 'members', keywords: 'people collections dues' },
            { label: 'Expenses', hint: 'Expense ledger', icon: 'receipt', route: 'expenses', keywords: 'cost transactions' },
            { label: 'Special Fund', hint: 'Campaign contributions', icon: 'landmark', route: 'special-fund', keywords: 'campaign donation' },
            { label: 'Reports', hint: 'Analysis and exports', icon: 'bar-chart-3', route: 'reports', keywords: 'pdf csv excel' },
            { label: 'Settings', hint: 'Organization and diagnostics', icon: 'settings', route: 'settings', keywords: 'configuration' },
            { label: 'Add member', hint: 'Create a member record', icon: 'user-plus', route: 'members', action: 'btn-add-member', admin: true, keywords: 'new person' },
            { label: 'Record payment', hint: 'Open members and select a member', icon: 'circle-dollar-sign', route: 'members', admin: true, keywords: 'paid collection' },
            { label: 'Add expense', hint: 'Record a new expense', icon: 'plus-circle', route: 'expenses', action: 'btn-add-expense', admin: true, keywords: 'new cost' },
            { label: 'Record special contribution', hint: 'Add a campaign payment', icon: 'badge-dollar-sign', route: 'special-fund', action: 'sf-add-contribution', admin: true, keywords: 'donation payment' }
        ];
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
        this.setupCommandMenu();
        this.setupShellPreferences();
        this.setupNetworkStatus();
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
                if (!e.currentTarget.hasAttribute('data-route')) return;
                e.preventDefault();
                const route = e.currentTarget.getAttribute('data-route');
                this.navigate(route);
            });
        });

        document.querySelectorAll('.mobile-more-action[data-route]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigate(e.currentTarget.getAttribute('data-route'));
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

        const moreMenu = document.getElementById('mobile-more-menu');
        const moreButton = document.getElementById('mobile-more-btn');
        const closeMore = () => {
            moreMenu?.classList.remove('active');
            moreMenu?.setAttribute('aria-hidden', 'true');
            moreButton?.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('overlay-open');
        };
        const openMore = () => {
            moreMenu?.classList.add('active');
            moreMenu?.setAttribute('aria-hidden', 'false');
            moreButton?.setAttribute('aria-expanded', 'true');
            document.body.classList.add('overlay-open');
            document.getElementById('mobile-more-close')?.focus();
        };
        moreButton?.addEventListener('click', openMore);
        document.getElementById('mobile-more-close')?.addEventListener('click', closeMore);
        moreMenu?.addEventListener('click', (event) => {
            if (event.target === moreMenu || event.target.closest('[data-route]')) closeMore();
        });
        document.getElementById('mobile-install-btn')?.addEventListener('click', () => {
            closeMore();
            document.getElementById('install-app-btn')?.click();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            if (moreMenu?.classList.contains('active')) {
                closeMore();
                moreButton?.focus();
                return;
            }
            const modal = document.querySelector('.modal-overlay.active');
            if (modal) this.closeModal(modal);
        });

        document.addEventListener('click', (event) => {
            const overlay = event.target.closest('.modal-overlay');
            if (overlay && event.target === overlay && overlay.classList.contains('active')) this.closeModal(overlay);
        });

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

    setupShellPreferences() {
        const button = document.getElementById('sidebar-collapse-btn');
        const apply = (collapsed) => {
            document.body.classList.toggle('sidebar-collapsed', collapsed);
            button?.setAttribute('aria-pressed', String(collapsed));
            button?.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
            const icon = button?.querySelector('svg');
            if (icon) icon.outerHTML = `<i data-lucide="${collapsed ? 'panel-left-open' : 'panel-left-close'}"></i>`;
            this.renderIcons();
        };
        apply(localStorage.getItem('up_sidebar_collapsed') === 'true');
        button?.addEventListener('click', () => {
            const collapsed = !document.body.classList.contains('sidebar-collapsed');
            localStorage.setItem('up_sidebar_collapsed', String(collapsed));
            apply(collapsed);
        });
    }

    setupNetworkStatus() {
        const status = document.getElementById('network-status');
        const update = () => {
            if (!status) return;
            status.hidden = navigator.onLine;
            status.textContent = navigator.onLine ? '' : 'You are offline. Existing data remains visible, but changes may not save.';
        };
        window.addEventListener('online', update);
        window.addEventListener('offline', update);
        update();
    }

    setupCommandMenu() {
        const overlay = document.getElementById('command-menu');
        const input = document.getElementById('command-input');
        const results = document.getElementById('command-results');
        const trigger = document.getElementById('command-menu-btn');
        const mobileTrigger = document.getElementById('mobile-command-btn');
        let activeIndex = 0;
        let visible = [];
        const close = () => {
            overlay?.classList.remove('active');
            overlay?.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('overlay-open');
            trigger?.focus();
        };
        const run = async (command) => {
            close();
            if (this.currentView !== command.route) {
                this.pendingAction = command.action || null;
                this.navigate(command.route);
            } else if (command.action) document.getElementById(command.action)?.click();
        };
        const render = () => {
            const query = String(input?.value || '').trim().toLowerCase();
            visible = this.commands.filter(command => !command.admin || !this.isReadOnly()).filter(command =>
                !query || `${command.label} ${command.hint} ${command.keywords || ''}`.toLowerCase().includes(query));
            activeIndex = Math.min(activeIndex, Math.max(visible.length - 1, 0));
            results?.replaceChildren(...visible.map((command, index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = `command-item${index === activeIndex ? ' active' : ''}`;
                button.setAttribute('role', 'option');
                button.setAttribute('aria-selected', String(index === activeIndex));
                button.innerHTML = `<span class="command-icon"><i data-lucide="${command.icon}"></i></span><span><strong>${command.label}</strong><small>${command.hint}</small></span><i class="command-arrow" data-lucide="arrow-right"></i>`;
                button.addEventListener('mouseenter', () => { activeIndex = index; render(); });
                button.addEventListener('click', () => run(command));
                return button;
            }));
            if (!visible.length && results) results.innerHTML = '<div class="command-empty">No matching pages or actions</div>';
            this.renderIcons();
        };
        const open = () => {
            overlay?.classList.add('active');
            overlay?.setAttribute('aria-hidden', 'false');
            document.body.classList.add('overlay-open');
            if (input) input.value = '';
            activeIndex = 0;
            render();
            requestAnimationFrame(() => input?.focus());
        };
        trigger?.addEventListener('click', open);
        mobileTrigger?.addEventListener('click', () => {
            document.getElementById('mobile-more-menu')?.classList.remove('active');
            document.getElementById('mobile-more-menu')?.setAttribute('aria-hidden', 'true');
            document.getElementById('mobile-more-btn')?.setAttribute('aria-expanded', 'false');
            open();
        });
        overlay?.addEventListener('click', event => { if (event.target === overlay) close(); });
        input?.addEventListener('input', () => { activeIndex = 0; render(); });
        document.addEventListener('keydown', event => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); overlay?.classList.contains('active') ? close() : open(); return; }
            if (!overlay?.classList.contains('active')) return;
            if (event.key === 'Escape') { event.preventDefault(); close(); }
            if (event.key === 'ArrowDown') { event.preventDefault(); activeIndex = (activeIndex + 1) % Math.max(visible.length, 1); render(); }
            if (event.key === 'ArrowUp') { event.preventDefault(); activeIndex = (activeIndex - 1 + Math.max(visible.length, 1)) % Math.max(visible.length, 1); render(); }
            if (event.key === 'Enter' && visible[activeIndex]) { event.preventDefault(); run(visible[activeIndex]); }
        });
    }

    closeModal(modal) {
        modal.classList.remove('active');
        document.body.classList.remove('overlay-open');
        const triggerId = modal.dataset.triggerId;
        if (triggerId) document.getElementById(triggerId)?.focus();
    }

    prepareModals(view) {
        view.querySelectorAll('.modal-overlay').forEach((overlay, index) => {
            const modal = overlay.querySelector('.modal');
            const title = overlay.querySelector('.modal-title');
            if (!modal) return;
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            if (title) {
                if (!title.id) title.id = `modal-title-${this.currentView || 'view'}-${index}`;
                modal.setAttribute('aria-labelledby', title.id);
            }
            overlay.querySelector('.modal-close')?.setAttribute('aria-label', 'Close dialog');
            new MutationObserver(() => {
                if (overlay.classList.contains('active')) {
                    document.body.classList.add('overlay-open');
                    const active = document.activeElement;
                    if (active?.id) overlay.dataset.triggerId = active.id;
                    requestAnimationFrame(() => overlay.querySelector('input:not([type="hidden"]), select, textarea, button')?.focus());
                } else if (!document.querySelector('.modal-overlay.active, .mobile-more-overlay.active')) {
                    document.body.classList.remove('overlay-open');
                }
            }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
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
            else if (routeName === 'reports' || routeName === 'settings') document.getElementById('mobile-more-btn')?.classList.add('active');

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
            this.prepareModals(view);
            this.prepareViewAccessibility(view);

            // Dynamically load associated script
            if (route.script) {
                const module = await import(route.script);
                if (module && typeof module.init === 'function') {
                    await module.init(this);
                }
            }

            this.renderIcons();

            this.currentView = routeName;
            if (this.pendingAction) {
                const action = document.getElementById(this.pendingAction);
                this.pendingAction = null;
                action?.click();
            }
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

    prepareViewAccessibility(view) {
        view.querySelectorAll('label').forEach(label => {
            if (label.htmlFor) return;
            const control = label.querySelector('input, select, textarea') || label.parentElement?.querySelector('input, select, textarea');
            if (control?.id) label.htmlFor = control.id;
        });
        view.querySelectorAll('button').forEach(button => {
            if (button.type || button.closest('form') === null) return;
            button.type = 'button';
        });
        view.querySelectorAll('.modal-close').forEach(button => {
            if (/^×$/.test(button.textContent.trim())) button.innerHTML = '<i data-lucide="x"></i>';
        });
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
