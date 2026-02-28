// ============================================================
// Ultra-Fast React Query Configuration
// Optimized for maximum speed
// ============================================================

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Cache data for 10 minutes (very aggressive)
            staleTime: 1000 * 60 * 10,

            // Keep unused data in cache for 30 minutes
            gcTime: 1000 * 60 * 30,

            // Don't refetch on window focus (faster!)
            refetchOnWindowFocus: false,

            // Don't refetch on reconnect (faster!)
            refetchOnReconnect: false,

            // Retry failed requests only once (faster failure handling)
            retry: 1,

            // Use stale-while-revalidate pattern (show cached data while fetching)
            placeholderData: (previousData) => previousData,

            // Always refetch on mount
            refetchOnMount: 'always',
        },
        mutations: {
            // Retry mutations once
            retry: 1,
        },
    },
});

// Predefined query keys for consistent caching
export const queryKeys = {
    // Dashboard
    dashboard: {
        stats: ['dashboard', 'stats'] as const,
        recentSales: ['dashboard', 'recentSales'] as const,
    },

    // Inventory
    inventory: {
        all: ['inventory', 'all'] as const,
        list: (category: string) => ['inventory', 'list', category] as const,
        item: (id: string) => ['inventory', 'item', id] as const,
        search: (term: string) => ['inventory', 'search', term] as const,
        lowStock: ['inventory', 'lowStock'] as const,
    },

    // Sales
    sales: {
        all: ['sales', 'all'] as const,
        list: (filters?: Record<string, unknown>) => ['sales', 'list', filters] as const,
        item: (id: string) => ['sales', 'item', id] as const,
        today: ['sales', 'today'] as const,
    },

    // Products
    products: {
        all: ['products', 'all'] as const,
        list: (category: string) => ['products', 'list', category] as const,
        item: (id: string) => ['products', 'item', id] as const,
        barcode: (barcode: string) => ['products', 'barcode', barcode] as const,
    },

    // Categories
    categories: {
        all: ['categories', 'all'] as const,
        list: () => ['categories', 'list'] as const,
    },

    // Users
    users: {
        all: ['users', 'all'] as const,
        list: ['users', 'list'] as const,
        item: (id: string) => ['users', 'item', id] as const,
    },

    // Settings
    settings: {
        all: ['settings', 'all'] as const,
        key: (key: string) => ['settings', 'key', key] as const,
    },

    // Installments
    installments: {
        all: ['installments', 'all'] as const,
        list: ['installments', 'list'] as const,
        item: (id: string) => ['installments', 'item', id] as const,
        due: ['installments', 'due'] as const,
    },

    // Customers
    customers: {
        all: ['customers', 'all'] as const,
        list: ['customers', 'list'] as const,
        item: (id: string) => ['customers', 'item', id] as const,
        search: (term: string) => ['customers', 'search', term] as const,
    },
};

export default queryClient;
