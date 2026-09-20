const inflightGets = new Map();
const DEFAULT_TIMEOUT = 15000;

export const api = {
    async request(url, options = {}) {
        const token = localStorage.getItem('auth_token');
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);

        try {
            const response = await fetch(url, { ...options, headers, signal: options.signal || controller.signal });
            const contentType = response.headers.get('content-type') || '';
            const data = contentType.includes('application/json')
                ? await response.json()
                : { error: await response.text() };
            
            // Redirect to login if unauthorized
            if (response.status === 401 && !url.includes('/login') && !url.includes('/status')) {
                window.location.href = '/login.html';
                return null;
            }

            if (!response.ok) {
                throw new Error(data.error || 'API Request Failed');
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

    delete(url) {
        return this.request(url, { method: 'DELETE' });
    }
};
