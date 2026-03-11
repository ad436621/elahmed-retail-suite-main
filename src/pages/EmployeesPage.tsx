// ============================================================
// Employees Page — Employee management + salary tracking
// ============================================================

import { useState, useMemo } from 'react';
import {
    Users, Plus, Pencil, Trash2, X, Save, DollarSign,
    TrendingDown, Award, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
    getEmployees, addEmployee, updateEmployee, deleteEmployee,
    getSalaryRecords, paySalary, addAdvance, getPendingAdvancesTotal,
    hasBeenPaidThisMonth, type Employee,
} from '@/data/employeesData';
import { useConfirm } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';

const fmt = (n: number) => n.toLocaleString('ar-EG');
const POSITIONS = ['كاشير', 'تقني', 'مدير', 'محاسب', 'مندوب مبيعات', 'موظف'];
const currentMonth = () => new Date().toISOString().slice(0, 7);

// ─── Employee Modal ──────────────────────────────────────────

function EmployeeModal({ emp, onClose, onDone }: { emp?: Employee; onClose: () => void; onDone: () => void }) {
    const isEdit = !!emp;
    const [form, setForm] = useState({
        name: emp?.name ?? '',
        phone: emp?.phone ?? '',
        position: emp?.position ?? POSITIONS[0],
        baseSalary: emp?.baseSalary?.toString() ?? '',
        hireDate: emp?.hireDate ?? new Date().toISOString().slice(0, 10),
        isActive: emp?.isActive ?? true,
        notes: emp?.notes ?? '',
    });
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { setError('الاسم مطلوب'); return; }
        if (!form.baseSalary || parseFloat(form.baseSalary) <= 0) { setError('أدخل الراتب الأساسي'); return; }
        const data = { ...form, baseSalary: parseFloat(form.baseSalary) };
        if (isEdit && emp) updateEmployee(emp.id, data);
        else addEmployee(data);
        onDone();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-md bg-card rounded-3xl border border-border shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50 sticky top-0 bg-card z-10">
                    <h2 className="text-lg font-extrabold">{isEdit ? 'تعديل موظف' : 'إضافة موظف جديد'}</h2>
                    <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground transition-colors"><X className="h-4 w-4" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && <p className="text-sm text-destructive font-medium">{error}</p>}

                    <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1.5">الاسم *</label>
                        <input data-validation="text-only" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="اسم الموظف"
                            className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1.5">الهاتف</label>
                            <input data-validation="phone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="01xxxxxxxxx"
                                className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1.5">الوظيفة</label>
                            <select value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))}
                                className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                                {POSITIONS.map(pos => <option key={pos}>{pos}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1.5">الراتب الأساسي *</label>
                            <input value={form.baseSalary} onChange={e => setForm(p => ({ ...p, baseSalary: e.target.value }))} type="number" min="0" placeholder="0"
                                className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1.5">تاريخ التعيين</label>
                            <input value={form.hireDate} onChange={e => setForm(p => ({ ...p, hireDate: e.target.value }))} type="date"
                                className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button type="submit"
                            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors">
                            <Save className="h-4 w-4" /> {isEdit ? 'حفظ' : 'إضافة'}
                        </button>
                        <button type="button" onClick={onClose}
                            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">إلغاء</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Pay Salary Modal ────────────────────────────────────────

function SalaryModal({ emp, onClose, onDone }: { emp: Employee; onClose: () => void; onDone: () => void }) {
    const month = currentMonth();
    const pendingAdv = useMemo(() => getPendingAdvancesTotal(emp.id), [emp.id]);
    const [bonus, setBonus] = useState('0');
    const [deduction, setDeduction] = useState('0');
    const [advDeducted, setAdvDeducted] = useState(pendingAdv.toString());
    const [notes, setNotes] = useState('');

    const net = Math.max(0, emp.baseSalary + (parseFloat(bonus) || 0) - (parseFloat(deduction) || 0) - (parseFloat(advDeducted) || 0));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        paySalary({ employee: emp, month, bonus: parseFloat(bonus) || 0, deduction: parseFloat(deduction) || 0, advanceDeducted: parseFloat(advDeducted) || 0, notes });
        onDone();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-sm bg-card rounded-3xl border border-border shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50">
                    <h2 className="text-base font-extrabold">صرف راتب — {emp.name}</h2>
                    <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="rounded-xl bg-muted/40 p-3 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">الراتب الأساسي</span><span className="font-bold">{fmt(emp.baseSalary)} ج.م</span></div>
                        {pendingAdv > 0 && <div className="flex justify-between mt-1.5"><span className="text-muted-foreground">سلف معلقة</span><span className="font-bold text-amber-600">{fmt(pendingAdv)} ج.م</span></div>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'مكافأة (+)', val: bonus, set: setBonus },
                            { label: 'خصم (-)', val: deduction, set: setDeduction },
                        ].map(({ label, val, set }) => (
                            <div key={label}>
                                <label className="block text-xs font-bold text-muted-foreground mb-1.5">{label}</label>
                                <input value={val} onChange={e => set(e.target.value)} type="number" min="0"
                                    className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                            </div>
                        ))}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1.5">خصم السلفة</label>
                        <input value={advDeducted} onChange={e => setAdvDeducted(e.target.value)} type="number" min="0" max={pendingAdv}
                            className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>

                    <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 flex justify-between items-center">
                        <span className="text-sm font-bold text-foreground">صافي الراتب</span>
                        <span className="text-xl font-black text-primary tabular-nums">{fmt(net)} ج.م</span>
                    </div>

                    <div className="flex gap-2">
                        <button type="submit"
                            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors">
                            <DollarSign className="h-4 w-4" /> تأكيد الصرف
                        </button>
                        <button type="button" onClick={onClose}
                            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors">إلغاء</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────

export default function EmployeesPage() {
    const [employees, setEmployees] = useState(getEmployees);
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState<Employee | undefined>();
    const [salaryTarget, setSalaryTarget] = useState<Employee | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const { confirm } = useConfirm();
    const { toast } = useToast();

    const refresh = () => setEmployees(getEmployees());

    const [advanceTarget, setAdvanceTarget] = useState<Employee | null>(null);
    const [advanceAmount, setAdvanceAmount] = useState(0);

    const handleAdvance = (emp: Employee) => {
        setAdvanceTarget(emp);
        setAdvanceAmount(0);
    };

    const submitAdvance = () => {
        if (!advanceTarget || advanceAmount <= 0) return;
        addAdvance({ employeeId: advanceTarget.id, employeeName: advanceTarget.name, amount: advanceAmount, date: new Date().toISOString(), notes: '' });
        toast({ title: '✅ تم تسجيل السلفة', description: `${advanceTarget.name} — ${fmt(advanceAmount)} ج.م` });
        setAdvanceTarget(null);
        setAdvanceAmount(0);
        refresh();
    };

    const handleDelete = async (emp: Employee) => {
        const ok = await confirm({ title: 'حذف موظف', message: `هل أنت متأكد من حذف الموظف "${emp.name}"؟`, confirmLabel: 'حذف', danger: true });
        if (ok) { deleteEmployee(emp.id); refresh(); }
    };
    const month = currentMonth();
    const paidIds = useMemo(() => new Set(employees.filter(e => hasBeenPaidThisMonth(e.id, month)).map(e => e.id)), [employees, month]);

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
                        <Users className="h-6 w-6 text-primary" /> الموظفين والرواتب
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {employees.filter(e => e.isActive).length} موظف نشط •
                        إجمالي الرواتب: {fmt(employees.reduce((s, e) => s + e.baseSalary, 0))} ج.م
                    </p>
                </div>
                <button onClick={() => { setEditTarget(undefined); setShowModal(true); }}
                    className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg">
                    <Plus className="h-4 w-4" /> إضافة موظف
                </button>
            </div>

            {employees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Users className="h-16 w-16 opacity-20 mb-4" />
                    <p className="text-lg font-bold">لا يوجد موظفين</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {employees.map(emp => {
                        const isPaid = paidIds.has(emp.id);
                        const records = getSalaryRecords(emp.id).slice(-3).reverse();
                        const isExpanded = expandedId === emp.id;

                        return (
                            <div key={emp.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                                <div className="flex items-center gap-4 p-4">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary font-black text-lg shrink-0">
                                        {emp.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-extrabold text-foreground">{emp.name}</p>
                                            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-medium">{emp.position}</span>
                                            {isPaid && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">✓ مصروف</span>}
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-0.5">
                                            راتب: <span className="font-bold text-foreground">{fmt(emp.baseSalary)} ج.م</span>
                                            {emp.phone && <span className="mr-3 text-xs">{emp.phone}</span>}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {!isPaid && (
                                            <button onClick={() => setSalaryTarget(emp)}
                                                className="flex items-center gap-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 text-xs font-bold hover:bg-primary/20 transition-colors">
                                                <DollarSign className="h-3.5 w-3.5" /> صرف راتب
                                            </button>
                                        )}
                                        <button onClick={() => handleAdvance(emp)}
                                            title="سلفة" className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-600 transition-colors">
                                            <TrendingDown className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => { setEditTarget(emp); setShowModal(true); }}
                                            className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted transition-colors">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => handleDelete(emp)}
                                            className="rounded-xl border border-border p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                                            className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted transition-colors">
                                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && records.length > 0 && (
                                    <div className="border-t border-border/40 px-4 pb-4">
                                        <p className="text-xs font-bold text-muted-foreground mt-3 mb-2">آخر الرواتب</p>
                                        <div className="space-y-2">
                                            {records.map(r => (
                                                <div key={r.id} className="flex justify-between items-center text-xs p-2 rounded-lg bg-muted/40">
                                                    <span className="text-muted-foreground">{r.month}</span>
                                                    <span className="font-bold text-foreground">{fmt(r.netSalary)} ج.م</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {showModal && <EmployeeModal emp={editTarget} onClose={() => setShowModal(false)} onDone={refresh} />}
            {salaryTarget && <SalaryModal emp={salaryTarget} onClose={() => setSalaryTarget(null)} onDone={refresh} />}

            {/* Advance Dialog */}
            {advanceTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setAdvanceTarget(null)}>
                    <div className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/50">
                            <h3 className="font-bold text-foreground">💰 تسجيل سلفة</h3>
                            <button onClick={() => setAdvanceTarget(null)} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-muted-foreground">أدخل مبلغ السلفة للموظف <strong className="text-foreground">{advanceTarget.name}</strong></p>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">المبلغ (ج.م)</label>
                                <input type="number" min={1} autoFocus value={advanceAmount || ''} onChange={e => setAdvanceAmount(+e.target.value)}
                                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                                    placeholder="مثال: 500"
                                    onKeyDown={e => { if (e.key === 'Enter' && advanceAmount > 0) submitAdvance(); }}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={submitAdvance} disabled={advanceAmount <= 0}
                                    className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                                    تسجيل السلفة
                                </button>
                                <button onClick={() => setAdvanceTarget(null)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">إلغاء</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
