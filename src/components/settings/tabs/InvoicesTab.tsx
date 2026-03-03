// ── Invoices Tab ─────────────────────────────────────────────
import { useState } from 'react';
import { Hash, Receipt, Save, RotateCcw } from 'lucide-react';
import SectionCard from '@/components/settings/SectionCard';
import ToggleRow from '@/components/settings/ToggleRow';
import { useToast } from '@/hooks/use-toast';
import { STORAGE_KEYS } from '@/config';

interface InvoiceNumbering { prefix: string; padding: number; }
interface InvoiceSettings {
    sales: InvoiceNumbering; expense: InvoiceNumbering; repair: InvoiceNumbering;
    return_: InvoiceNumbering; purchase: InvoiceNumbering;
    showDate: boolean; showInvoiceNo: boolean; showClientDetails: boolean; showPaymentMethod: boolean;
    footerMessage: string;
}

const defaultInvoiceSettings: InvoiceSettings = {
    sales: { prefix: 'ACC-', padding: 6 }, expense: { prefix: 'EXP-', padding: 6 },
    repair: { prefix: 'REP-', padding: 6 }, return_: { prefix: 'RET-', padding: 6 },
    purchase: { prefix: 'PUR-', padding: 6 },
    showDate: true, showInvoiceNo: true, showClientDetails: true, showPaymentMethod: true,
    footerMessage: 'شكراً لتعاملكم معنا',
};

const INVOICE_ROWS = [
    { key: 'sales' as const, label: 'مبيعات الإكسسوارات', typeLabel: 'sales_accessory' },
    { key: 'expense' as const, label: 'مصروفات', typeLabel: 'expense' },
    { key: 'repair' as const, label: 'إصلاحات', typeLabel: 'maintenance' },
    { key: 'return_' as const, label: 'مرتجعات', typeLabel: 'return' },
    { key: 'purchase' as const, label: 'مشتريات', typeLabel: 'purchase' },
];

const IC = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/60";

export default function InvoicesTab() {
    const { toast } = useToast();

    const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(() => {
        try {
            return { ...defaultInvoiceSettings, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.INVOICE_SETTINGS) || '{}') };
        } catch { return defaultInvoiceSettings; }
    });

    const saveInvoiceSettings = () => {
        localStorage.setItem(STORAGE_KEYS.INVOICE_SETTINGS, JSON.stringify(invoiceSettings));
        toast({ title: '✅ تم حفظ إعدادات الفواتير' });
    };

    return (
        <>
            {/* Invoice Numbering */}
            <SectionCard icon={<Hash className="h-5 w-5" />} title="إعدادات أرقام الفواتير"
                desc="تخصيص Prefix وPadding لكل نوع فاتورة"
                color="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400">
                <div className="space-y-4">
                    {INVOICE_ROWS.map(inv => (
                        <div key={inv.key} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-foreground">{inv.label}</p>
                                    <p className="text-[10px] text-muted-foreground">النوع: {inv.typeLabel} • آخر رقم: 0</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">Prefix (البادئة)</label>
                                    <input value={invoiceSettings[inv.key].prefix}
                                        onChange={e => setInvoiceSettings(s => ({ ...s, [inv.key]: { ...s[inv.key], prefix: e.target.value } }))}
                                        className={`${IC} text-center font-mono`} dir="ltr" />
                                </div>
                                <div>
                                    <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">Padding (عدد الأرقام)</label>
                                    <input type="number" min={1} max={10} value={invoiceSettings[inv.key].padding}
                                        onChange={e => setInvoiceSettings(s => ({ ...s, [inv.key]: { ...s[inv.key], padding: +e.target.value } }))}
                                        className={`${IC} text-center font-mono`} dir="ltr" />
                                </div>
                            </div>
                            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-left">
                                <p className="text-[10px] text-muted-foreground">رقم فاتورة أخير</p>
                                <p className="text-sm font-black text-emerald-700 dark:text-emerald-400 font-mono">
                                    {invoiceSettings[inv.key].prefix}{'0'.repeat(Math.max(0, invoiceSettings[inv.key].padding - 1))}1
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-border py-2 text-xs font-bold text-muted-foreground hover:bg-muted transition-colors">
                                    <RotateCcw className="h-3 w-3" /> إعادة تعيين
                                </button>
                                <button onClick={saveInvoiceSettings}
                                    className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-emerald-600 text-white py-2 text-xs font-bold hover:bg-emerald-700 transition-all">
                                    <Save className="h-3 w-3" /> حفظ
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* Invoice Template */}
            <SectionCard icon={<Receipt className="h-5 w-5" />} title="إعدادات قالب الفاتورة"
                desc="تخصيص شكل الفاتورة المطبوعة"
                color="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                <div className="space-y-4">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">رسالة نهاية الفاتورة</label>
                        <input data-validation="text-only" value={invoiceSettings.footerMessage}
                            onChange={e => setInvoiceSettings(s => ({ ...s, footerMessage: e.target.value }))}
                            placeholder="شكراً لتعاملكم معنا" className={IC} />
                        <p className="text-[9px] text-muted-foreground mt-1">نص يظهر أسفل كل فاتورة مطبوعة</p>
                    </div>
                    <ToggleRow value={invoiceSettings.showDate}
                        onChange={v => setInvoiceSettings(s => ({ ...s, showDate: v }))}
                        label="إظهار تاريخ الفاتورة" desc="عرض التاريخ/الميلادي أسفل الشعار" />
                    <ToggleRow value={invoiceSettings.showInvoiceNo}
                        onChange={v => setInvoiceSettings(s => ({ ...s, showInvoiceNo: v }))}
                        label="إظهار رقم الفاتورة" desc="إظهار رقم الفاتورة على الفاتورة" />
                    <ToggleRow value={invoiceSettings.showClientDetails}
                        onChange={v => setInvoiceSettings(s => ({ ...s, showClientDetails: v }))}
                        label="إظهار تفاصيل العميل" desc="عرض بيانات (رقم هاتف العميل)" />
                    <ToggleRow value={invoiceSettings.showPaymentMethod}
                        onChange={v => setInvoiceSettings(s => ({ ...s, showPaymentMethod: v }))}
                        label="إظهار طريقة الدفع" desc="عرض طريقة الدفع على الفاتورة" />

                    {/* Preview */}
                    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                        <p className="text-xs font-bold text-muted-foreground">معاينة أرقام الفواتير</p>
                        {INVOICE_ROWS.map(({ key, label }) => (
                            <div key={key} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2">
                                <span className="text-xs text-muted-foreground">{label}</span>
                                <span className="text-xs font-black font-mono text-foreground">
                                    {invoiceSettings[key].prefix}{'0'.repeat(Math.max(0, invoiceSettings[key].padding - 1))}1
                                </span>
                            </div>
                        ))}
                    </div>

                    <button onClick={saveInvoiceSettings}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-3 text-sm font-bold hover:bg-emerald-700 transition-all shadow-md">
                        <Save className="h-4 w-4" /> حفظ إعدادات قالب الفاتورة
                    </button>
                </div>
            </SectionCard>
        </>
    );
}
