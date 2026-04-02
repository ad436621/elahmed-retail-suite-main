// ============================================================
// DiagnosticsPage — نظام تشخيص الأخطاء التلقائي
// Scans all data sources and reports issues with fix buttons
// ============================================================
import { useState, useMemo, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, XCircle, RefreshCw, Wrench, Database, TrendingDown, Package, CreditCard, Activity, Info, Shield, Zap } from 'lucide-react';
import { getAllSales } from '@/repositories/saleRepository';
import { getDamagedItems } from '@/data/damagedData';
import { getContracts } from '@/data/installmentsData';
import { getMaintenanceOrders } from '@/data/maintenanceData';
import { getExpenses } from '@/data/expensesData';
import { getMobiles } from '@/data/mobilesData';
import { getComputers } from '@/data/computersData';
import { getDevices } from '@/data/devicesData';
import { getPurchaseInvoices } from '@/data/purchaseInvoicesData';
import { getSuppliers } from '@/data/suppliersData';
import { getCustomers } from '@/data/customersData';
import { getBlacklist } from '@/data/blacklistData';
import { getEmployees } from '@/data/employeesData';

type Severity = 'error' | 'warning' | 'info' | 'ok';

interface DiagnosticIssue {
    id: string;
    title: string;
    description: string;
    severity: Severity;
    count?: number;
    fixable?: boolean;
    onFix?: () => void;
    details?: string[];
}

const SeverityConfig: Record<Severity, { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
    error: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/30', label: 'خطأ حرج' },
    warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/30', label: 'تحذير' },
    info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/30', label: 'معلومة' },
    ok: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/30', label: 'سليم' },
};

