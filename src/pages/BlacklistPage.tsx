import { useState, useMemo } from 'react';
import { ShieldAlert, Plus, X, Check, Search, Trash2, AlertTriangle } from 'lucide-react';
import { getBlacklist, addToBlacklist, updateBlacklistEntry, removeFromBlacklist, checkIMEI, REASON_LABELS, type BlacklistedDevice, type BlacklistReason } from '@/data/blacklistData';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const IC = 'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';

const emptyForm = { imei: '', deviceName: '', ownerName: '', ownerPhone: '', reason: 'stolen' as BlacklistReason, reportedDate: new Date().toISOString().slice(0, 10), status: 'active' as const, notes: '' };

export default function BlacklistPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [list, setList] = useState<BlacklistedDevice[]>(() => getBlacklist());
    const [search, setSearch] = useState('');
    const [quickCheck, setQuickCheck] = useState('');
    const [quickResult, setQuickResult] = useState<BlacklistedDevice | null | 'clean'>('clean');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);

    const refresh = () => setList(getBlacklist());

    const filtered = useMemo(() => list.filter(d =>
        d.imei.includes(search) || d.deviceName.toLowerCase().includes(search.toLowerCase()) || (d.ownerName ?? '').includes(search)
    ), [list, search]);

    const handleQuickCheck = () => {
        if (!quickCheck.trim()) return;
        const result = checkIMEI(quickCheck.trim());
        setQuickResult(result ?? 'clean');
    };

    const handleSubmit = () => {
        if (!form.imei.trim() || !form.deviceName.trim()) {
            toast({ title: 'خطأ', description: 'IMEI واسم الجهاز مطلوبان', variant: 'destructive' });
            return;
        }
        addToBlacklist({ ...form, createdBy: user?.fullName ?? 'system' });
        toast({ title: '✅ تمت الإضافة للقائمة السوداء', description: form.deviceName });
        setForm(emptyForm); setShowForm(false); refresh();
    };

    const resolveEntry = (id: string) => {
        updateBlacklistEntry(id, { status: 'resolved' });
        toast({ title: '✅ تم تحويل الجهاز لـ "تم الحل"' });
        refresh();
    };

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 border border-red-200">
                        <ShieldAlert className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">القائمة السوداء</h1>
                        <p className="text-xs text-muted-foreground">{list.filter(d => d.status === 'active').length} جهاز محظور</p>
                    </div>
                </div>
                <button onClick={() => { setForm(emptyForm); setShowForm(true); }}
                    className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-all shadow-sm">
                    <Plus className="h-4 w-4" /> إضافة جهاز
                </button>
            </div>

            {/* Quick IMEI Check */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 p-4 space-y-3">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-400">🔍 فحص IMEI سريع</p>
                <div className="flex gap-2">
                    <input value={quickCheck} onChange={e => setQuickCheck(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleQuickCheck()}
                        placeholder="أدخل رقم IMEI للفحص..." className={`${IC} flex-1`} />
                    <button onClick={handleQuickCheck}
                        className="rounded-xl bg-amber-500 text-white px-4 py-2.5 text-sm font-bold hover:bg-amber-600 transition-colors whitespace-nowrap">فحص</button>
                </div>
                {quickResult !== 'clean' && quickResult !== null && (
                    <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-900/20 p-3 flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                        <div>
                            <p className="font-bold text-red-700">⚠️ هذا الجهاز في القائمة السوداء!</p>
                            <p className="text-xs text-red-600">{quickResult.deviceName} • السبب: {REASON_LABELS[quickResult.reason]}</p>
                        </div>
                    </div>
                )}
                {quickResult === 'clean' && quickCheck.trim() && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 p-3">
                        <p className="text-sm font-bold text-emerald-700">✅ الجهاز سليم وغير محظور</p>
                    </div>
                )}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالـ IMEI أو اسم الجهاز..." className={`${IC} pr-9`} />
            </div>

            {/* List */}
            <div className="space-y-3">
                {filtered.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">لا توجد أجهزة في القائمة السوداء</div>
                ) : filtered.map(d => (
                    <div key={d.id} className={`rounded-2xl border bg-card p-4 space-y-2 ${d.status === 'active' ? 'border-red-200' : 'border-border opacity-60'}`}>
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-foreground">{d.deviceName}</p>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${d.status === 'active' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {d.status === 'active' ? '🔴 محظور' : '✅ تم الحل'}
                                    </span>
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">{REASON_LABELS[d.reason]}</span>
                                </div>
                                <p className="font-mono text-xs text-muted-foreground mt-1">IMEI: {d.imei}</p>
                                {(d.ownerName || d.ownerPhone) && (
                                    <p className="text-xs text-muted-foreground">{d.ownerName} {d.ownerPhone ? `• ${d.ownerPhone}` : ''}</p>
                                )}
                                <p className="text-xs text-muted-foreground">تاريخ البلاغ: {d.reportedDate}</p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                {d.status === 'active' && (
                                    <button onClick={() => resolveEntry(d.id)}
                                        className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors">
                                        حُل
                                    </button>
                                )}
                                <button onClick={() => { removeFromBlacklist(d.id); toast({ title: 'تم الحذف' }); refresh(); }}
                                    className="rounded-xl p-2 bg-red-50 hover:bg-red-100 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                        </div>
                        {d.notes && <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">{d.notes}</p>}
                    </div>
                ))}
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-6">
                    <div className="w-full max-w-md mx-4 rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">إضافة جهاز للقائمة السوداء</h2>
                            <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2"><label className="mb-1 block text-xs font-semibold text-muted-foreground">رقم IMEI *</label><input value={form.imei} onChange={e => setForm(f => ({ ...f, imei: e.target.value }))} placeholder="15 رقم" className={IC} /></div>
                            <div className="col-span-2"><label className="mb-1 block text-xs font-semibold text-muted-foreground">اسم الجهاز *</label><input value={form.deviceName} onChange={e => setForm(f => ({ ...f, deviceName: e.target.value }))} className={IC} /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">اسم المالك</label><input value={form.ownerName} onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))} className={IC} /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">هاتف المالك</label><input value={form.ownerPhone} onChange={e => setForm(f => ({ ...f, ownerPhone: e.target.value }))} className={IC} /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">السبب</label>
                                <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value as BlacklistReason }))} className={IC}>
                                    {Object.entries(REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">تاريخ البلاغ</label><input type="date" value={form.reportedDate} onChange={e => setForm(f => ({ ...f, reportedDate: e.target.value }))} className={IC} /></div>
                            <div className="col-span-2"><label className="mb-1 block text-xs font-semibold text-muted-foreground">ملاحظات</label><textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={`${IC} resize-none`} /></div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleSubmit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
                                <Check className="h-4 w-4" /> إضافة للقائمة
                            </button>
                            <button onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
