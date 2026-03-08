// ============================================================
// BestSellers — Best-selling products ranking
// Extracted from Dashboard.tsx for maintainability
// ============================================================

interface BestSellerItem {
    name: string;
    count: number;
    revenue: number;
    category: string;
}

interface BestSellersProps {
    items: BestSellerItem[];
}

const fmt = (n: number) =>
    n >= 1_000_000
        ? (n / 1_000_000).toLocaleString('ar-EG', { maximumFractionDigits: 1 }) + ' م'
        : n >= 1_000
            ? (n / 1_000).toLocaleString('ar-EG', { maximumFractionDigits: 1 }) + ' ك'
            : n.toLocaleString('ar-EG');

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const MEDAL_COLORS: Record<number, string> = {
    1: 'text-yellow-500',
    2: 'text-slate-400',
    3: 'text-amber-600',
};

export function BestSellers({ items }: BestSellersProps) {
    if (items.length === 0) {
        return (
            <div className="py-8 text-center text-sm text-muted-foreground">
                لا توجد مبيعات بعد
            </div>
        );
    }

    return (
        <div role="list" aria-label="أكثر المنتجات مبيعاً">
            {items.map((item, i) => {
                const rank = i + 1;
                return (
                    <div
                        key={i}
                        role="listitem"
                        className="flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                        <span
                            className={`text-lg font-black tabular-nums w-5 text-center shrink-0 ${MEDAL_COLORS[rank] ?? 'text-muted-foreground/40'}`}
                            aria-label={`المرتبة ${rank}`}
                        >
                            {rank <= 3 ? MEDALS[rank] : rank}
                        </span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground font-medium">
                                {item.category} • {item.count} وحدة
                            </p>
                        </div>
                        <span className="text-sm font-bold text-foreground tabular-nums shrink-0">
                            {fmt(item.revenue)} ج.م
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
