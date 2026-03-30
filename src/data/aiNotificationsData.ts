import { STORAGE_KEYS } from '@/config';
import { emitDataChange } from '@/lib/electronDataBridge';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';

export type AiNotificationPriority = 'high' | 'medium' | 'low';

export interface AiNotification {
    id: string;
    fingerprint: string;
    title: string;
    details: string;
    priority: AiNotificationPriority;
    recommendation: string;
    source: 'inventory' | 'maintenance' | 'sales' | 'optimization' | 'system';
    read: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AiNotificationDraft {
    fingerprint: string;
    title: string;
    details: string;
    priority: AiNotificationPriority;
    recommendation: string;
    source: AiNotification['source'];
}

interface AiNotificationsMeta {
    lastRunAt?: string;
}

const NOTIFICATIONS_KEY = STORAGE_KEYS.AI_NOTIFICATIONS;
const META_KEY = STORAGE_KEYS.AI_NOTIFICATIONS_META;

function normalizeNotification(item: Partial<AiNotification>): AiNotification {
    const now = new Date().toISOString();
    return {
        id: String(item.id ?? crypto.randomUUID()),
        fingerprint: String(item.fingerprint ?? crypto.randomUUID()),
        title: String(item.title ?? '').trim(),
        details: String(item.details ?? '').trim(),
        priority: (item.priority ?? 'medium') as AiNotificationPriority,
        recommendation: String(item.recommendation ?? '').trim(),
        source: (item.source ?? 'system') as AiNotification['source'],
        read: Boolean(item.read),
        createdAt: String(item.createdAt ?? now),
        updatedAt: String(item.updatedAt ?? now),
    };
}

function sortNotifications(items: AiNotification[]): AiNotification[] {
    return [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getAiNotifications(): AiNotification[] {
  const saved = getStorageItem<AiNotification[]>(NOTIFICATIONS_KEY, []);
  return sortNotifications((Array.isArray(saved) ? saved : []).map(normalizeNotification));
}

export function getAiNotificationsMeta(): AiNotificationsMeta {
    return getStorageItem<AiNotificationsMeta>(META_KEY, {});
}

function saveNotifications(items: AiNotification[]): AiNotification[] {
    const sorted = sortNotifications(items.map(normalizeNotification));
    setStorageItem(NOTIFICATIONS_KEY, sorted);
    emitDataChange(NOTIFICATIONS_KEY);
    return sorted;
}

function saveMeta(meta: AiNotificationsMeta): void {
    setStorageItem(META_KEY, meta);
    emitDataChange(META_KEY);
}

export function syncAiNotifications(drafts: AiNotificationDraft[]): AiNotification[] {
    const existing = getAiNotifications();
    const now = new Date().toISOString();

    const next = drafts.map((draft) => {
        const previous = existing.find((item) => item.fingerprint === draft.fingerprint);
        return normalizeNotification({
            id: previous?.id ?? crypto.randomUUID(),
            fingerprint: draft.fingerprint,
            title: draft.title,
            details: draft.details,
            priority: draft.priority,
            recommendation: draft.recommendation,
            source: draft.source,
            read: previous?.read ?? false,
            createdAt: previous?.createdAt ?? now,
            updatedAt: now,
        });
    });

    saveMeta({ lastRunAt: now });
    return saveNotifications(next.slice(0, 20));
}

export function markAiNotificationRead(id: string): void {
    saveNotifications(
        getAiNotifications().map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
}

export function markAllAiNotificationsRead(): void {
    saveNotifications(getAiNotifications().map((item) => ({ ...item, read: true })));
}
