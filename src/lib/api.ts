// ============================================================
// ELAHMED RETAIL SUITE — API Client
// Connects to Node.js/Express backend
// ============================================================

import { STORAGE_KEYS, APP_CONFIG } from '@/config';
import { User, Product, ProductBatch, Sale, StockMovement, AuditEntry } from '@/domain/types';

const API_BASE_URL = APP_CONFIG.API_BASE_URL;

interface ApiResponse<T> {
    data?: T;
    error?: string;
}

class ApiClient {
    private token: string | null = null;

    setToken(token: string | null) {
        this.token = token;
        if (token) {
            localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
        } else {
            localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        }
    }

    getToken(): string | null {
        if (!this.token) {
            this.token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
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
        return this.request<{ token: string; user: User }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
    }

    async register(username: string, password: string, fullName: string) {
        return this.request<{ token: string; user: User }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password, fullName }),
        });
    }

    async verifyToken() {
        return this.request<User>('/auth/verify');
    }

    async changePassword(currentPassword: string, newPassword: string) {
        return this.request<{ message: string }>('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword }),
        });
    }

    // Users
    async getUsers() {
        return this.request<User[]>('/users');
    }

    async getUser(id: string) {
        return this.request<User>(`/users/${id}`);
    }

    async createUser(userData: Partial<User>) {
        return this.request<User>('/users', {
            method: 'POST',
            body: JSON.stringify(userData),
        });
    }

    async updateUser(id: string, userData: Partial<User>) {
        return this.request<User>(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(userData),
        });
    }

    async deleteUser(id: string) {
        return this.request<{ message: string }>(`/users/${id}`, {
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
        return this.request<{ products: Product[]; pagination: Record<string, unknown> }>(
            `/products${queryString ? `?${queryString}` : ''}`
        );
    }

    async getProduct(id: string) {
        return this.request<Product>(`/products/${id}`);
    }

    async createProduct(productData: Partial<Product>) {
        return this.request<Product>('/products', {
            method: 'POST',
            body: JSON.stringify(productData),
        });
    }

    async updateProduct(id: string, productData: Partial<Product>) {
        return this.request<Product>(`/products/${id}`, {
            method: 'PUT',
            body: JSON.stringify(productData),
        });
    }

    async deleteProduct(id: string) {
        return this.request<{ message: string }>(`/products/${id}`, {
            method: 'DELETE',
        });
    }

    async getProductBatches(productId: string) {
        return this.request<ProductBatch[]>(`/products/${productId}/batches`);
    }

    async addProductBatch(productId: string, batchData: Partial<ProductBatch>) {
        return this.request<ProductBatch>(`/products/${productId}/batches`, {
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
        return this.request<{ sales: Sale[]; pagination: Record<string, unknown> }>(
            `/sales${queryString ? `?${queryString}` : ''}`
        );
    }

    async getSale(id: string) {
        return this.request<Sale>(`/sales/${id}`);
    }

    async createSale(saleData: { items: Record<string, unknown>[]; discount?: number; paymentMethod?: string }) {
        return this.request<Sale>('/sales', {
            method: 'POST',
            body: JSON.stringify(saleData),
        });
    }

    async voidSale(id: string, reason: string) {
        return this.request<Sale>(`/sales/${id}/void`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        });
    }

    // Inventory
    async getInventorySummary() {
        return this.request<Record<string, unknown>>('/inventory/summary');
    }

    async getStockMovements(params?: { productId?: string; type?: string; startDate?: string; endDate?: string }) {
        const query = new URLSearchParams();
        if (params?.productId) query.set('productId', params.productId);
        if (params?.type) query.set('type', params.type);
        if (params?.startDate) query.set('startDate', params.startDate);
        if (params?.endDate) query.set('endDate', params.endDate);

        const queryString = query.toString();
        return this.request<{ movements: StockMovement[]; pagination: Record<string, unknown> }>(
            `/inventory/movements${queryString ? `?${queryString}` : ''}`
        );
    }

    async adjustStock(productId: string, quantity: number, reason: string) {
        return this.request<StockMovement>('/inventory/adjust', {
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
        return this.request<{ logs: AuditEntry[]; pagination: Record<string, unknown> }>(
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
        return this.request<{ customers: Record<string, unknown>[]; pagination: Record<string, unknown> }>(
            `/customers${queryString ? `?${queryString}` : ''}`
        );
    }

    async getCustomer(id: string) {
        return this.request<Record<string, unknown>>(`/customers/${id}`);
    }

    async createCustomer(customerData: Record<string, unknown>) {
        return this.request<Record<string, unknown>>('/customers', {
            method: 'POST',
            body: JSON.stringify(customerData),
        });
    }

    async updateCustomer(id: string, customerData: Record<string, unknown>) {
        return this.request<Record<string, unknown>>(`/customers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(customerData),
        });
    }

    async deleteCustomer(id: string) {
        return this.request<{ message: string }>(`/customers/${id}`, {
            method: 'DELETE',
        });
    }

    async getCustomerStats() {
        return this.request<Record<string, unknown>>('/customers/stats/summary');
    }

    // Suppliers
    async getSuppliers(params?: { search?: string; active?: boolean; page?: number; limit?: number }) {
        const query = new URLSearchParams();
        if (params?.search) query.set('search', params.search);
        if (params?.active !== undefined) query.set('active', String(params.active));
        if (params?.page) query.set('page', String(params.page));
        if (params?.limit) query.set('limit', String(params.limit));

        const queryString = query.toString();
        return this.request<{ suppliers: Record<string, unknown>[]; pagination: Record<string, unknown> }>(
            `/suppliers${queryString ? `?${queryString}` : ''}`
        );
    }

    async getSupplier(id: string) {
        return this.request<Record<string, unknown>>(`/suppliers/${id}`);
    }

    async createSupplier(supplierData: Record<string, unknown>) {
        return this.request<Record<string, unknown>>('/suppliers', {
            method: 'POST',
            body: JSON.stringify(supplierData),
        });
    }

    async updateSupplier(id: string, supplierData: Record<string, unknown>) {
        return this.request<Record<string, unknown>>(`/suppliers/${id}`, {
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
        return this.request<{ orders: Record<string, unknown>[]; pagination: Record<string, unknown> }>(
            `/suppliers/orders${queryString ? `?${queryString}` : ''}`
        );
    }

    async createPurchaseOrder(orderData: Record<string, unknown>) {
        return this.request<Record<string, unknown>>('/suppliers/orders', {
            method: 'POST',
            body: JSON.stringify(orderData),
        });
    }

    // Settings (Tax, Branches)
    async getTaxSettings() {
        return this.request<Record<string, unknown>>('/settings/tax');
    }

    async updateTaxSettings(settings: { enabled: boolean; rate: number; taxNumber: string }) {
        return this.request<Record<string, unknown>>('/settings/tax', {
            method: 'PUT',
            body: JSON.stringify(settings),
        });
    }

    async calculateTax(amount: number, includeTax: boolean = false) {
        return this.request<Record<string, unknown>>('/settings/tax/calculate', {
            method: 'POST',
            body: JSON.stringify({ amount, includeTax }),
        });
    }

    async getBranches() {
        return this.request<Record<string, unknown>[]>('/settings/branches');
    }

    async createBranch(branchData: Record<string, unknown>) {
        return this.request<Record<string, unknown>>('/settings/branches', {
            method: 'POST',
            body: JSON.stringify(branchData),
        });
    }

    async updateBranch(id: string, branchData: Record<string, unknown>) {
        return this.request<Record<string, unknown>>(`/settings/branches/${id}`, {
            method: 'PUT',
            body: JSON.stringify(branchData),
        });
    }

    async getSettings() {
        return this.request<Record<string, unknown>>('/settings');
    }

    async updateSetting(key: string, value: unknown, type: string = 'string') {
        return this.request<Record<string, unknown>>('/settings', {
            method: 'PUT',
            body: JSON.stringify({ key, value, type }),
        });
    }
}

export const api = new ApiClient();
export default api;
