// ============================================================
// GX GLEAMEX - Expenses Data Layer
// ============================================================

import { Expense, ExpenseCategory } from '@/domain/types';
import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { callElectronSync, emitDataChange, hasElectronIpc, readElectronSync } from '@/lib/electronDataBridge';

const KEY = STORAGE_KEYS.EXPENSES;

interface ExpenseRow {
  id: string;
  category: ExpenseCategory;
  description?: string | null;
  amount: number;
  date: string;
  employee?: string | null;
  createdAt?: string | null;
}

function normalizeExpense(row: Partial<ExpenseRow>): Expense {
  return {
    id: String(row.id ?? crypto.randomUUID()),
    date: String(row.date ?? new Date().toISOString().slice(0, 10)),
    description: String(row.description ?? ''),
    amount: Number(row.amount ?? 0),
    category: (row.category ?? 'other') as ExpenseCategory,
    addedBy: row.employee ? String(row.employee) : '',
    createdAt: row.createdAt || new Date().toISOString(),
  };
}

function toExpenseRow(expense: Expense) {
  return {
    id: expense.id,
    category: expense.category,
    description: expense.description,
    amount: expense.amount,
    date: expense.date,
    employee: expense.addedBy || null,
    createdAt: expense.createdAt,
  };
}

function loadLocalExpenses(): Expense[] {
  const saved = getStorageItem<Expense[]>(KEY, []);
  return (Array.isArray(saved) ? saved : []).map(normalizeExpense);
}

function persistElectronExpenses(expenses: Expense[]): void {
  const existing = new Map(getExpenses().map((expense) => [expense.id, expense]));
  const nextIds = new Set(expenses.map((expense) => expense.id));

  for (const expense of expenses.map(normalizeExpense)) {
    const payload = toExpenseRow(expense);
    if (existing.has(expense.id)) {
      callElectronSync('db-sync:expenses:update', expense.id, payload);
    } else {
      callElectronSync('db-sync:expenses:add', payload);
    }
  }

  for (const id of existing.keys()) {
    if (!nextIds.has(id)) {
      callElectronSync('db-sync:expenses:delete', id);
    }
  }

  emitDataChange(KEY);
}

export function getExpenses(): Expense[] {
  if (hasElectronIpc()) {
    const rows = readElectronSync<ExpenseRow[]>('db-sync:expenses:get', []);
    return rows.map(normalizeExpense);
  }

  return loadLocalExpenses();
}

export function saveExpenses(expenses: Expense[]): void {
  const normalized = expenses.map(normalizeExpense);

  if (hasElectronIpc()) {
    persistElectronExpenses(normalized);
    return;
  }

  setStorageItem(KEY, normalized);
}

export function addExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Expense {
  const newExpense = normalizeExpense({
    ...expense,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });

  if (hasElectronIpc()) {
    const saved = callElectronSync<ExpenseRow>('db-sync:expenses:add', toExpenseRow(newExpense));
    emitDataChange(KEY);
    return normalizeExpense(saved ?? newExpense);
  }

  saveExpenses([...loadLocalExpenses(), newExpense]);
  return newExpense;
}

export function deleteExpense(id: string): void {
  if (hasElectronIpc()) {
    callElectronSync('db-sync:expenses:delete', id);
    emitDataChange(KEY);
    return;
  }

  setStorageItem(KEY, loadLocalExpenses().filter((expense) => expense.id !== id));
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
  return getExpenses()
    .filter((expense) => expense.date.startsWith(month))
    .reduce((sum, expense) => sum + expense.amount, 0);
}
