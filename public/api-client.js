/**
 * Timson POS - Robust API Client
 * Centralized fetch handler with timeout, retries, and SweetAlert2 integration.
 */

const API_CLIENT_CONFIG = {
    TIMEOUT: 45000, // 45 seconds (increased to handle Render spin-up)
    RETRIES: 2,
    RETRY_DELAY: 1500
};

class TimsonApiClient {
    /**
     * Centralized request handler
     * @param {string} url 
     * @param {object} options 
     */
    async request(url, options = {}) {
        let attempts = 0;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_CLIENT_CONFIG.TIMEOUT);
        
        options.signal = controller.signal;

        while (attempts <= API_CLIENT_CONFIG.RETRIES) {
            try {
                const response = await fetch(url, options);
                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return await response.json();
            } catch (error) {
                attempts++;
                if (attempts > API_CLIENT_CONFIG.RETRIES || error.name === 'AbortError') {
                    this.handleError(error, url);
                    throw error;
                }
                console.warn(`[API] Retrying ${url} (Attempt ${attempts})...`);
                await new Promise(resolve => setTimeout(resolve, API_CLIENT_CONFIG.RETRY_DELAY));
            }
        }
    }

    /**
     * Global Error Handler with SweetAlert2 backup
     */
    handleError(error, url) {
        console.error(`[API Error] Request to ${url} failed:`, error);
        
        const message = error.name === 'AbortError' 
            ? "Request timed out. Please check your network connection."
            : `Network Error: ${error.message}`;

        if (window.Swal) {
            Swal.fire({
                icon: 'error',
                title: 'Connection Issue',
                text: message,
                confirmButtonColor: '#4361ee'
            });
        } else {
            // Fallback for pages without SweetAlert2
            console.warn("SweetAlert2 not found. Falling back to console alert.");
        }
    }

    // Convenience methods
    async get(url) { return this.request(url, { method: 'GET' }); }
    async post(url, data, customHeaders = {}) { 
        return this.request(url, { 
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/json',
                ...customHeaders
            },
            body: JSON.stringify(data)
        }); 
    }
}

window.timsonApi = new TimsonApiClient();
