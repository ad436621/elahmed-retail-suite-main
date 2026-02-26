import { useState, useEffect, useRef } from 'react';

/**
 * Hook to reactively fetch and sync data from localStorage.
 * It listens to both the native 'storage' event (other tabs)
 * and a custom 'local-storage' event (current tab).
 */
export function useInventoryData<T>(fetcher: () => T, listenKeys: string[]): T {
    const [data, setData] = useState<T>(fetcher);

    // stable string representation
    const stableKeysStr = listenKeys.join(',');

    const fetcherRef = useRef(fetcher);
    useEffect(() => {
        fetcherRef.current = fetcher;
    });

    useEffect(() => {
        const keysArray = stableKeysStr.split(',');

        const handleLocal = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (keysArray.includes(customEvent.detail.key)) {
                setData(fetcherRef.current());
            }
        };

        const handleStorage = (e: StorageEvent) => {
            if (keysArray.includes(e.key ?? '')) {
                setData(fetcherRef.current());
            }
        };

        window.addEventListener('local-storage', handleLocal);
        window.addEventListener('storage', handleStorage);

        // Fetch once on mount to catch any changes that happened between render and effect
        setData(fetcherRef.current());

        return () => {
            window.removeEventListener('local-storage', handleLocal);
            window.removeEventListener('storage', handleStorage);
        };
    }, [stableKeysStr]);

    return data;
}
