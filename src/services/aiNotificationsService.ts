import { getRepairTickets, type RepairTicket } from '@/data/repairsData';
import { syncAiNotifications, type AiNotificationDraft } from '@/data/aiNotificationsData';
import { computerSparePartsDB, deviceSparePartsDB, mobileSparePartsDB } from '@/data/subInventoryData';
import { getActiveSales } from '@/repositories/saleRepository';

type SparePartSnapshot = {
    id: string;
    name: string;
    quantity: number;
    minStock: number;
    inventoryType: 'mobile_spare_part' | 'device_spare_part' | 'computer_spare_part';
};

function daysSince(dateValue?: string): number {
    if (!dateValue) return 0;
    const time = new Date(dateValue).getTime();
    if (!Number.isFinite(time)) return 0;
    return Math.floor((Date.now() - time) / (1000 * 60 * 60 * 24));
}

function normalizeName(value: string): string {
    return value.trim().toLowerCase();
}

function collectSpareParts(): SparePartSnapshot[] {
    return [
        ...mobileSparePartsDB.get().map((item) => ({ id: item.id, name: item.name, quantity: item.quantity, minStock: item.minStock || 0, inventoryType: 'mobile_spare_part' as const })),
        ...deviceSparePartsDB.get().map((item) => ({ id: item.id, name: item.name, quantity: item.quantity, minStock: item.minStock || 0, inventoryType: 'device_spare_part' as const })),
        ...computerSparePartsDB.get().map((item) => ({ id: item.id, name: item.name, quantity: item.quantity, minStock: item.minStock || 0, inventoryType: 'computer_spare_part' as const })),
    ];
}

function buildLowStockNotifications(parts: SparePartSnapshot[]): AiNotificationDraft[] {
    return parts
        .filter((part) => part.quantity <= Math.max(1, part.minStock))
        .sort((left, right) => left.quantity - right.quantity)
        .slice(0, 5)
        .map((part) => ({
            fingerprint: `stock:${part.id}`,
            title: part.quantity === 0 ? `نفاد ${part.name}` : `مخزون منخفض: ${part.name}`,
            details: `الكمية الحالية ${part.quantity} والحد الأدنى ${Math.max(1, part.minStock)}.`,
            priority: part.quantity === 0 ? 'high' : 'medium',
            recommendation: 'أعد الطلب أو انقل كمية من فرع آخر قبل تسجيل عمليات صيانة جديدة.',
            source: 'inventory',
        }));
}

function buildRepairNotifications(tickets: RepairTicket[]): AiNotificationDraft[] {
    const openTickets = tickets.filter((ticket) => ['received', 'diagnosing', 'repairing', 'waiting_parts', 'testing', 'pending', 'in_progress', 'waiting_for_parts'].includes(ticket.status));
    const staleTickets = openTickets.filter((ticket) => daysSince(ticket.updatedAt || ticket.createdAt) >= 3);
    const readyToDeliver = tickets.filter((ticket) => ['ready', 'completed'].includes(ticket.status) && daysSince(ticket.updatedAt || ticket.createdAt) >= 2);
    const drafts: AiNotificationDraft[] = [];

    if (staleTickets.length > 0) {
        const oldest = staleTickets.sort((left, right) => daysSince(right.updatedAt || right.createdAt) - daysSince(left.updatedAt || left.createdAt)).slice(0, 3);
        drafts.push({
            fingerprint: 'repairs:stale',
            title: `أوامر صيانة متأخرة (${staleTickets.length})`,
            details: oldest.map((ticket) => `${ticket.ticket_no} - ${ticket.customer_name}`).join(' | '),
            priority: staleTickets.some((ticket) => daysSince(ticket.updatedAt || ticket.createdAt) >= 7) ? 'high' : 'medium',
            recommendation: 'راجع التذاكر المتوقفة وحدد سبب التعطيل أو حدّث العميل بحالة الطلب.',
            source: 'maintenance',
        });
    }

    if (readyToDeliver.length > 0) {
        drafts.push({
            fingerprint: 'repairs:ready',
            title: `طلبات جاهزة ولم تُسلَّم (${readyToDeliver.length})`,
            details: readyToDeliver.slice(0, 3).map((ticket) => `${ticket.ticket_no} - ${ticket.customer_name}`).join(' | '),
            priority: 'medium',
            recommendation: 'تواصل مع العملاء الجاهزين للاستلام لتحويل العمل المفتوح إلى دخل محصل.',
            source: 'maintenance',
        });
    }

    return drafts;
}

function buildDemandNotifications(parts: SparePartSnapshot[]): AiNotificationDraft[] {
    const sales = getActiveSales().filter((sale) => daysSince(sale.date) <= 30);
    const soldByName = new Map<string, number>();

    for (const sale of sales) {
        for (const item of sale.items) {
            const key = normalizeName(item.name);
            soldByName.set(key, (soldByName.get(key) || 0) + Number(item.qty || 0));
        }
    }

    const risky = parts
        .map((part) => ({ part, soldQty: soldByName.get(normalizeName(part.name)) || 0 }))
        .filter(({ soldQty, part }) => soldQty >= 2 && part.quantity <= soldQty + Math.max(1, part.minStock))
        .sort((left, right) => right.soldQty - left.soldQty)
        .slice(0, 3);

    if (risky.length === 0) return [];

    return [{
        fingerprint: 'sales:demand-forecast',
        title: 'توقع طلب مرتفع على قطع غيار',
        details: risky.map(({ part, soldQty }) => `${part.name} (${soldQty} مبيعاً / متاح ${part.quantity})`).join(' | '),
        priority: 'medium',
        recommendation: 'ارفع توريد القطع الأعلى حركة قبل نفادها من مخزون الصيانة.',
        source: 'sales',
    }];
}

function buildOptimizationNotifications(parts: SparePartSnapshot[]): AiNotificationDraft[] {
    const sales = getActiveSales().filter((sale) => daysSince(sale.date) <= 45);
    const soldNames = new Set(sales.flatMap((sale) => sale.items.map((item) => normalizeName(item.name))));
    const slowParts = parts
        .filter((part) => !soldNames.has(normalizeName(part.name)) && part.quantity >= Math.max(10, part.minStock * 4))
        .sort((left, right) => right.quantity - left.quantity)
        .slice(0, 3);

    if (slowParts.length === 0) return [];

    return [{
        fingerprint: 'inventory:slow-moving',
        title: 'فرصة لتحسين المخزون',
        details: slowParts.map((part) => `${part.name} (${part.quantity} قطعة)`).join(' | '),
        priority: 'low',
        recommendation: 'أعد تسعير القطع البطيئة أو انقل جزءاً منها لتقليل رأس المال المجمد.',
        source: 'optimization',
    }];
}

export async function runAiNotificationsAnalysis(): Promise<void> {
    const [tickets] = await Promise.all([getRepairTickets()]);
    const parts = collectSpareParts();

    const drafts = [
        ...buildLowStockNotifications(parts),
        ...buildRepairNotifications(tickets),
        ...buildDemandNotifications(parts),
        ...buildOptimizationNotifications(parts),
    ];

    syncAiNotifications(drafts);
}
