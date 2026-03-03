// ============================================================
// Shift Closing Data Layer
// ============================================================

import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';

const KEY = 'gx_shift_closings';

function genId() {
    return `shift_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Types ──────────────────────────────────────────────────

export interface ShiftClosing {
    id: string;
    shiftDate: string;
    closedAt: string;
    closedBy: string;
    salesCount: number;
    salesCash: number;
    salesCard: number;
    salesTransfer: number;
    salesTotal: number;
    expectedCash: number;
    actualCash: number;
    cashDifference: number;
    notes?: string;
    createdAt: string;
}

export interface ShiftSummary {
    salesCount: number;
    salesCash: number;
    salesCard: number;
    salesTransfer: number;
    salesTotal: number;
    expectedCash: number;
}

// ─── CRUD ───────────────────────────────────────────────────

export function getShiftClosings(): ShiftClosing[] {
    return getStorageItem<ShiftClosing[]>(KEY, []);
}

export function addShiftClosing(data: Omit<ShiftClosing, 'id' | 'createdAt'>): ShiftClosing {
    const entry: ShiftClosing = {
        ...data,
        id: genId(),
        createdAt: new Date().toISOString(),
    };
    setStorageItem(KEY, [...getShiftClosings(), entry]);
    return entry;
}

export function getLastShiftClosing(): ShiftClosing | null {
    const all = getShiftClosings();
    return all.length > 0 ? all[all.length - 1] : null;
}

// ─── Build Summary From Sales ────────────────────────────────

/** Reads raw sales from localStorage and builds a shift summary for today */
export function buildShiftSummary(closedBy: string, actualCash: number, notes?: string): Omit<ShiftClosing, 'id' | 'createdAt'> {
    const today = new Date().toISOString().slice(0, 10);
    const lastClose = getLastShiftClosing();
    const lastClosedAt = lastClose?.closedAt ?? new Date(today).toISOString();

    // Read raw sales from localStorage
    const rawSales: Array<{
        createdAt?: string; total?: number;
        paymentMethod?: string; items?: unknown[];
    }> = JSON.parse(localStorage.getItem('gx_sales') || '[]');

    // Filter to sales after last closing
    const currentSales = rawSales.filter(s => {
        const sDate = s.createdAt ?? '';
        return sDate >= lastClosedAt;
    });

    let salesCash = 0, salesCard = 0, salesTransfer = 0;
    currentSales.forEach(s => {
        const amount = s.total ?? 0;
        if (s.paymentMethod === 'cash') salesCash += amount;
        else if (s.paymentMethod === 'card') salesCard += amount;
        else salesTransfer += amount;
    });

    const salesTotal = salesCash + salesCard + salesTransfer;
    const expectedCash = salesCash;

    return {
        shiftDate: today,
        closedAt: new Date().toISOString(),
        closedBy,
        salesCount: currentSales.length,
        salesCash,
        salesCard,
        salesTransfer,
        salesTotal,
        expectedCash,
        actualCash,
        cashDifference: actualCash - expectedCash,
        notes,
    };
}
