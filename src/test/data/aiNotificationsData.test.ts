import { beforeEach, describe, expect, it } from 'vitest';
import {
    getAiNotifications,
    markAiNotificationRead,
    syncAiNotifications,
} from '@/data/aiNotificationsData';

beforeEach(() => {
    localStorage.clear();
    delete (window as typeof window & { electron?: unknown }).electron;
});

describe('aiNotificationsData', () => {
    it('preserves read state for the same fingerprint across refreshes', () => {
        const [first] = syncAiNotifications([
            {
                fingerprint: 'stock:screen-1',
                title: 'مخزون منخفض',
                details: 'Screen A',
                priority: 'high',
                recommendation: 'اطلب كمية جديدة',
                source: 'inventory',
            },
        ]);

        markAiNotificationRead(first.id);

        const [next] = syncAiNotifications([
            {
                fingerprint: 'stock:screen-1',
                title: 'مخزون منخفض',
                details: 'Screen A updated',
                priority: 'medium',
                recommendation: 'تابع المخزون',
                source: 'inventory',
            },
        ]);

        expect(next.id).toBe(first.id);
        expect(next.read).toBe(true);
        expect(getAiNotifications()[0].details).toBe('Screen A updated');
    });
});
