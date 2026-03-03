import { useState } from 'react';
import { Plus, Trash2, X, Check, TrendingDown } from 'lucide-react';
import { Expense, ExpenseCategory } from '@/domain/types';
import { getExpenses, addExpense, deleteExpense, getExpenseCategoryLabel } from '@/data/expensesData';
import { useToast } from '@/hooks/use-toast';

const emptyForm = {
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: 0,
    category: 'other' as ExpenseCategory,
    addedBy: '',
};

const categoryOptions: Array<{ value: ExpenseCategory; label: string }> = [
    { value: 'rent', label: 'إيجار' },
    { value: 'utilities', label: 'مرافق (كهرباء/مياه)' },
    { value: 'salaries', label: 'رواتب' },
    { value: 'supplies', label: 'مستلزمات' },
    { value: 'maintenance', label: 'صيانة' },
    { value: 'transport', label: 'مواصلات' },
    { value: 'other', label: 'أخرى' },
];

const categoryColors: Record<ExpenseCategory, string> = {
    rent: 'bg-purple-500/10 text-purple-500',
    utilities: 'bg-blue-500/10 text-blue-500',
    salaries: 'bg-amber-500/10 text-amber-500',
    supplies: 'bg-teal-500/10 text-teal-500',
    maintenance: 'bg-orange-500/10 text-orange-500',
    transport: 'bg-cyan-500/10 text-cyan-500',
    other: 'bg-muted text-muted-foreground',
};

export default function Expenses() {
    const { toast } = useToast();
    const [expenses, setExpenses] = useState<Expense[]>(() => getExpenses());
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [filterMonth, setFilterMonth] = useState<string>('');
    const [filterCat, setFilterCat] = useState<string>('');
    const [search, setSearch] = useState('');

    const refresh = () => setExpenses(getExpenses());

    const handleSubmit = () => {
        if (!form.description.trim() || form.amount <= 0) {
            toast({ title: 'خطأ', description: 'الوصف والمبلغ مطلوبان', variant: 'destructive' });
            return;
        }
        addExpense(form);
        toast({ title: 'تمت الإضافة', description: `${form.description} — ${form.amount.toLocaleString()} ج.م` });
        setForm(emptyForm);
        setShowForm(false);
        refresh();
    };

    const filtered = expenses
        .filter(e => !filterMonth || e.date.startsWith(filterMonth))
        .filter(e => !filterCat || e.category === filterCat)
        .filter(e => !search || e.description.toLowerCase().includes(search.toLowerCase()));

    const totalFiltered = filtered.reduce((sum, e) => sum + e.amount, 0);

    const inputClass = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20">
                        <TrendingDown className="h-5 w-5 text-rose-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">المصروفات</h1>
                        <p className="text-sm text-muted-foreground">{expenses.length} قيد</p>
                    </div>
                </div>
                <button onClick={() => { setShowForm(true); setForm(emptyForm); }}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                    <Plus className="h-4 w-4" /> إضافة مصروف
                </button>
            </div>

            {/* Summary Card */}
            <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground mb-1">إجمالي المصروفات {filterMonth ? `(${filterMonth})` : '(الكل)'}</p>
                        <p className="text-3xl font-black text-primary">{totalFiltered.toLocaleString()} <span className="text-lg font-semibold text-muted-foreground">ج.م</span></p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-muted-foreground">عدد القيود</p>
                        <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="بحث في الوصف..."
                    className={inputClass}
                />
                <input
                    type="month"
                    value={filterMonth}
                    onChange={e => setFilterMonth(e.target.value)}
                    className={inputClass}
                />
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className={inputClass}>
                    <option value="">كل الفئات</option>
                    {categoryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            </div>

            {/* Form */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in mx-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">إضافة مصروف</h2>
                            <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 hover:bg-muted transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">الوصف *</label>
                                <input data-validation="text-only" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="مثال: إيجار الشهر" className={inputClass} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-muted-foreground">المبلغ (ج.م) *</label>
                                    <input type="number" min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))} className={inputClass} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-muted-foreground">التاريخ</label>
                                    <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputClass} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-muted-foreground">الفئة</label>
                                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))} className={inputClass}>
                                        {categoryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-muted-foreground">أضيف بواسطة</label>
                                    <input data-validation="text-only" value={form.addedBy} onChange={e => setForm(f => ({ ...f, addedBy: e.target.value }))} placeholder="اختياري" className={inputClass} />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={handleSubmit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all">
                                <Check className="h-4 w-4" /> إضافة
                            </button>
                            <button onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft">
                <div className="overflow-x-auto pb-4">
                    <table className="w-full text-sm min-w-[600px]">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">التاريخ</th>
                                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">الوصف</th>
                                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">الفئة</th>
                                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">المبلغ</th>
                                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">بواسطة</th>
                                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">حذف</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">لا توجد مصروفات</td></tr>
                            ) : filtered.sort((a, b) => b.date.localeCompare(a.date)).map((e, i) => (
                                <tr key={e.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{e.date}</td>
                                    <td className="px-4 py-3 font-medium text-foreground">{e.description}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${categoryColors[e.category]}`}>
                                            {getExpenseCategoryLabel(e.category)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center font-semibold text-rose-500">{e.amount.toLocaleString()} ج.م</td>
                                    <td className="px-4 py-3 text-center text-muted-foreground text-xs">{e.addedBy || '—'}</td>
                                    <td className="px-4 py-3 text-center">
                                        <button onClick={() => { deleteExpense(e.id); refresh(); toast({ title: 'تم الحذف' }); }}
                                            className="rounded-lg p-1.5 hover:bg-destructive/10 text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {filtered.length > 0 && (
                            <tfoot>
                                <tr className="border-t border-border bg-muted/30">
                                    <td colSpan={3} className="px-4 py-3 text-right font-semibold text-foreground">الإجمالي</td>
                                    <td className="px-4 py-3 text-center font-black text-primary text-base">{totalFiltered.toLocaleString()} ج.م</td>
                                    <td colSpan={2} />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
