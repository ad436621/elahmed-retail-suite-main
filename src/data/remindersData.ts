// ============================================================
// Reminders Data Layer
// ============================================================

import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { callElectronSync, emitDataChange, hasElectronIpc, readElectronSync } from '@/lib/electronDataBridge';

const KEY = STORAGE_KEYS.REMINDERS;

export type ReminderPriority = 'low' | 'medium' | 'high';
export type ReminderCategory = 'payment' | 'maintenance' | 'installment' | 'supplier' | 'general';
export type ReminderStatus = 'pending' | 'done' | 'dismissed';

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  reminderDate: string;
  reminderTime?: string;
  category: ReminderCategory;
  priority: ReminderPriority;
  status: ReminderStatus;
  notes?: string;
  createdAt: string;
  completedAt?: string;
}

interface ReminderRow {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  reminderTime?: string | null;
  priority?: string | null;
  status?: string | null;
  completed?: number | boolean | null;
  completedAt?: string | null;
  category?: string | null;
  notes?: string | null;
  createdAt?: string | null;
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

function normalizePriority(value: unknown): ReminderPriority {
  return value === 'low' || value === 'high' ? value : 'medium';
}

function normalizeCategory(value: unknown): ReminderCategory {
  return value === 'payment' || value === 'maintenance' || value === 'installment' || value === 'supplier'
    ? value
    : 'general';
}

function normalizeStatus(row: Partial<ReminderRow>): ReminderStatus {
  if (row.status === 'done' || row.status === 'dismissed') return row.status;
  if (row.completed) return 'done';
  return 'pending';
}

function normalizeReminder(row: Partial<ReminderRow>): Reminder {
  const now = new Date().toISOString();
  return {
    id: String(row.id ?? crypto.randomUUID()),
    title: String(row.title ?? ''),
    description: row.description ? String(row.description) : undefined,
    reminderDate: String(row.dueDate ?? new Date().toISOString().slice(0, 10)),
    reminderTime: row.reminderTime ? String(row.reminderTime) : undefined,
    category: normalizeCategory(row.category),
    priority: normalizePriority(row.priority),
    status: normalizeStatus(row),
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.createdAt ?? now),
    completedAt: row.completedAt ? String(row.completedAt) : undefined,
  };
}

function toReminderRow(reminder: Reminder): ReminderRow {
  const completed = reminder.status === 'done';
  return {
    id: reminder.id,
    title: reminder.title,
    description: reminder.description ?? null,
    dueDate: reminder.reminderDate,
    reminderTime: reminder.reminderTime ?? null,
    priority: reminder.priority,
    status: reminder.status,
    completed,
    completedAt: completed ? reminder.completedAt ?? new Date().toISOString() : reminder.completedAt ?? null,
    category: reminder.category,
    notes: reminder.notes ?? null,
    createdAt: reminder.createdAt,
  };
}

function loadLocalReminders(): Reminder[] {
  return getStorageItem<Reminder[]>(KEY, []).map(normalizeReminder);
}

function persistElectronReminders(reminders: Reminder[]): void {
  const existing = new Map(getReminders().map((reminder) => [reminder.id, reminder]));
  const nextIds = new Set(reminders.map((reminder) => reminder.id));

  for (const reminder of reminders.map(normalizeReminder)) {
    const payload = toReminderRow(reminder);
    if (existing.has(reminder.id)) {
      callElectronSync('db-sync:reminders:update', reminder.id, payload);
    } else {
      callElectronSync('db-sync:reminders:add', payload);
    }
  }

  for (const id of existing.keys()) {
    if (!nextIds.has(id)) {
      callElectronSync('db-sync:reminders:delete', id);
    }
  }

  emitDataChange(KEY);
}

export function getReminders(): Reminder[] {
  if (hasElectronIpc()) {
    const rows = readElectronSync<ReminderRow[]>('db-sync:reminders:get', []);
    return rows.map(normalizeReminder);
  }

  return loadLocalReminders();
}

export function saveReminders(reminders: Reminder[]): void {
  const normalized = reminders.map(normalizeReminder);

  if (hasElectronIpc()) {
    persistElectronReminders(normalized);
    return;
  }

  setStorageItem(KEY, normalized);
}

export function addReminder(data: Omit<Reminder, 'id' | 'createdAt'>): Reminder {
  const reminder = normalizeReminder({
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });

  if (hasElectronIpc()) {
    const saved = callElectronSync<ReminderRow>('db-sync:reminders:add', toReminderRow(reminder));
    emitDataChange(KEY);
    return normalizeReminder(saved ?? reminder);
  }

  saveReminders([...loadLocalReminders(), reminder]);
  return reminder;
}

export function updateReminder(id: string, data: Partial<Reminder>): void {
  if (hasElectronIpc()) {
    const current = getReminders().find((reminder) => reminder.id === id);
    const next = normalizeReminder({ ...(current ?? { id, title: '' }), ...data });
    callElectronSync('db-sync:reminders:update', id, toReminderRow(next));
    emitDataChange(KEY);
    return;
  }

  const next = loadLocalReminders().map((reminder) =>
    reminder.id === id ? normalizeReminder({ ...reminder, ...data }) : reminder,
  );
  setStorageItem(KEY, next);
}

export function deleteReminder(id: string): void {
  if (hasElectronIpc()) {
    callElectronSync('db-sync:reminders:delete', id);
    emitDataChange(KEY);
    return;
  }

  setStorageItem(KEY, loadLocalReminders().filter((reminder) => reminder.id !== id));
}

export function markReminderDone(id: string): void {
  updateReminder(id, { status: 'done', completedAt: new Date().toISOString() });
}

export function getTodayReminders(): Reminder[] {
  const today = new Date().toISOString().slice(0, 10);
  return getReminders().filter((reminder) => reminder.reminderDate === today && reminder.status === 'pending');
}

export function getPendingRemindersCount(): number {
  const today = new Date().toISOString().slice(0, 10);
  return getReminders().filter((reminder) => reminder.status === 'pending' && reminder.reminderDate <= today).length;
}

export function getOverdueReminders(): Reminder[] {
  const today = new Date().toISOString().slice(0, 10);
  return getReminders().filter((reminder) => reminder.status === 'pending' && reminder.reminderDate < today);
}
