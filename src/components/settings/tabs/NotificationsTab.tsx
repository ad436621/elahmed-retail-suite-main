// ── Notifications Tab ─────────────────────────────────────────
import { useState } from 'react';
import { Bell } from 'lucide-react';
import SectionCard from '@/components/settings/SectionCard';
import ToggleRow from '@/components/settings/ToggleRow';
import { useToast } from '@/hooks/use-toast';
import { STORAGE_KEYS } from '@/config';

const NOTIF_KEY = STORAGE_KEYS.NOTIFICATIONS_SETTINGS;

interface NotifSettings {
    enabled: boolean;
    sounds: boolean;
    reminders: boolean;
    salesAlerts: boolean;
    inventoryAlerts: boolean;
}

const defaultNotifs: NotifSettings = {
    enabled: true, sounds: true, reminders: true, salesAlerts: true, inventoryAlerts: true
};

export default function NotificationsTab() {
    const { toast } = useToast();

    const [notifSettings, setNotifSettings] = useState<NotifSettings>(() => {
        try { return { ...defaultNotifs, ...JSON.parse(localStorage.getItem(NOTIF_KEY) || '{}') }; }
        catch { return defaultNotifs; }
    });

    const saveNotifs = (s: NotifSettings) => {
        setNotifSettings(s);
        localStorage.setItem(NOTIF_KEY, JSON.stringify(s));
        toast({ title: '✅ تم حفظ إعدادات الإشعارات' });
    };

    return (
        <SectionCard icon={<Bell className="h-5 w-5" />} title="إعدادات الإشعارات"
            desc="التحكم في التنبيهات"
            color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <div className="space-y-3">
                <ToggleRow value={notifSettings.enabled}
                    onChange={v => saveNotifs({ ...notifSettings, enabled: v })}
                    label="تفعيل الإشعارات" desc="إيقاف وإعادة تشغيل الإخطارات" />
                <ToggleRow value={notifSettings.sounds}
                    onChange={v => saveNotifs({ ...notifSettings, sounds: v })}
                    label="الأصوات" desc="تشغيل أصوت للتنبيهات" />
                <ToggleRow value={notifSettings.reminders}
                    onChange={v => saveNotifs({ ...notifSettings, reminders: v })}
                    label="تنبيهات التذكيرات" desc="إشعارات الفواتير والتذكيرات" />
                <ToggleRow value={notifSettings.salesAlerts}
                    onChange={v => saveNotifs({ ...notifSettings, salesAlerts: v })}
                    label="تنبيهات المبيعات" desc="إخبارك عند إتمام عمليات بيع" />
                <ToggleRow value={notifSettings.inventoryAlerts}
                    onChange={v => saveNotifs({ ...notifSettings, inventoryAlerts: v })}
                    label="تنبيهات المخزون" desc="ينبهك لتقريب نفاد المخزون" />
            </div>
        </SectionCard>
    );
}
