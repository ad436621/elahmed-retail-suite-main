// ============================================================
// Reminders Data Layer
// ============================================================

import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

const KEY = STORAGE_KEYS.REMINDERS;



// ─── Types ──────────────────────────────────────────────────

export type ReminderPriority = 'low' | 'medium' | 'high';
export type ReminderCategory = 'payment' | 'maintenance' | 'installment' | 'supplier' | 'general';
export type ReminderStatus = 'pending' | 'done' | 'dismissed';

export interface Reminder {
    id: string;
    title: string;
    description?: string;
    reminderDate: string;   // YYYY-MM-DD
    reminderTime?: string;  // HH:mm
    category: ReminderCategory;
    priority: ReminderPriority;
    status: ReminderStatus;
    notes?: string;
    createdAt: string;
    completedAt?: string;
}

export const CATEGORY_LABELS: Record<ReminderCategory, string> = {
    payment: 'دفعة',
    maintenance: 'صيانة',
    installment: 'قسط',
    supplier: 'مورد',
    general: 'عام',
};

export const PRIORITY_LABELS: Record<ReminderPriority, string> = {
    high: 'عالي',
    medium: 'متوسط',
    low: 'منخفض',
};

// ─── CRUD ────────────────────────────────────────────────────

export function getReminders(): Reminder[] {
    return getStorageItem<Reminder[]>(KEY, []);
}

export function saveReminders(reminders: Reminder[]): void {
    setStorageItem(KEY, reminders);
}

export function addReminder(data: Omit<Reminder, 'id' | 'createdAt'>): Reminder {
    const r: Reminder = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    saveReminders([...getReminders(), r]);
    return r;
}

export function updateReminder(id: string, data: Partial<Reminder>): void {
    saveReminders(getReminders().map(r => r.id === id ? { ...r, ...data } : r));
}

export function deleteReminder(id: string): void {
    saveReminders(getReminders().filter(r => r.id !== id));
}

export function markReminderDone(id: string): void {
    updateReminder(id, { status: 'done', completedAt: new Date().toISOString() });
}

// ─── Queries ───────────────────────────────────────────────

export function getTodayReminders(): Reminder[] {
    const today = new Date().toISOString().slice(0, 10);
    return getReminders().filter(r => r.reminderDate === today && r.status === 'pending');
}

export function getPendingRemindersCount(): number {
    const today = new Date().toISOString().slice(0, 10);
    return getReminders().filter(r => r.status === 'pending' && r.reminderDate <= today).length;
}

export function getOverdueReminders(): Reminder[] {
    const today = new Date().toISOString().slice(0, 10);
    return getReminders().filter(r => r.status === 'pending' && r.reminderDate < today);
}
