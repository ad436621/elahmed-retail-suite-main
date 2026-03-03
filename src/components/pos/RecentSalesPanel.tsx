// ============================================================
// ELAHMED RETAIL OS — Recent Sales Panel
// Sub-component extracted from POS.tsx for maintainability
// ============================================================

interface RecentSale {
    id: string;
    invoiceNumber: string;
    paymentMethod: string;
    date: string;
    total: number;
}

interface RecentSalesPanelProps {
    sales: RecentSale[];
}

const RecentSalesPanel = ({ sales }: RecentSalesPanelProps) => {
    if (sales.length === 0) return null;

    return (
        <div className="px-4 py-2 border-b border-border/20 bg-blue-500/5 animate-slide-down">
            <p className="text-[10px] font-bold text-blue-600 mb-1.5">آخر الفواتير</p>
            <div className="space-y-1 max-h-28 overflow-y-auto">
                {sales.map((s) => (
                    <div
                        key={s.id}
                        className="flex items-center justify-between rounded-lg bg-white/50 dark:bg-white/5 px-2 py-1"
                    >
                        <div>
                            <p className="text-[10px] font-bold text-card-foreground">
                                #{s.invoiceNumber}{' '}
                                <span className="text-muted-foreground font-normal">• {s.paymentMethod}</span>
                            </p>
                            <p className="text-[9px] text-muted-foreground">
                                {new Date(s.date).toLocaleDateString('ar-EG')}
                            </p>
                        </div>
                        <span className="text-[10px] font-bold text-primary">
                            {s.total?.toLocaleString('ar-EG')} EGP
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RecentSalesPanel;
