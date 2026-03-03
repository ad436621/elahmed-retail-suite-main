import { useState, useMemo } from 'react';
import { Bell, Plus, X, Check, Trash2, Clock, AlertTriangle, Filter } from 'lucide-react';
import {
    getReminders, addReminder, updateReminder, deleteReminder, markReminderDone,
    getOverdueReminders, CATEGORY_LABELS, PRIORITY_LABELS,
    type Reminder, type ReminderCategory, type ReminderPriority, type ReminderStatus,
} from '@/data/remindersData';

const IC = 'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';
const today = new Date().toISOString().slice(0, 10);
const thisWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

const PRIORITY_COLORS: Record<ReminderPriority, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-gray-100 text-gray-600',
};

const emptyForm = {
    title: '', description: '', reminderDate: today, reminderTime: '',
    category: 'general' as ReminderCategory, priority: 'medium' as ReminderPriority,
    status: 'pending' as ReminderStatus, notes: '',
};

export default function RemindersPage() {
    const [reminders, setReminders] = useState<Reminder[]>(() => getReminders());
    const [statusFilter, setStatusFilter] = useState<ReminderStatus | 'all'>('all');
    const [catFilter, setCatFilter] = useState<ReminderCategory | 'all'>('all');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);

    const refresh = () => setReminders(getReminders());

    const overdue = getOverdueReminders();
    const todayReminders = reminders.filter(r => r.reminderDate === today && r.status === 'pending').length;
    const weekReminders = reminders.filter(r => r.status === 'pending' && r.reminderDate > today && r.reminderDate <= thisWeek).length;

    const filtered = useMemo(() => reminders
        .filter(r => statusFilter === 'all' || r.status === statusFilter)
        .filter(r => catFilter === 'all' || r.category === catFilter)
        .sort((a, b) => a.reminderDate.localeCompare(b.reminderDate)),
        [reminders, statusFilter, catFilter]);

    const handleSubmit = () => {
        if (!form.title.trim()) return;
        addReminder(form);
        setForm(emptyForm); setShowForm(false); refresh();
    };

    const isOverdue = (r: Reminder) => r.status === 'pending' && r.reminderDate < today;

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100 border border-cyan-200">
                        <Bell className="h-5 w-5 text-cyan-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">التذكيرات</h1>
                        <p className="text-xs text-muted-foreground">
                            {overdue.length > 0 && <span className="text-red-600 font-bold">{overdue.length} متأخر • </span>}
                            {todayReminders} اليوم
                        </p>
                    </div>
                </div>
                <button onClick={() => { setForm(emptyForm); setShowForm(true); }}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm">
                    <Plus className="h-4 w-4" /> إضافة تذكير
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-900/10 p-4 text-center">
                    <p className="text-xs text-red-600">متأخر وعاجل</p>
                    <p className="text-2xl font-bold text-red-700 mt-1">{overdue.length}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 p-4 text-center">
                    <p className="text-xs text-amber-600">اليوم</p>
                    <p className="text-2xl font-bold text-amber-700 mt-1">{todayReminders}</p>
                </div>
                <div className="rounded-2xl border border-blue-200 bg-blue-50 dark:bg-blue-900/10 p-4 text-center">
                    <p className="text-xs text-blue-600">هذا الأسبوع</p>
                    <p className="text-2xl font-bold text-blue-700 mt-1">{weekReminders}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <div className="flex rounded-xl overflow-hidden border border-border bg-card">
                    {(['all', 'pending', 'done', 'dismissed'] as const).map(s => (
                        <button key={s} onClick={() => setStatusFilter(s)}
                            className={`px-3 py-2 text-xs font-semibold transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}>
                            {s === 'all' ? 'الكل' : s === 'pending' ? 'معلق' : s === 'done' ? 'تم' : 'تجاهل'}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <select value={catFilter} onChange={e => setCatFilter(e.target.value as ReminderCategory | 'all')}
                        className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-none">
                        <option value="all">كل التصنيفات</option>
                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                </div>
            </div>

            {/* Reminders */}
            <div className="space-y-3">
                {filtered.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">لا توجد تذكيرات</div>
                ) : filtered.map(r => (
                    <div key={r.id} className={`rounded-2xl border bg-card p-4 space-y-2 transition-all ${isOverdue(r) ? 'border-red-400 bg-red-50/50 dark:bg-red-900/5' : r.status === 'done' ? 'border-border opacity-60' : 'border-border'}`}>
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {isOverdue(r) && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
                                    <p className={`font-bold text-foreground ${r.status === 'done' ? 'line-through' : ''}`}>{r.title}</p>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PRIORITY_COLORS[r.priority]}`}>{PRIORITY_LABELS[r.priority]}</span>
                                    <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-bold">{CATEGORY_LABELS[r.category]}</span>
                                </div>
                                {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                                <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                    <Clock className="h-3 w-3" />
                                    {r.reminderDate}{r.reminderTime ? ` • ${r.reminderTime}` : ''}
                                </p>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                                {r.status === 'pending' && <>
                                    <button onClick={() => { markReminderDone(r.id); refresh(); }}
                                        className="rounded-xl bg-emerald-50 border border-emerald-200 p-2 text-emerald-700 hover:bg-emerald-100 transition-colors" title="تم"><Check className="h-3.5 w-3.5" /></button>
                                    <button onClick={() => { updateReminder(r.id, { status: 'dismissed' }); refresh(); }}
                                        className="rounded-xl bg-gray-50 border border-gray-200 p-2 text-gray-600 hover:bg-gray-100 transition-colors" title="تجاهل"><X className="h-3.5 w-3.5" /></button>
                                </>}
                                <button onClick={() => { deleteReminder(r.id); refresh(); }}
                                    className="rounded-xl bg-red-50 p-2 text-destructive hover:bg-red-100 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-6">
                    <div className="w-full max-w-md mx-4 rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">إضافة تذكير</h2>
                            <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">العنوان *</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={IC} /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">الوصف</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={IC} /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">التاريخ</label><input type="date" value={form.reminderDate} onChange={e => setForm(f => ({ ...f, reminderDate: e.target.value }))} className={IC} /></div>
                                <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">الوقت</label><input type="time" value={form.reminderTime} onChange={e => setForm(f => ({ ...f, reminderTime: e.target.value }))} className={IC} /></div>
                                <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">التصنيف</label>
                                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ReminderCategory }))} className={IC}>
                                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                                <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">الأولوية</label>
                                    <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as ReminderPriority }))} className={IC}>
                                        {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleSubmit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                                <Check className="h-4 w-4" /> حفظ
                            </button>
                            <button onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
