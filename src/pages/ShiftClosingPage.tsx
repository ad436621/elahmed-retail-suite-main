import { useState } from 'react';
import { ClipboardCheck, Check, X, AlertTriangle, TrendingUp } from 'lucide-react';
import { getShiftClosings, buildShiftSummary, addShiftClosing, type ShiftClosing } from '@/data/shiftData';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const IC = 'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';
const fmt = (n: number) => n.toLocaleString('ar-EG');

export default function ShiftClosingPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [closings, setClosings] = useState<ShiftClosing[]>(() => getShiftClosings());
    const [actualCash, setActualCash] = useState(0);
    const [notes, setNotes] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [previewSummary, setPreviewSummary] = useState<ReturnType<typeof buildShiftSummary> | null>(null);

    const refresh = () => setClosings(getShiftClosings());

    const handlePreview = () => {
        const summary = buildShiftSummary(user?.fullName ?? 'system', actualCash, notes);
        setPreviewSummary(summary);
        setShowConfirm(true);
    };

    const handleClose = () => {
        if (!previewSummary) return;
        addShiftClosing(previewSummary);
        toast({ title: '✅ تم إقفال الوردية بنجاح' });
        setActualCash(0); setNotes(''); setShowConfirm(false); setPreviewSummary(null);
        refresh();
    };

    // Build live preview from sales
    const livePreview = buildShiftSummary(user?.fullName ?? 'system', actualCash);
    const diff = actualCash - livePreview.expectedCash;
    const diffColor = diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-muted-foreground';

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 border border-rose-200">
                    <ClipboardCheck className="h-5 w-5 text-rose-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">إقفال الوردية</h1>
                    <p className="text-xs text-muted-foreground">{closings.length} إقفال سابق</p>
                </div>
            </div>

            {/* Current Shift Summary */}
            <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/10 dark:to-pink-900/10 p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <p className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-2"><TrendingUp className="h-4 w-4" /> ملخص الوردية الحالية</p>
                    <span className="text-xs text-rose-600">{new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'عدد الفواتير', value: String(livePreview.salesCount), color: 'text-foreground' },
                        { label: 'إجمالي المبيعات', value: `${fmt(livePreview.salesTotal)} ج.م`, color: 'text-emerald-600' },
                        { label: 'نقدي فقط', value: `${fmt(livePreview.salesCash)} ج.م`, color: 'text-blue-600' },
                        { label: 'الرصيد المتوقع', value: `${fmt(livePreview.expectedCash)} ج.م`, color: 'text-amber-600' },
                    ].map(stat => (
                        <div key={stat.label} className="rounded-xl border border-white/60 bg-white/70 dark:bg-white/5 p-3 text-center">
                            <p className="text-xs text-muted-foreground">{stat.label}</p>
                            <p className={`text-lg font-bold mt-0.5 ${stat.color}`}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Closing Form */}
                <div className="space-y-3 pt-2 border-t border-rose-200">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-rose-700">الرصيد الفعلي في الصندوق (ج.م)</label>
                        <input type="number" min={0} value={actualCash} onChange={e => setActualCash(+e.target.value)}
                            className={IC} />
                    </div>

                    {/* Difference */}
                    {actualCash > 0 && (
                        <div className={`rounded-xl border p-3 flex items-center justify-between ${diff > 0 ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10' : diff < 0 ? 'border-red-200 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 bg-gray-50'}`}>
                            <span className="text-sm font-semibold text-muted-foreground">
                                {diff > 0 ? '✅ فائض' : diff < 0 ? '⚠️ عجز' : '✓ مطابق'}
                            </span>
                            <span className={`text-xl font-extrabold ${diffColor}`}>{diff > 0 ? '+' : ''}{fmt(diff)} ج.م</span>
                        </div>
                    )}

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-rose-700">ملاحظات</label>
                        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="أي ملاحظات..." className={IC} />
                    </div>

                    <button onClick={handlePreview}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-sm font-bold text-white hover:bg-rose-700 transition-colors shadow-md">
                        <ClipboardCheck className="h-4 w-4" /> إقفال الوردية الآن
                    </button>
                </div>
            </div>

            {/* History Table */}
            {closings.length > 0 && (
                <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                {['التاريخ', 'فواتير', 'مبيعات', 'نقدي', 'متوقع', 'فعلي', 'الفرق', 'بواسطة'].map(h => (
                                    <th key={h} className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {[...closings].reverse().map((c, i) => {
                                const d = c.cashDifference;
                                return (
                                    <tr key={c.id} className={`border-b border-border/50 hover:bg-muted/20 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                                        <td className="px-3 py-2.5 text-xs">{c.shiftDate}</td>
                                        <td className="px-3 py-2.5 text-center text-xs font-semibold">{c.salesCount}</td>
                                        <td className="px-3 py-2.5 text-xs font-semibold text-emerald-600">{fmt(c.salesTotal)}</td>
                                        <td className="px-3 py-2.5 text-xs">{fmt(c.salesCash)}</td>
                                        <td className="px-3 py-2.5 text-xs text-amber-600">{fmt(c.expectedCash)}</td>
                                        <td className="px-3 py-2.5 text-xs font-bold text-foreground">{fmt(c.actualCash)}</td>
                                        <td className={`px-3 py-2.5 text-xs font-bold ${d > 0 ? 'text-emerald-600' : d < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                            {d > 0 ? '+' : ''}{fmt(d)}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{c.closedBy}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Confirm Dialog */}
            {showConfirm && previewSummary && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="w-full max-w-sm mx-4 rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">تأكيد الإقفال</h2>
                            <button onClick={() => setShowConfirm(false)} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">إجمالي المبيعات</span><span className="font-bold text-emerald-600">{fmt(previewSummary.salesTotal)} ج.م</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">الرصيد المتوقع</span><span className="font-bold">{fmt(previewSummary.expectedCash)} ج.م</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">الرصيد الفعلي</span><span className="font-bold">{fmt(previewSummary.actualCash)} ج.م</span></div>
                            <div className={`flex justify-between font-extrabold text-base ${previewSummary.cashDifference >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                <span>الفرق</span>
                                <span>{previewSummary.cashDifference >= 0 ? '+' : ''}{fmt(previewSummary.cashDifference)} ج.م</span>
                            </div>
                        </div>
                        {previewSummary.cashDifference < 0 && (
                            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                <AlertTriangle className="h-4 w-4 shrink-0" /> هناك عجز في الصندوق!
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button onClick={handleClose} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-500">
                                <Check className="h-4 w-4" /> تأكيد الإقفال
                            </button>
                            <button onClick={() => setShowConfirm(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
