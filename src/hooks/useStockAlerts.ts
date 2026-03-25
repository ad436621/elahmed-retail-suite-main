// ============================================================
// Stock Alerts Hook — تنبيهات المخزون
// ============================================================

import { useState, useEffect, useMemo, useCallback } from 'react';

export interface StockAlert {
  id: string;
  productId: string;
  productName: string;
  type: 'low_stock' | 'out_of_stock';
  currentQty: number;
  minStock: number;
  category: string;   // e.g. 'mobile', 'accessory', 'computer'
  timestamp: string;
  read: boolean;
}

interface ProductForAlert {
  id: string;
  name: string;
  quantity: number;
  minStock?: number;
  category?: string;
}

/**
 * Checks a list of products and generates stock alerts
 */
function generateAlerts(products: ProductForAlert[], categoryLabel: string): StockAlert[] {
  const alerts: StockAlert[] = [];
  const now = new Date().toISOString();

  for (const p of products) {
    const minStock = p.minStock ?? 5; // default threshold

    if (p.quantity === 0) {
      alerts.push({
        id: `alert-oos-${p.id}`,
        productId: p.id,
        productName: p.name,
        type: 'out_of_stock',
        currentQty: 0,
        minStock,
        category: categoryLabel,
        timestamp: now,
        read: false,
      });
    } else if (p.quantity <= minStock) {
      alerts.push({
        id: `alert-low-${p.id}`,
        productId: p.id,
        productName: p.name,
        type: 'low_stock',
        currentQty: p.quantity,
        minStock,
        category: categoryLabel,
        timestamp: now,
        read: false,
      });
    }
  }

  return alerts;
}

/**
 * Hook that monitors inventory data and returns active stock alerts.
 * 
 * @param allProducts - All inventory products across different types
 * @param refreshIntervalMs - How often to recheck (default: 5 minutes)
 */
export function useStockAlerts(allProducts: ProductForAlert[], refreshIntervalMs = 5 * 60 * 1000) {
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('__stock_alerts_read');
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const alerts = useMemo(() => {
    const raw = generateAlerts(allProducts, 'inventory');
    return raw.map(a => ({
      ...a,
      read: readIds.has(a.id),
    }));
  }, [allProducts, readIds]);

  const unreadCount = useMemo(() => alerts.filter(a => !a.read).length, [alerts]);

  const markAsRead = useCallback((alertId: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(alertId);
      localStorage.setItem('__stock_alerts_read', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadIds(prev => {
      const next = new Set(prev);
      alerts.forEach(a => next.add(a.id));
      localStorage.setItem('__stock_alerts_read', JSON.stringify([...next]));
      return next;
    });
  }, [alerts]);

  const clearRead = useCallback(() => {
    setReadIds(new Set());
    localStorage.removeItem('__stock_alerts_read');
  }, []);

  return {
    alerts,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearRead,
  };
}
