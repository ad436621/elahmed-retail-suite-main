// ============================================================
// GX GLEAMEX — Expenses Data Layer
// ============================================================

import { Expense, ExpenseCategory } from '@/domain/types';

const KEY = 'gx_expenses';

export function getExpenses(): Expense[] {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function saveExpenses(expenses: Expense[]): void {
    localStorage.setItem(KEY, JSON.stringify(expenses));
}

export function addExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Expense {
    const all = getExpenses();
    const newExpense: Expense = {
        ...expense,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
    };
    saveExpenses([...all, newExpense]);
    return newExpense;
}

export function deleteExpense(id: string): void {
    saveExpenses(getExpenses().filter(e => e.id !== id));
}

export function getExpenseCategoryLabel(cat: ExpenseCategory): string {
    const labels: Record<ExpenseCategory, string> = {
        rent: 'إيجار',
        utilities: 'مرافق (كهرباء/مياه)',
        salaries: 'رواتب',
        supplies: 'مستلزمات',
        maintenance: 'صيانة',
        transport: 'مواصلات',
        other: 'أخرى',
    };
    return labels[cat] ?? cat;
}

export function getMonthlyTotal(month: string): number {
    // month format: "YYYY-MM"
    return getExpenses()
        .filter(e => e.date.startsWith(month))
        .reduce((sum, e) => sum + e.amount, 0);
}
