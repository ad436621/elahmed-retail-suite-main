// ============================================================
// ELAHMED RETAIL SUITE — API Client
// Connects to Node.js/Express backend
// ============================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T> {
    data?: T;
    error?: string;
}

class ApiClient {
    private token: string | null = null;

    setToken(token: string | null) {
        this.token = token;
        if (token) {
            localStorage.setItem('gx_auth_token', token);
        } else {
            localStorage.removeItem('gx_auth_token');
        }
    }

    getToken(): string | null {
        if (!this.token) {
            this.token = localStorage.getItem('gx_auth_token');
        }
        return this.token;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        const url = `${API_BASE_URL}${endpoint}`;
        const token = this.getToken();

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (token) {
            (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });

            const data = await response.json();

            if (!response.ok) {
                return { error: data.error || 'Request failed' };
            }

            return { data };
        } catch (error) {
            return { error: 'Network error' };
        }
    }

    // Auth
    async login(username: string, password: string) {
        return this.request<{ token: string; user: any }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
    }

    async register(username: string, password: string, fullName: string) {
        return this.request<{ token: string; user: any }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password, fullName }),
        });
    }

    async verifyToken() {
        return this.request<any>('/auth/verify');
    }

    async changePassword(currentPassword: string, newPassword: string) {
        return this.request<{ message: string }>('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword }),
        });
    }

    // Users
    async getUsers() {
        return this.request<any[]>('/users');
    }

    async getUser(id: string) {
        return this.request<any>(`/users/${id}`);
    }

    async createUser(userData: any) {
        return this.request<any>('/users', {
            method: 'POST',
            body: JSON.stringify(userData),
        });
    }

    async updateUser(id: string, userData: any) {
        return this.request<any>(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(userData),
        });
    }

    async deleteUser(id: string) {
        return this.request<any>(`/users/${id}`, {
            method: 'DELETE',
        });
    }

    // Products
    async getProducts(params?: { category?: string; search?: string; page?: number; limit?: number }) {
        const query = new URLSearchParams();
        if (params?.category) query.set('category', params.category);
        if (params?.search) query.set('search', params.search);
        if (params?.page) query.set('page', String(params.page));
        if (params?.limit) query.set('limit', String(params.limit));

        const queryString = query.toString();
        return this.request<{ products: any[]; pagination: any }>(
            `/products${queryString ? `?${queryString}` : ''}`
        );
    }

    async getProduct(id: string) {
        return this.request<any>(`/products/${id}`);
    }

    async createProduct(productData: any) {
        return this.request<any>('/products', {
            method: 'POST',
            body: JSON.stringify(productData),
        });
    }

    async updateProduct(id: string, productData: any) {
        return this.request<any>(`/products/${id}`, {
            method: 'PUT',
            body: JSON.stringify(productData),
        });
    }

    async deleteProduct(id: string) {
        return this.request<any>(`/products/${id}`, {
            method: 'DELETE',
        });
    }

    async getProductBatches(productId: string) {
        return this.request<any[]>(`/products/${productId}/batches`);
    }

    async addProductBatch(productId: string, batchData: any) {
        return this.request<any>(`/products/${productId}/batches`, {
            method: 'POST',
            body: JSON.stringify(batchData),
        });
    }

    // Sales
    async getSales(params?: { startDate?: string; endDate?: string; paymentMethod?: string; voided?: boolean }) {
        const query = new URLSearchParams();
        if (params?.startDate) query.set('startDate', params.startDate);
        if (params?.endDate) query.set('endDate', params.endDate);
        if (params?.paymentMethod) query.set('paymentMethod', params.paymentMethod);
        if (params?.voided !== undefined) query.set('voided', String(params.voided));

        const queryString = query.toString();
        return this.request<{ sales: any[]; pagination: any }>(
            `/sales${queryString ? `?${queryString}` : ''}`
        );
    }

    async getSale(id: string) {
        return this.request<any>(`/sales/${id}`);
    }

    async createSale(saleData: { items: any[]; discount?: number; paymentMethod?: string }) {
        return this.request<any>('/sales', {
            method: 'POST',
            body: JSON.stringify(saleData),
        });
    }

    async voidSale(id: string, reason: string) {
        return this.request<any>(`/sales/${id}/void`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        });
    }

    // Inventory
    async getInventorySummary() {
        return this.request<any>('/inventory/summary');
    }

    async getStockMovements(params?: { productId?: string; type?: string; startDate?: string; endDate?: string }) {
        const query = new URLSearchParams();
        if (params?.productId) query.set('productId', params.productId);
        if (params?.type) query.set('type', params.type);
        if (params?.startDate) query.set('startDate', params.startDate);
        if (params?.endDate) query.set('endDate', params.endDate);

        const queryString = query.toString();
        return this.request<{ movements: any[]; pagination: any }>(
            `/inventory/movements${queryString ? `?${queryString}` : ''}`
        );
    }

    async adjustStock(productId: string, quantity: number, reason: string) {
        return this.request<any>('/inventory/adjust', {
            method: 'POST',
            body: JSON.stringify({ productId, quantity, reason }),
        });
    }

    async getAuditLogs(params?: { userId?: string; action?: string; entityType?: string }) {
        const query = new URLSearchParams();
        if (params?.userId) query.set('userId', params.userId);
        if (params?.action) query.set('action', params.action);
        if (params?.entityType) query.set('entityType', params.entityType);

        const queryString = query.toString();
        return this.request<{ logs: any[]; pagination: any }>(
            `/inventory/audit${queryString ? `?${queryString}` : ''}`
        );
    }

    // Customers (CRM)
    async getCustomers(params?: { search?: string; page?: number; limit?: number }) {
        const query = new URLSearchParams();
        if (params?.search) query.set('search', params.search);
        if (params?.page) query.set('page', String(params.page));
        if (params?.limit) query.set('limit', String(params.limit));

        const queryString = query.toString();
        return this.request<{ customers: any[]; pagination: any }>(
            `/customers${queryString ? `?${queryString}` : ''}`
        );
    }

    async getCustomer(id: string) {
        return this.request<any>(`/customers/${id}`);
    }

    async createCustomer(customerData: any) {
        return this.request<any>('/customers', {
            method: 'POST',
            body: JSON.stringify(customerData),
        });
    }

    async updateCustomer(id: string, customerData: any) {
        return this.request<any>(`/customers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(customerData),
        });
    }

    async deleteCustomer(id: string) {
        return this.request<any>(`/customers/${id}`, {
            method: 'DELETE',
        });
    }

    async getCustomerStats() {
        return this.request<any>('/customers/stats/summary');
    }

    // Suppliers
    async getSuppliers(params?: { search?: string; active?: boolean; page?: number; limit?: number }) {
        const query = new URLSearchParams();
        if (params?.search) query.set('search', params.search);
        if (params?.active !== undefined) query.set('active', String(params.active));
        if (params?.page) query.set('page', String(params.page));
        if (params?.limit) query.set('limit', String(params.limit));

        const queryString = query.toString();
        return this.request<{ suppliers: any[]; pagination: any }>(
            `/suppliers${queryString ? `?${queryString}` : ''}`
        );
    }

    async getSupplier(id: string) {
        return this.request<any>(`/suppliers/${id}`);
    }

    async createSupplier(supplierData: any) {
        return this.request<any>('/suppliers', {
            method: 'POST',
            body: JSON.stringify(supplierData),
        });
    }

    async updateSupplier(id: string, supplierData: any) {
        return this.request<any>(`/suppliers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(supplierData),
        });
    }

    // Purchase Orders
    async getPurchaseOrders(params?: { supplierId?: string; status?: string }) {
        const query = new URLSearchParams();
        if (params?.supplierId) query.set('supplierId', params.supplierId);
        if (params?.status) query.set('status', params.status);

        const queryString = query.toString();
        return this.request<{ orders: any[]; pagination: any }>(
            `/suppliers/orders${queryString ? `?${queryString}` : ''}`
        );
    }

    async createPurchaseOrder(orderData: any) {
        return this.request<any>('/suppliers/orders', {
            method: 'POST',
            body: JSON.stringify(orderData),
        });
    }

    // Settings (Tax, Branches)
    async getTaxSettings() {
        return this.request<any>('/settings/tax');
    }

    async updateTaxSettings(settings: { enabled: boolean; rate: number; taxNumber: string }) {
        return this.request<any>('/settings/tax', {
            method: 'PUT',
            body: JSON.stringify(settings),
        });
    }

    async calculateTax(amount: number, includeTax: boolean = false) {
        return this.request<any>('/settings/tax/calculate', {
            method: 'POST',
            body: JSON.stringify({ amount, includeTax }),
        });
    }

    async getBranches() {
        return this.request<any[]>('/settings/branches');
    }

    async createBranch(branchData: any) {
        return this.request<any>('/settings/branches', {
            method: 'POST',
            body: JSON.stringify(branchData),
        });
    }

    async updateBranch(id: string, branchData: any) {
        return this.request<any>(`/settings/branches/${id}`, {
            method: 'PUT',
            body: JSON.stringify(branchData),
        });
    }

    async getSettings() {
        return this.request<any>('/settings');
    }

    async updateSetting(key: string, value: any, type: string = 'string') {
        return this.request<any>('/settings', {
            method: 'PUT',
            body: JSON.stringify({ key, value, type }),
        });
    }
}

export const api = new ApiClient();
export default api;
