import { Search, Ban, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { getActiveSales, getAllSales, saveSale } from '@/repositories/saleRepository';
import { voidSale } from '@/services/saleService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ConfirmDialog';

const PAGE_SIZE = 20;

const paymentLabels: Record<string, string> = {
  cash: 'نقدي',
  card: 'بطاقة',
  installment: 'تقسيط',
  mixed: 'مختلط',
};

const Sales = () => {
  const { t } = useLanguage();
  const { user, isOwner } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showVoided, setShowVoided] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handleStorage = (e: StorageEvent | CustomEvent) => {
      const key = 'key' in e ? e.key : (e as CustomEvent).detail?.key;
      if (key && (key.startsWith('gx_') || key.startsWith('elahmed_'))) setRefreshKey(k => k + 1);
    };
    window.addEventListener('storage', handleStorage as EventListener);
    window.addEventListener('local-storage', handleStorage as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorage as EventListener);
      window.removeEventListener('local-storage', handleStorage as EventListener);
    };
  }, []);

  const allSales = useMemo(() => showVoided ? getAllSales() : getActiveSales(), [refreshKey, showVoided]);

  const filtered = useMemo(
    () => allSales.filter(s =>
      s.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.employee.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    [allSales, search]
  );

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  // Reset page when search changes
  useEffect(() => { setPage(1); }, [search, showVoided]);

  const [voidReason, setVoidReason] = useState('');
  const [showVoidDialog, setShowVoidDialog] = useState<{ saleId: string; invoiceNumber: string } | null>(null);

  const handleVoidConfirm = () => {
    if (!showVoidDialog || !voidReason.trim()) return;
    try {
      const sale = allSales.find(s => s.id === showVoidDialog.saleId);
      if (!sale) return;
      const { voidedSale } = voidSale(sale, voidReason.trim(), user?.id || 'admin');
      saveSale(voidedSale);
      setRefreshKey(k => k + 1);
      toast({ title: '✅ تم إلغاء الفاتورة', description: `${showVoidDialog.invoiceNumber} — ${voidReason}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      toast({ title: 'خطأ', description: msg, variant: 'destructive' });
    }
    setShowVoidDialog(null);
    setVoidReason('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">{t('sales.title')}</h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={showVoided} onChange={e => setShowVoided(e.target.checked)}
              className="rounded border-border" />
            عرض الملغية
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في الفواتير..."
            className="w-full rounded-lg border border-input bg-card ps-10 pe-4 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <p className="text-xs text-muted-foreground">{filtered.length} فاتورة</p>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden mb-8">
        <div className="overflow-x-auto pb-2">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('sales.invoice')}</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('sales.date')}</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('sales.items')}</th>
                <th className="px-4 py-3 text-end font-medium text-muted-foreground">{t('sales.amount')}</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">طريقة الدفع</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('sales.employee')}</th>
                {isOwner() && <th className="px-4 py-3 text-center font-medium text-muted-foreground">إجراءات</th>}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">لا توجد فواتير</td></tr>
              ) : paged.map(sale => (
                <tr key={sale.id} className={cn(
                  'border-b border-border last:border-0 hover:bg-muted/30 transition-colors',
                  sale.voidedAt && 'opacity-50 line-through'
                )}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">
                    {sale.invoiceNumber}
                    {sale.voidedAt && <span className="ms-2 text-[10px] text-destructive font-bold no-underline">(ملغية)</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(sale.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      {sale.items.map((item, i) => (
                        <p key={i} className="text-xs text-card-foreground">{item.qty}× {item.name}</p>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <p className="font-semibold text-card-foreground">{sale.total.toFixed(2)} ج.م</p>
                    <p className="text-xs text-chart-3">+{sale.grossProfit.toFixed(2)} ج.م</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-medium',
                      sale.paymentMethod === 'cash' ? 'bg-chart-3/10 text-chart-3' :
                        sale.paymentMethod === 'card' ? 'bg-primary/10 text-primary' :
                          'bg-warning/10 text-warning'
                    )}>
                      {paymentLabels[sale.paymentMethod] || sale.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{sale.employee}</td>
                  {isOwner() && (
                    <td className="px-4 py-3 text-center">
                      {!sale.voidedAt && (
                        <button onClick={() => { setShowVoidDialog({ saleId: sale.id, invoiceNumber: sale.invoiceNumber }); setVoidReason(''); }}
                          title="إلغاء الفاتورة"
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors">
              <ChevronRight className="h-3.5 w-3.5" /> السابق
            </button>
            <span className="text-xs text-muted-foreground">صفحة {page} من {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors">
              التالي <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Void Sale Dialog */}
      {showVoidDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/15">
                <Ban className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">إلغاء الفاتورة</h3>
                <p className="text-xs text-muted-foreground">{showVoidDialog.invoiceNumber}</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">سبب الإلغاء *</label>
              <input value={voidReason} onChange={e => setVoidReason(e.target.value)}
                placeholder="أدخل سبب إلغاء الفاتورة..."
                autoFocus
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleVoidConfirm} disabled={!voidReason.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 py-2.5 text-sm font-bold text-white transition-all">
                <Ban className="h-4 w-4" /> تأكيد الإلغاء
              </button>
              <button onClick={() => setShowVoidDialog(null)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
