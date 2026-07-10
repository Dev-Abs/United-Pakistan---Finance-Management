import { api } from './api.js';
import { utils } from './utils.js';

class App {
    constructor() {
        this.currentView = '';
        this.state = {
            currentMonth: '',
            months: [],
            userRole: null
        };
        this.routes = {
            'dashboard': { url: '/', title: 'Dashboard', script: '/js/dashboard.js' },
            'members': { url: '/members', title: 'Members', script: '/js/members.js' },
            'expenses': { url: '/expenses', title: 'Expenses', script: '/js/expenses.js' },
            'reports': { url: '/reports', title: 'Reports', script: '/js/reports.js' },
            'settings': { url: '/settings', title: 'Settings', script: '/js/settings.js' }
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

        // Load initial data (months)
        await this.loadMonths();

        // Handle initial route
        this.handleRoute();

        // Handle browser back/forward
        window.addEventListener('popstate', () => this.handleRoute());
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
            this.state.currentMonth = e.target.value;
            // Dispatch custom event to notify current view to reload data
            window.dispatchEvent(new CustomEvent('monthChanged', { detail: this.state.currentMonth }));
        });
    }

    async loadMonths() {
        try {
            const res = await api.get('/api/months');
            if (res.success && res.data) {
                this.state.months = res.data;
                const select = document.getElementById('current-month-select');
                if (select) {
                    select.innerHTML = '';
                    this.state.months.forEach(month => {
                        const option = document.createElement('option');
                        option.value = month;
                        option.textContent = month;
                        select.appendChild(option);
                    });
                    if (this.state.months.length > 0) {
                        this.state.currentMonth = this.state.months[this.state.months.length - 1];
                        select.value = this.state.currentMonth;
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load months', error);
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

        this.loadView(matchedRoute);
    }

    async loadView(routeName) {
        if (this.currentView === routeName) return;

        const route = this.routes[routeName];
        if (!route) return;

        utils.showLoader();

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
            const response = await fetch(`/views/${routeName}.html`);
            if (!response.ok) throw new Error('View not found');
            const html = await response.text();

            document.getElementById('main-view').innerHTML = html;

            // Dynamically load associated script
            if (route.script) {
                const module = await import(route.script);
                if (module && typeof module.init === 'function') {
                    module.init(this);
                }
            }

            this.renderIcons();

            this.currentView = routeName;

            // Close mobile menu if open
            document.getElementById('sidebar')?.classList.remove('active');

        } catch (error) {
            console.error('Error loading view:', error);
            utils.showToast('Error loading page', 'error');
            document.getElementById('main-view').innerHTML = `<div class="card"><p class="text-danger">Failed to load view.</p></div>`;
        } finally {
            utils.hideLoader();
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