function IssueCard({ issue, onFix }: { issue: DiagnosticIssue; onFix?: () => void }) {
    const cfg = SeverityConfig[issue.severity];
    const Icon = cfg.icon;
    const [expanded, setExpanded] = useState(false);

    return (
        <div className={`rounded-2xl border p-4 space-y-3 transition-all ${cfg.bg} ${cfg.border}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                    <div className={`mt-0.5 shrink-0 ${cfg.color}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={`font-bold text-sm ${cfg.color}`}>{issue.title}</h3>
                            {issue.count !== undefined && issue.count > 0 && (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.color} bg-white/50 dark:bg-black/20`}>{issue.count}</span>
                            )}
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${cfg.color} ${cfg.border} bg-white/50 dark:bg-black/20`}>{cfg.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{issue.description}</p>
                    </div>
                </div>
                <div className="flex gap-2 shrink-0">
                    {issue.details && issue.details.length > 0 && (
                        <button onClick={() => setExpanded(e => !e)} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                            {expanded ? 'إخفاء' : 'تفاصيل'}
                        </button>
                    )}
                    {issue.fixable && onFix && (
                        <button onClick={onFix} className="flex items-center gap-1 rounded-lg bg-white/70 dark:bg-white/10 border border-current px-3 py-1.5 text-xs font-bold transition-all hover:bg-white/90 dark:hover:bg-white/20">
                            <Wrench className="h-3.5 w-3.5" /> إصلاح
                        </button>
                    )}
                </div>
            </div>
            {expanded && issue.details && (
                <div className="rounded-xl bg-white/40 dark:bg-black/20 border border-white/30 p-3 space-y-1">
                    {issue.details.slice(0, 10).map((d, i) => (
                        <p key={i} className="text-xs text-foreground font-mono">{d}</p>
                    ))}
                    {issue.details.length > 10 && (
                        <p className="text-xs text-muted-foreground">... و {issue.details.length - 10} أخرى</p>
                    )}
                </div>
            )}
        </div>
    );
}

export default function DiagnosticsPage() {
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const handleStorage = (e: StorageEvent | CustomEvent) => {
            const key = 'key' in e ? e.key : (e as CustomEvent).detail?.key;
            if (key && (key.startsWith('gx_') || key.startsWith('elahmed_'))) {
                setRefreshKey((current) => current + 1);
            }
        };

        window.addEventListener('storage', handleStorage as EventListener);
        window.addEventListener('local-storage', handleStorage as EventListener);
        return () => {
            window.removeEventListener('storage', handleStorage as EventListener);
            window.removeEventListener('local-storage', handleStorage as EventListener);
        };
    }, []);

    const issues = useMemo((): DiagnosticIssue[] => {
        const result: DiagnosticIssue[] = [];
        const today = new Date().toISOString().slice(0, 10);

        // ── 1. Sales with negative profit ──
        const allSales = getAllSales().filter(s => !s.voidedAt);
        const negativeProfitSales = allSales.filter(s => (s.grossProfit ?? 0) < -10);
        if (negativeProfitSales.length > 0) {
            result.push({
                id: 'neg_profit_sales',
                severity: 'error',
                title: 'مبيعات بربح سالب',
                description: `${negativeProfitSales.length} فاتورة بيع تُظهر ربحاً سالباً — قد يكون بيانات FIFO تالفة أو سعر بيع أقل من التكلفة.`,
                count: negativeProfitSales.length,
                details: negativeProfitSales.slice(0, 20).map(s => `${s.invoiceNumber} | ربح: ${s.grossProfit?.toFixed(0)} ج.م | إجمالي: ${s.total.toFixed(0)} ج.م`),
            });
        } else {
            result.push({ id: 'neg_profit_ok', severity: 'ok', title: 'أرباح المبيعات سليمة', description: 'لا توجد مبيعات بربح سالب غير مبرر.' });
        }

        // ── 2. Voided sales still affecting financial reports ──
        const voidedSales = getAllSales().filter(s => s.voidedAt);
        if (voidedSales.length > 0) {
            result.push({
                id: 'voided_sales',
                severity: 'info',
                title: 'مبيعات ملغاة مسجلة',
                description: `${voidedSales.length} فاتورة ملغاة. الإلغاء تاريخي ويُستثنى من حسابات الربح في لوحة التحكم.`,
                count: voidedSales.length,
            });
        }

        // ── 3. Overdue installment contracts ──
        const contracts = getContracts();
        const overdueContracts = contracts.filter(c => {
            if (c.status === 'completed') return false;
            return c.schedule.some(s => !s.paid && s.dueDate < today);
        });
        if (overdueContracts.length > 0) {
            result.push({
                id: 'overdue_contracts',
                severity: 'error',
                title: 'عقود أجل متأخرة',
                description: `${overdueContracts.length} عقد بأقساط متأخرة عن موعدها.`,
                count: overdueContracts.length,
                details: overdueContracts.map(c => {
                    const overdueMonths = c.schedule.filter(s => !s.paid && s.dueDate < today);
                    return `${c.contractNumber} | ${c.customerName} | متأخر: ${overdueMonths.length} قسط`;
                }),
            });
        } else if (contracts.length > 0) {
            result.push({ id: 'contracts_ok', severity: 'ok', title: 'عقود الأجل منتظمة', description: 'لا توجد أقساط متأخرة.' });
        }

        // ── 4. Negative stock in mobiles ──
        const allInventory = [
            ...getMobiles().map(m => ({ name: m.name, qty: m.quantity || 0, type: 'موبايل' })),
            ...getComputers().map(c => ({ name: c.name, qty: c.quantity || 0, type: 'كمبيوتر' })),
            ...getDevices().map(d => ({ name: d.name, qty: d.quantity || 0, type: 'جهاز' })),
        ];
        const negativeStock = allInventory.filter(i => i.qty < 0);
        const zeroStock = allInventory.filter(i => i.qty === 0);
        if (negativeStock.length > 0) {
            result.push({
                id: 'neg_stock',
                severity: 'error',
                title: 'مخزون بكميات سالبة',
                description: `${negativeStock.length} منتج بكمية سالبة — خطأ حسابي في المخزون.`,
                count: negativeStock.length,
                details: negativeStock.map(i => `${i.type}: ${i.name} | ${i.qty} قطعة`),
            });
        } else {
            result.push({ id: 'stock_ok', severity: 'ok', title: 'المخزون بدون كميات سالبة', description: 'لا يوجد مخزون بأرقام سالبة.' });
        }
        if (zeroStock.length > 3) {
            result.push({
                id: 'zero_stock',
                severity: 'warning',
                title: 'منتجات نفد مخزونها',
                description: `${zeroStock.length} منتج بكمية صفر.`,
                count: zeroStock.length,
                details: zeroStock.map(i => `${i.type}: ${i.name}`),
            });
        }

        // ── 5. Maintenance orders with negative profit ──
        const maintenanceOrders = getMaintenanceOrders();
        const negMaintProfit = maintenanceOrders.filter(m => m.netProfit < -5);
        if (negMaintProfit.length > 0) {
            result.push({
                id: 'neg_maint_profit',
                severity: 'warning',
                title: 'طلبات صيانة بربح سالب',
                description: `${negMaintProfit.length} طلب صيانة تكلفة القطع فيه أعلى من سعر البيع.`,
                count: negMaintProfit.length,
                details: negMaintProfit.map(m => `${m.orderNumber} | ${m.customerName} | ربح: ${m.netProfit.toFixed(0)} ج.م`),
            });
        }

        // ── 6. Expenses with zero amount ──
        const expenses = getExpenses();
        const zeroExpenses = expenses.filter(e => e.amount <= 0);
        if (zeroExpenses.length > 0) {
            result.push({
                id: 'zero_expenses',
                severity: 'warning',
                title: 'مصاريف بمبلغ صفر',
                description: `${zeroExpenses.length} سجل مصاريف بمبلغ غير صحيح (صفر أو سالب).`,
                count: zeroExpenses.length,
            });
        }

        // ── 7. localStorage usage ──
        let totalBytes = 0;
        const largeKeys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i) ?? '';
            const val = localStorage.getItem(key) ?? '';
            const size = val.length * 2; // UTF-16 approximation
            totalBytes += size;
            if (size > 500_000) largeKeys.push(`${key}: ${(size / 1024).toFixed(0)} KB`);
        }
        const totalKB = Math.round(totalBytes / 1024);
        const limitKB = 5120; // 5MB typical limit
        const usagePct = Math.round((totalKB / limitKB) * 100);
        if (usagePct >= 80) {
            result.push({
                id: 'storage_critical',
                severity: 'error',
                title: `تحذير: مساحة التخزين ${usagePct}%`,
                description: `${totalKB} KB من ${limitKB} KB. خطر امتلاء localStorage — انتبه وقم بنسخ احتياطي ثم حذف البيانات القديمة.`,
                details: largeKeys,
            });
        } else if (usagePct >= 50) {
            result.push({
                id: 'storage_high',
                severity: 'warning',
                title: `استخدام التخزين ${usagePct}%`,
                description: `${totalKB} KB من ${limitKB} KB. الاستخدام مرتفع. يُنصح بعمل نسخة احتياطية.`,
                details: largeKeys,
            });
        } else {
            result.push({
                id: 'storage_ok',
                severity: 'ok',
                title: `مساحة التخزين سليمة (${usagePct}%)`,
                description: `${totalKB} KB من أصل ${limitKB} KB مستخدمة.`,
            });
        }

        // ── 8. Damaged items cross-check ──
        const damaged = getDamagedItems();
        const negDamaged = damaged.filter(d => d.totalLoss < 0);
        if (negDamaged.length > 0) {
            result.push({
                id: 'neg_damaged',
                severity: 'warning',
                title: 'عناصر تالفة بخسارة سالبة',
                description: `${negDamaged.length} سجل عناصر تالفة بقيمة خسارة سالبة.`,
                count: negDamaged.length,
                details: negDamaged.map(d => `${d.productName} | خسارة: ${d.totalLoss.toFixed(0)}`),
            });
        }

        // ── 9. Purchase invoices with unpaid amounts ──
        const purchaseInvoices = getPurchaseInvoices();
        const unpaidInvoices = purchaseInvoices.filter(inv => 
            inv.status !== 'paid' && inv.status !== 'confirmed' && (inv.remaining ?? 0) > 0
        );
        if (unpaidInvoices.length > 0) {
            result.push({
                id: 'unpaid_invoices',
                severity: 'warning',
                title: 'فواتير شراء غير مدفوعة',
                description: `${unpaidInvoices.length} فاتورة شراء بها باقي مبلغ.`,
                count: unpaidInvoices.length,
                details: unpaidInvoices.slice(0, 10).map(inv => 
                    `${inv.invoiceNumber} | ${inv.supplierName} | باقي: ${(inv.remaining ?? 0).toFixed(0)} ج.م`
                ),
            });
        }

        // ── 10. Suppliers with overdue payments ──
        const suppliers = getSuppliers();
        const suppliersWithDebt = suppliers.filter(s => (s.balance ?? 0) < -1000);
        if (suppliersWithDebt.length > 0) {
            result.push({
                id: 'supplier_debts',
                severity: 'warning',
                title: 'موردين دائنين',
                description: `${suppliersWithDebt.length} مورد له رصيد سالب (مستحق لهم).`,
                count: suppliersWithDebt.length,
                details: suppliersWithDebt.slice(0, 10).map(s => 
                    `${s.name} | مستحق: ${Math.abs(s.balance ?? 0).toFixed(0)} ج.م`
                ),
            });
        }

        // ── 11. Customers with duplicate phone ──
        const customers = getCustomers();
        const phoneMap = new Map<string, string[]>();
        customers.forEach(c => {
            if (c.phone) {
                const existing = phoneMap.get(c.phone) || [];
                existing.push(c.name);
                phoneMap.set(c.phone, existing);
            }
        });
        const duplicatePhones = [...phoneMap.entries()].filter(([_, names]) => names.length > 1);
        if (duplicatePhones.length > 0) {
            result.push({
                id: 'duplicate_phones',
                severity: 'info',
                title: 'عملاء برقم هاتف مكرر',
                description: `${duplicatePhones.length} رقم هاتف مستخدم من أكثر من عميل.`,
                count: duplicatePhones.length,
                details: duplicatePhones.slice(0, 10).map(([phone, names]) => 
                    `${phone} → ${names.join(', ')}`
                ),
            });
        }

        // ── 12. Blacklist items without IMEI ──
        const blacklist = getBlacklist();
        const invalidBlacklist = blacklist.filter(b => !b.imei || b.imei.length < 15);
        if (invalidBlacklist.length > 0) {
            result.push({
                id: 'invalid_blacklist',
                severity: 'warning',
                title: 'قائمة سوداء ب IMEI غير صالح',
                description: `${invalidBlacklist.length} سجل في القائمة السوداء بدون IMEI صحيح.`,
                count: invalidBlacklist.length,
                details: invalidBlacklist.slice(0, 10).map(b => `${b.name || 'غير محدد'} | IMEI: ${b.imei || 'فارغ'}`),
            });
        }

        // ── 13. Employees with missing salary ──
        const employees = getEmployees();
        const noSalaryEmployees = employees.filter(e => !e.salary || e.salary <= 0);
        if (noSalaryEmployees.length > 0 && employees.length > 0) {
            result.push({
                id: 'no_salary_employees',
                severity: 'warning',
                title: 'موظفين بدون راتب',
                description: `${noSalaryEmployees.length} موظف بدون راتب محدد.`,
                count: noSalaryEmployees.length,
                details: noSalaryEmployees.slice(0, 10).map(e => e.name),
            });
        }

        // ── 14. Returns validation ──
        const returns = getAllSales().filter(s => s.items?.some(i => i.lineDiscount > 0 && i.qty > 0));
        const suspiciousReturns = returns.filter(s => {
            // Check if return amount is suspiciously high (> 50% of sale)
            const totalDiscount = s.items?.reduce((sum, i) => sum + (i.lineDiscount || 0), 0) || 0;
            return totalDiscount > s.total * 0.5;
        });
        if (suspiciousReturns.length > 0) {
            result.push({
                id: 'suspicious_returns',
                severity: 'info',
                title: 'إرجاعات بخصم كبير',
                description: `${suspiciousReturns.length} فاتورة خصم فيها أكثر من 50%.`,
                count: suspiciousReturns.length,
            });
        }

        // ── 15. Inventory cost vs sale price validation ──
        const allProducts = [
            ...getMobiles(),
            ...getComputers(),
            ...getDevices(),
        ];
        const underpricedProducts = allProducts.filter(p => 
            (p.sellingPrice ?? 0) < (p.costPrice ?? 0)
        );
        if (underpricedProducts.length > 0) {
            result.push({
                id: 'underpriced_products',
                severity: 'error',
                title: 'منتجات بسعر بيع أقل من التكلفة',
                description: `${underpricedProducts.length} منتج بسعر بيع أقل من سعر التكلفة.`,
                count: underpricedProducts.length,
                details: underpricedProducts.slice(0, 10).map(p => 
                    `${p.name} | تكلفة: ${p.costPrice} | بيع: ${p.sellingPrice}`
                ),
            });
        }

        // ── 16. Batch inventory sync check ──
        const productsWithBatches = allProducts.filter(p => p.quantity > 0).slice(0, 50);
        // This would require checking batch data - simplified check
        const totalProductQty = allProducts.reduce((sum, p) => sum + (p.quantity || 0), 0);
        if (totalProductQty === 0 && allProducts.length > 0) {
            result.push({
                id: 'empty_inventory',
                severity: 'warning',
                title: 'المخزون فارغ',
                description: 'لا توجد منتجات في المخزون.',
            });
        }

        // ── 17. Check for old data (more than 2 years) ──
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        const oldSales = allSales.filter(s => new Date(s.date) < twoYearsAgo);
        if (oldSales.length > 100) {
            result.push({
                id: 'old_sales_data',
                severity: 'info',
                title: 'بيانات مبيعات قديمة',
                description: `${oldSales.length} فاتورة أقدم من سنتين. يُنصح بالأرشفة.`,
                count: oldSales.length,
            });
        }

        return result;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshKey]);

    // ── Health score ──
    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    const oks = issues.filter(i => i.severity === 'ok').length;
    const total = issues.length;
    const score = total > 0 ? Math.round(((oks + warnings * 0.5) / total) * 100) : 100;
    const scoreColor = score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600';
    const scoreLabel = score >= 80 ? 'ممتاز' : score >= 60 ? 'يحتاج مراجعة' : 'يحتاج إصلاح عاجل';

    const categories = [
        { label: 'أخطاء حرجة', count: errors, color: 'text-red-600', icon: XCircle },
        { label: 'تحذيرات', count: warnings, color: 'text-amber-600', icon: AlertTriangle },
        { label: 'سليم', count: oks, color: 'text-emerald-600', icon: CheckCircle2 },
    ];

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                        <Activity className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">تشخيص النظام</h1>
                        <p className="text-xs text-muted-foreground">{total} فحص • آخر تحديث: الآن</p>
                    </div>
                </div>
                <button
                    onClick={() => setRefreshKey(k => k + 1)}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
                >
                    <RefreshCw className="h-4 w-4" /> فحص الآن
                </button>
            </div>

            {/* Health Score Strip */}
            <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-6 flex-wrap">
                    <div className="text-center">
                        <p className={`text-5xl font-black tabular-nums ${score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{score}</p>
                        <p className={`text-xs font-bold mt-1 ${scoreColor}`}>{scoreLabel}</p>
                        <p className="text-[10px] text-muted-foreground">نقاط الصحة</p>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <div className="h-3 rounded-full bg-muted overflow-hidden mb-3">
                            <div className={`h-full rounded-full transition-all duration-1000 ${score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${score}%` }} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {categories.map(cat => {
                                const Icon = cat.icon;
                                return (
                                    <div key={cat.label} className="text-center rounded-xl bg-muted/30 p-2">
                                        <Icon className={`h-4 w-4 mx-auto mb-1 ${cat.color}`} />
                                        <p className={`text-lg font-black ${cat.color}`}>{cat.count}</p>
                                        <p className="text-[10px] text-muted-foreground">{cat.label}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2"><Database className="h-3.5 w-3.5" /><span>تم فحص: المبيعات، المخزون، التقسيط، الصيانة، المصاريف</span></div>
                        <div className="flex items-center gap-2"><Shield className="h-3.5 w-3.5" /><span>الأخطاء الحسابية والبيانات التالفة</span></div>
                        <div className="flex items-center gap-2"><Zap className="h-3.5 w-3.5" /><span>استخدام التخزين المحلي</span></div>
                    </div>
                </div>
            </div>

            {/* Issues by severity */}
            {(['error', 'warning', 'ok', 'info'] as Severity[]).map(severity => {
                const severityIssues = issues.filter(i => i.severity === severity);
                if (severityIssues.length === 0) return null;
                const cfg = SeverityConfig[severity];
                const HeaderIcon = cfg.icon;
                return (
                    <div key={severity}>
                        <div className={`flex items-center gap-2 mb-3 text-sm font-bold ${cfg.color}`}>
                            <HeaderIcon className="h-4 w-4" />
                            <span>{severity === 'error' ? 'أخطاء حرجة' : severity === 'warning' ? 'تحذيرات' : severity === 'ok' ? 'فحوصات ناجحة' : 'معلومات'}</span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground font-semibold">{severityIssues.length}</span>
                        </div>
                        <div className="space-y-3">
                            {severityIssues.map(issue => (
                                <IssueCard key={issue.id} issue={issue} />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
