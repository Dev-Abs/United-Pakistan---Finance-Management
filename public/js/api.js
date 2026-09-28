const inflightGets = new Map();
const DEFAULT_TIMEOUT = 15000;
let refreshPromise = null;

export const api = {
    async request(url, options = {}) {
        const token = localStorage.getItem('auth_token');
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        if (options.method && options.method.toUpperCase() !== 'GET' && !headers['Idempotency-Key']) {
            headers['Idempotency-Key'] = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
        }
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const sectorContext = localStorage.getItem('selected_sector_id');
        if (sectorContext) headers['X-Sector-Id'] = sectorContext;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);

        try {
            const response = await fetch(url, { ...options, headers, signal: options.signal || controller.signal });
            const contentType = response.headers.get('content-type') || '';
            const data = contentType.includes('application/json')
                ? await response.json()
                : { error: await response.text() };
            
            // Refresh once before redirecting when a short-lived access token expires.
            if (response.status === 401 && !url.includes('/login') && !url.includes('/status')) {
                const refreshToken = localStorage.getItem('auth_refresh_token');
                if (refreshToken && !url.includes('/api/auth/refresh') && !options._retried) {
                    refreshPromise ||= fetch('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) }).then(async (refreshResponse) => {
                        if (!refreshResponse.ok) throw new Error('Refresh failed');
                        return refreshResponse.json();
                    }).finally(() => { refreshPromise = null; });
                    try {
                        const refreshed = await refreshPromise;
                        localStorage.setItem('auth_token', refreshed.token);
                        if (refreshed.refreshToken) localStorage.setItem('auth_refresh_token', refreshed.refreshToken);
                        return this.request(url, { ...options, _retried: true });
                    } catch (_) {
                        localStorage.removeItem('auth_token');
                        localStorage.removeItem('auth_refresh_token');
                    }
                }
                window.location.href = '/login.html';
                return null;
            }

            if (!response.ok) {
                if (data.code === 'SECTOR_CONTEXT_REQUIRED' || data.code === 'SECTOR_CONTEXT_INVALID') {
                    localStorage.removeItem('selected_sector_id');
                    localStorage.removeItem('selected_sector_name');
                    window.dispatchEvent(new CustomEvent('sectorContextInvalid', { detail: data.error }));
                }
                const apiError = new Error(data.error || 'We could not complete that request. Please try again.');
                apiError.code = data.code || 'API_REQUEST_FAILED';
                apiError.status = response.status;
                throw apiError;
            }

            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                error = new Error('The server took too long to respond. Please try again.');
                error.code = 'REQUEST_TIMEOUT';
            }
            console.error(`API Error (${url}):`, error);
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    },

    get(url) {
        // A view can ask for the same Sheets-backed resource more than once while
        // mounting. Share that work instead of adding more latency and API load.
        if (inflightGets.has(url)) return inflightGets.get(url);
        const request = this.request(url, { method: 'GET' })
            .finally(() => inflightGets.delete(url));
        inflightGets.set(url, request);
        return request;
    },

    post(url, body) {
        return this.request(url, { method: 'POST', body: JSON.stringify(body) });
    },

    put(url, body) {
        return this.request(url, { method: 'PUT', body: JSON.stringify(body) });
    },

    patch(url, body) {
        return this.request(url, { method: 'PATCH', body: JSON.stringify(body) });
    },

    delete(url) {
        return this.request(url, { method: 'DELETE' });
    }
};
