// ============================================================
// React Query Hooks for API Calls
// Replaces useEffect + fetch with caching, deduplication, and retry
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// API base configuration
const API_BASE = import.meta.env.VITE_API_URL || '';

// Default fetch function
async function fetchApi<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Request failed');
    }

    return response.json();
}

// Query keys for cache management
export const queryKeys = {
    // Products
    products: ['products'] as const,
    product: (id: string) => ['products', id] as const,
    productsByCategory: (category: string) => ['products', 'category', category] as const,

    // Sales
    sales: ['sales'] as const,
    sale: (id: string) => ['sales', id] as const,

    // Dashboard
    dashboardStats: ['dashboard', 'stats'] as const,
    topProducts: ['dashboard', 'topProducts'] as const,

    // Customers
    customers: ['customers'] as const,
    customer: (id: string) => ['customers', id] as const,

    // Suppliers
    suppliers: ['suppliers'] as const,
    supplier: (id: string) => ['suppliers', id] as const,

    // Inventory
    inventorySummary: ['inventory', 'summary'] as const,
    lowStock: ['inventory', 'lowStock'] as const,

    // Users
    users: ['users'] as const,
    user: (id: string) => ['users', id] as const,
};

// ============================================================
// Products Hooks
// ============================================================

interface ProductsParams {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
}

export function useProducts(params: ProductsParams = {}) {
    const queryString = new URLSearchParams();
    if (params.page) queryString.set('page', String(params.page));
    if (params.limit) queryString.set('limit', String(params.limit));
    if (params.category) queryString.set('category', params.category);
    if (params.search) queryString.set('search', params.search);

    return useQuery({
        queryKey: [...queryKeys.products, params],
        queryFn: () => fetchApi<any>(`/api/products?${queryString}`),
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    });
}

export function useProduct(id: string) {
    return useQuery({
        queryKey: queryKeys.product(id),
        queryFn: () => fetchApi<any>(`/api/products/${id}`),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: any) => fetchApi<any>('/api/products', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.products });
        },
    });
}

export function useUpdateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) =>
            fetchApi<any>(`/api/products/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data),
            }),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.products });
            queryClient.invalidateQueries({ queryKey: queryKeys.product(id) });
        },
    });
}

export function useDeleteProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => fetchApi<any>(`/api/products/${id}`, {
            method: 'DELETE',
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.products });
        },
    });
}

// ============================================================
// Sales Hooks
// ============================================================

interface SalesParams {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    paymentMethod?: string;
}

export function useSales(params: SalesParams = {}) {
    const queryString = new URLSearchParams();
    if (params.page) queryString.set('page', String(params.page));
    if (params.limit) queryString.set('limit', String(params.limit));
    if (params.startDate) queryString.set('startDate', params.startDate);
    if (params.endDate) queryString.set('endDate', params.endDate);
    if (params.paymentMethod) queryString.set('paymentMethod', params.paymentMethod);

    return useQuery({
        queryKey: [...queryKeys.sales, params],
        queryFn: () => fetchApi<any>(`/api/sales?${queryString}`),
        staleTime: 1 * 60 * 1000, // 1 minute
    });
}

export function useSale(id: string) {
    return useQuery({
        queryKey: queryKeys.sale(id),
        queryFn: () => fetchApi<any>(`/api/sales/${id}`),
        enabled: !!id,
    });
}

export function useCreateSale() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: any) => fetchApi<any>('/api/sales', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.sales });
            queryClient.invalidateQueries({ queryKey: queryKeys.products });
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
        },
    });
}

export function useVoidSale() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            fetchApi<any>(`/api/sales/${id}/void`, {
                method: 'POST',
                body: JSON.stringify({ reason }),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.sales });
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
        },
    });
}

// ============================================================
// Dashboard Hooks
// ============================================================

export function useDashboardStats() {
    return useQuery({
        queryKey: queryKeys.dashboardStats,
        queryFn: () => fetchApi<any>('/api/dashboard/stats'),
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    });
}

export function useTopProducts(limit = 10) {
    return useQuery({
        queryKey: [...queryKeys.topProducts, limit],
        queryFn: () => fetchApi<any>(`/api/dashboard/top-products?limit=${limit}`),
        staleTime: 5 * 60 * 1000,
    });
}

// ============================================================
// Customers Hooks
// ============================================================

export function useCustomers(params: { search?: string; page?: number; limit?: number } = {}) {
    const queryString = new URLSearchParams();
    if (params.search) queryString.set('search', params.search);
    if (params.page) queryString.set('page', String(params.page));
    if (params.limit) queryString.set('limit', String(params.limit));

    return useQuery({
        queryKey: [...queryKeys.customers, params],
        queryFn: () => fetchApi<any>(`/api/customers?${queryString}`),
        staleTime: 5 * 60 * 1000,
    });
}

export function useCustomer(id: string) {
    return useQuery({
        queryKey: queryKeys.customer(id),
        queryFn: () => fetchApi<any>(`/api/customers/${id}`),
        enabled: !!id,
    });
}

export function useCreateCustomer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: any) => fetchApi<any>('/api/customers', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.customers });
        },
    });
}

export function useUpdateCustomer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) =>
            fetchApi<any>(`/api/customers/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data),
            }),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.customers });
            queryClient.invalidateQueries({ queryKey: queryKeys.customer(id) });
        },
    });
}

export function useDeleteCustomer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => fetchApi<any>(`/api/customers/${id}`, {
            method: 'DELETE',
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.customers });
        },
    });
}

// ============================================================
// Suppliers Hooks
// ============================================================

export function useSuppliers(params: { search?: string; active?: boolean } = {}) {
    const queryString = new URLSearchParams();
    if (params.search) queryString.set('search', params.search);
    if (params.active !== undefined) queryString.set('active', String(params.active));

    return useQuery({
        queryKey: [...queryKeys.suppliers, params],
        queryFn: () => fetchApi<any>(`/api/suppliers?${queryString}`),
        staleTime: 5 * 60 * 1000,
    });
}

export function useSupplier(id: string) {
    return useQuery({
        queryKey: queryKeys.supplier(id),
        queryFn: () => fetchApi<any>(`/api/suppliers/${id}`),
        enabled: !!id,
    });
}

// ============================================================
// Inventory Hooks
// ============================================================

export function useInventorySummary() {
    return useQuery({
        queryKey: queryKeys.inventorySummary,
        queryFn: () => fetchApi<any>('/api/inventory/summary'),
        staleTime: 2 * 60 * 1000,
    });
}

export function useLowStock(threshold = 10) {
    return useQuery({
        queryKey: [...queryKeys.lowStock, threshold],
        queryFn: () => fetchApi<any>(`/api/products/low-stock?threshold=${threshold}`),
        staleTime: 5 * 60 * 1000,
    });
}

// ============================================================
// Users Hooks
// ============================================================

export function useUsers() {
    return useQuery({
        queryKey: queryKeys.users,
        queryFn: () => fetchApi<any>('/api/users'),
        staleTime: 5 * 60 * 1000,
    });
}

export function useUser(id: string) {
    return useQuery({
        queryKey: queryKeys.user(id),
        queryFn: () => fetchApi<any>(`/api/users/${id}`),
        enabled: !!id,
    });
}

export function useCreateUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: any) => fetchApi<any>('/api/users', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.users });
        },
    });
}

export function useUpdateUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) =>
            fetchApi<any>(`/api/users/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.users });
        },
    });
}

export function useDeleteUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => fetchApi<any>(`/api/users/${id}`, {
            method: 'DELETE',
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.users });
        },
    });
}
