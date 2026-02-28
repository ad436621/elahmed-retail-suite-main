// ============================================================
// Global API Client with Error Handling, Token Refresh, and Logging
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || '';

interface ApiError {
    message: string;
    status: number;
    code?: string;
}

interface RequestConfig extends RequestInit {
    skipAuth?: boolean;
    skipRefresh?: boolean;
}

class ApiClient {
    private isRefreshing = false;
    private refreshSubscribers: Array<(token: string) => void> = [];

    /**
     * Subscribe to token refresh
     */
    private subscribeTokenRefresh(callback: (token: string) => void) {
        this.refreshSubscribers.push(callback);
    }

    /**
     * Notify all subscribers of new token
     */
    private notifyTokenRefresh(token: string) {
        this.refreshSubscribers.forEach(callback => callback(token));
        this.refreshSubscribers = [];
    }

    /**
     * Get auth token
     */
    private getToken(): string | null {
        return localStorage.getItem('token');
    }

    /**
     * Clear auth (call on 401 after refresh fails)
     */
    private clearAuth() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }

    /**
     * Attempt to refresh token
     */
    private async refreshToken(): Promise<string | null> {
        if (this.isRefreshing) {
            return new Promise(resolve => {
                this.subscribeTokenRefresh(token => resolve(token));
            });
        }

        this.isRefreshing = true;

        try {
            const response = await fetch(`${API_BASE}/api/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    refreshToken: localStorage.getItem('refreshToken'),
                }),
            });

            if (!response.ok) {
                throw new Error('Token refresh failed');
            }

            const data = await response.json();
            localStorage.setItem('token', data.token);
            this.notifyTokenRefresh(data.token);
            return data.token;
        } catch (error) {
            this.clearAuth();
            return null;
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * Log request/response
     */
    private log(method: string, url: string, status?: number, error?: Error) {
        const isProduction = import.meta.env.PROD;

        if (isProduction) {
            // In production, send to logging service
            console.log(JSON.stringify({
                type: 'api',
                method,
                url,
                status,
                error: error?.message,
                timestamp: new Date().toISOString(),
            }));
        } else {
            // In development, use console
            if (error) {
                console.error(`[API Error] ${method} ${url}`, error);
            } else {
                console.log(`[API] ${method} ${url}`, status ? `${status}` : '');
            }
        }
    }

    /**
     * Main request method
     */
    async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
        const { skipAuth = false, skipRefresh = false, ...fetchConfig } = config;

        const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
        const method = fetchConfig.method || 'GET';

        // Build headers
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(fetchConfig.headers as Record<string, string>),
        };

        // Add auth token if not skipped
        if (!skipAuth) {
            const token = this.getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        try {
            const response = await fetch(url, {
                ...fetchConfig,
                headers,
            });

            // Handle 401 - Unauthorized
            if (response.status === 401 && !skipRefresh && !skipAuth) {
                const newToken = await this.refreshToken();

                if (newToken) {
                    // Retry with new token
                    headers['Authorization'] = `Bearer ${newToken}`;
                    const retryResponse = await fetch(url, {
                        ...fetchConfig,
                        headers,
                    });

                    const data = await this.handleResponse<T>(retryResponse);
                    this.log(method, url, retryResponse.status);
                    return data;
                }
            }

            const data = await this.handleResponse<T>(response);
            this.log(method, url, response.status);
            return data;
        } catch (error) {
            this.log(method, url, undefined, error as Error);
            throw error;
        }
    }

    /**
     * Handle response and parse errors
     */
    private async handleResponse<T>(response: Response): Promise<T> {
        if (!response.ok) {
            let errorMessage = 'An error occurred';

            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
            } catch {
                // Response wasn't JSON
            }

            const error: ApiError = {
                message: errorMessage,
                status: response.status,
                code: response.status.toString(),
            };

            throw error;
        }

        // Handle empty responses
        const text = await response.text();
        if (!text) {
            return {} as T;
        }

        try {
            return JSON.parse(text) as T;
        } catch {
            return text as unknown as T;
        }
    }

    // Convenience methods
    get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
        return this.request<T>(endpoint, { ...config, method: 'GET' });
    }

    post<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
        return this.request<T>(endpoint, {
            ...config,
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    put<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
        return this.request<T>(endpoint, {
            ...config,
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    patch<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
        return this.request<T>(endpoint, {
            ...config,
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
        return this.request<T>(endpoint, { ...config, method: 'DELETE' });
    }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;

// Export error type for use in components
export type { ApiError, RequestConfig };
