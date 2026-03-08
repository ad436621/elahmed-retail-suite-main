// ============================================================
// SalesCharts — Weekly bar chart + 6-month monthly trend
// Extracted from Dashboard.tsx for maintainability
// ============================================================

interface DayData {
    day: string;
    rev: number;
    count: number;
}

interface MonthData {
    label: string;
    rev: number;
    profit: number;
    count: number;
}

interface SalesChartsProps {
    weeklyData: DayData[];
    monthlyTrend: MonthData[];
}

const fmt = (n: number) =>
    n >= 1_000_000
        ? (n / 1_000_000).toLocaleString('ar-EG', { maximumFractionDigits: 1 }) + ' م'
        : n >= 1_000
            ? (n / 1_000).toLocaleString('ar-EG', { maximumFractionDigits: 1 }) + ' ك'
            : n.toLocaleString('ar-EG');

// ── Weekly bar chart ──────────────────────────────────────────
export function WeeklyBarChart({ data }: { data: DayData[] }) {
    const max = Math.max(...data.map(d => d.rev), 1);

    return (
        <div className="space-y-3" aria-label="مبيعات آخر 7 أيام" role="img">
            <div className="flex items-end gap-1.5 h-36 w-full">
                {data.map((d, i) => {
                    const barH = Math.max(4, (d.rev / max) * 120);
                    const isToday = i === 6;
                    const hasData = d.rev > 0;
                    return (
                        <div key={i} className="flex flex-col items-center gap-1 flex-1 group relative min-w-0">
                            {/* Hover tooltip */}
                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 hidden group-hover:flex
                bg-foreground text-background text-[10px] font-bold px-2.5 py-1.5 rounded-lg
                whitespace-nowrap shadow-xl z-20 flex-col items-center leading-snug pointer-events-none"
                                role="tooltip"
                            >
                                <span>{fmt(d.rev)} ج.م</span>
                                <span className="text-background/60 text-[9px]">{d.count} فاتورة</span>
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-foreground rotate-45" aria-hidden="true" />
                            </div>

                            {/* Bar */}
                            <div className="w-full flex items-end justify-center" style={{ height: '120px' }}>
                                <div
                                    className={`w-full rounded-t-lg transition-all duration-700 relative overflow-hidden
                    ${isToday
                                            ? 'bg-primary shadow-[0_0_12px_rgba(var(--primary-rgb,99,102,241),0.4)]'
                                            : hasData
                                                ? 'bg-primary/25 group-hover:bg-primary/50'
                                                : 'bg-muted/40 border border-dashed border-border/60'
                                        }`}
                                    style={{ height: `${barH}px` }}
                                    aria-label={`${d.day}: ${fmt(d.rev)} جنيه`}
                                >
                                    {isToday && hasData && (
                                        <div className="absolute inset-0 bg-white/10 animate-pulse" aria-hidden="true" />
                                    )}
                                </div>
                            </div>

                            {/* Day label */}
                            <div className="h-14 flex items-start justify-center mt-1">
                                <span
                                    className={`text-[10px] font-semibold whitespace-nowrap origin-top-right
                    ${isToday ? 'text-primary' : 'text-muted-foreground'}`}
                                    style={{ transform: 'rotate(-45deg)', display: 'inline-block', marginTop: '4px' }}
                                >
                                    {d.day}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Summary row */}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/30 pt-2">
                <span>📊 آخر 7 أيام</span>
                <span className="font-bold text-foreground tabular-nums">
                    {fmt(data.reduce((s, d) => s + d.rev, 0))} ج.م
                </span>
            </div>
        </div>
    );
}

// ── Monthly trend bar chart ────────────────────────────────────
export function MonthlyTrendChart({ data }: { data: MonthData[] }) {
    const maxRev = Math.max(...data.map(m => m.rev), 1);

    return (
        <div aria-label="إيرادات آخر 6 أشهر" role="img">
            <div className="flex items-end gap-2 h-32">
                {data.map((m, i) => {
                    const isCurrentMonth = i === data.length - 1;
                    const barH = Math.max(4, (m.rev / maxRev) * 100);
                    return (
                        <div key={i} className="flex flex-col items-center gap-1 flex-1 group relative min-w-0">
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-foreground text-background text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap z-20 flex-col items-center"
                                role="tooltip"
                            >
                                <span>{fmt(m.rev)} ج.م</span>
                                <span className="opacity-60">{m.count} فاتورة</span>
                            </div>
                            <div className="w-full flex items-end" style={{ height: '100px' }}>
                                <div
                                    className={`w-full rounded-t-lg transition-all duration-700 ${isCurrentMonth ? 'bg-primary' : m.rev > 0 ? 'bg-primary/30 group-hover:bg-primary/50' : 'bg-muted/50'}`}
                                    style={{ height: `${barH}px` }}
                                    aria-label={`${m.label}: ${fmt(m.rev)} جنيه`}
                                />
                            </div>
                            <span className={`text-[9px] font-semibold ${isCurrentMonth ? 'text-primary' : 'text-muted-foreground'}`}>
                                {m.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="mt-3 pt-3 border-t border-border/30 flex justify-between text-xs">
                <span className="text-muted-foreground">
                    أعلى شهر:{' '}
                    <span className="font-bold text-foreground">
                        {data.reduce((b, m) => m.rev > b.rev ? m : b, data[0])?.label ?? '—'}
                    </span>
                </span>
                <span className="font-bold text-foreground tabular-nums">
                    {fmt(data.reduce((s, m) => s + m.rev, 0))} ج.م إجمالي
                </span>
            </div>
        </div>
    );
}
