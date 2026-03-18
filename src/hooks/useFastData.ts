// ============================================================
// Ultra-Fast Cached Data Hook
// Caches localStorage data in memory for instant access
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';

// In-memory cache
const dataCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes

interface CacheOptions {
    duration?: number;
    lazy?: boolean;
}

export function useFastData<T>(
    key: string,
    fetcher: () => T,
    options: CacheOptions = {}
): {
    data: T | null;
    loading: boolean;
    refresh: () => void;
} {
    const { duration = CACHE_DURATION, lazy = false } = options;
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(!lazy);
    const fetchingRef = useRef(false);

    const fetchData = useCallback(() => {
        const now = Date.now();
        const cached = dataCache.get(key);

        if (cached && now - cached.timestamp < duration) {
            setData(cached.data as T);
            setLoading(false);
            return;
        }

        if (fetchingRef.current) return;
        fetchingRef.current = true;
        setLoading(true);

        const fetchFn = () => {
            try {
                const result = fetcher();
                dataCache.set(key, { data: result, timestamp: Date.now() });
                setData(result);
            } catch (error) {
                console.error(`Error fetching ${key}:`, error);
            } finally {
                setLoading(false);
                fetchingRef.current = false;
            }
        };

        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => fetchFn(), { timeout: 100 });
        } else {
            setTimeout(fetchFn, 0);
        }
    }, [key, fetcher, duration]);

    useEffect(() => {
        if (!lazy) {
            fetchData();
        }
    }, [fetchData, lazy]);

    return {
        data,
        loading,
        refresh: fetchData,
    };
}

export function preloadData<T>(key: string, fetcher: () => T): void {
    if (dataCache.has(key)) return;
    try {
        const result = fetcher();
        dataCache.set(key, { data: result, timestamp: Date.now() });
    } catch (error) {
        console.error(`Error preloading ${key}:`, error);
    }
}

export function clearCache(key?: string): void {
    if (key) {
        dataCache.delete(key);
    } else {
        dataCache.clear();
    }
}

export function getCachedData<T>(key: string): T | null {
    const cached = dataCache.get(key);
    return cached ? (cached.data as T) : null;
}

// Preload all dashboard data in background
export function preloadDashboardData(): void {
    Promise.all([
        import('@/data/mobilesData'),
        import('@/data/devicesData'),
        import('@/data/computersData'),
        import('@/data/maintenanceData'),
        import('@/data/installmentsData'),
        import('@/data/expensesData'),
        import('@/data/carsData'),
    ]).then(([mobiles, devices, computers, maintenance, installments, expenses, cars]) => {
        try { preloadData('mobiles', mobiles.getMobiles); } catch { /* Optional preload */ }
        try { preloadData('mobileAccessories', mobiles.getMobileAccessories); } catch { /* Optional preload */ }
        try { preloadData('devices', devices.getDevices); } catch { /* Optional preload */ }
        try { preloadData('deviceAccessories', devices.getDeviceAccessories); } catch { /* Optional preload */ }
        try { preloadData('computers', computers.getComputers); } catch { /* Optional preload */ }
        try { preloadData('computerAccessories', computers.getComputerAccessories); } catch { /* Optional preload */ }
        try { preloadData('maintenance', maintenance.getMaintenanceOrders); } catch { /* Optional preload */ }
        try { preloadData('installments', installments.getContracts); } catch { /* Optional preload */ }
        try { preloadData('expenses', expenses.getExpenses); } catch { /* Optional preload */ }
        try { preloadData('cars', cars.getCars); } catch { /* Optional preload */ }
    });

    import('@/repositories/saleRepository').then(sales => {
        try { preloadData('sales', sales.getAllSales); } catch { /* Optional preload */ }
    }).catch(() => { /* Optional preload */ });
}

export default useFastData;
