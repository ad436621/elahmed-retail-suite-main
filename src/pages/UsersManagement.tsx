import { useState } from 'react';
import {
    Plus, Trash2, Pencil, X, Check, Users, ShieldCheck, Eye, EyeOff,
    ToggleLeft, ToggleRight, Activity, Clock, Crown, UserCircle2,
    KeyRound, AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { addUser, deleteUser, updateUser, AppUser, ALL_PERMISSIONS, PERMISSION_LABELS, Permission, MASTER_RECOVERY_CODE } from '@/data/usersData';
import { getAllAuditEntries } from '@/repositories/auditRepository';
import { useToast } from '@/hooks/use-toast';

const emptyForm = {
    fullName: '',
    username: '',
    password: '',
    role: 'user' as AppUser['role'],
    permissions: [] as Permission[],
    active: true,
};

/** Generate a bright hsl background from a string */
function avatarColor(name: string): string {
    let hash = 0;
    for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffff;
    const hue = hash % 360;
    return `hsl(${hue}, 65%, 50%)`;
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
    const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
    const sizeClass = size === 'sm' ? 'h-9 w-9 text-sm' : size === 'lg' ? 'h-14 w-14 text-xl' : 'h-11 w-11 text-base';
    return (
        <div className={`${sizeClass} rounded-xl flex items-center justify-center font-black text-white shrink-0 shadow-md`}
            style={{ background: avatarColor(name) }}>
            {initials}
        </div>
    );
}

export default function UsersManagement() {
    const { allUsers, refreshUsers, isOwner } = useAuth();
    const { toast } = useToast();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [showPass, setShowPass] = useState(false);
    const [activeTab, setActiveTab] = useState<'users' | 'activity'>('users');
    const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);

    const rawLogs = getAllAuditEntries();
    const sortedLogs = [...rawLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (!isOwner()) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <AlertTriangle className="h-10 w-10 text-destructive/60" />
                <p className="text-muted-foreground font-medium">ليس لديك صلاحية لعرض هذه الصفحة</p>
            </div>
        );
    }

    const getUserName = (userId: string) => {
        const u = allUsers.find(x => x.id === userId);
        return u ? u.fullName : 'نظام / محذوف';
    };

    const formatAction = (action: string) => {
        const map: Record<string, string> = {
            'product_created': 'إضافة منتج', 'product_updated': 'تعديل منتج', 'product_deleted': 'حذف منتج',
            'price_changed': 'تغيير السعر', 'sale_voided': 'إلغاء بيع', 'sale_completed': 'عملية بيع', 'sale_refunded': 'مرتجع',
        };
        return map[action] || action;
    };

    const openAdd = () => { setForm(emptyForm); setEditId(null); setShowPass(false); setShowForm(true); };
    const openEdit = (u: AppUser) => {
        setForm({ fullName: u.fullName, username: u.username, password: u.password, role: u.role, permissions: [...u.permissions], active: u.active });
        setEditId(u.id); setShowPass(false); setShowForm(true);
    };
    const togglePermission = (perm: Permission) =>
        setForm(f => ({ ...f, permissions: f.permissions.includes(perm) ? f.permissions.filter(p => p !== perm) : [...f.permissions, perm] }));
    const selectAll = () => setForm(f => ({ ...f, permissions: [...ALL_PERMISSIONS] }));
    const clearAll = () => setForm(f => ({ ...f, permissions: [] }));

    const handleSubmit = () => {
        if (!form.fullName.trim() || !form.username.trim() || !form.password.trim()) {
            toast({ title: 'خطأ', description: 'الاسم واسم المستخدم وكلمة المرور مطلوبة', variant: 'destructive' }); return;
        }
        if (form.password.length < 4) {
            toast({ title: 'خطأ', description: 'كلمة المرور 4 أحرف على الأقل', variant: 'destructive' }); return;
        }
        const existing = allUsers.find(u => u.username.toLowerCase() === form.username.toLowerCase());
        if (!editId && existing) {
            toast({ title: 'خطأ', description: 'اسم المستخدم موجود بالفعل', variant: 'destructive' }); return;
        }
        if (editId) { updateUser(editId, form); toast({ title: '✅ تم التعديل', description: form.fullName }); }
        else { addUser(form); toast({ title: '✅ تمت الإضافة', description: form.fullName }); }
        refreshUsers(); setShowForm(false); setEditId(null);
    };

    const handleDelete = (u: AppUser) => {
        if (u.role === 'owner') { toast({ title: 'لا يمكن حذف صاحب النظام', variant: 'destructive' }); return; }
        deleteUser(u.id); refreshUsers(); setDeleteTarget(null);
        toast({ title: '🗑️ تم الحذف', description: u.fullName });
    };

    const handleToggleActive = (u: AppUser) => {
        updateUser(u.id, { active: !u.active }); refreshUsers();
        toast({ title: u.active ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب', description: u.fullName });
    };

    const inputClass = 'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                        <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">إدارة المستخدمين</h1>
                        <p className="text-xs text-muted-foreground">{allUsers.length} مستخدم مسجل</p>
                    </div>
                </div>
                <button onClick={openAdd}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                    <Plus className="h-4 w-4" /> مستخدم جديد
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 rounded-2xl bg-muted/50 p-1 w-fit border border-border/50">
                <button onClick={() => setActiveTab('users')} className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-card shadow-sm text-primary border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
                    <Users className="h-4 w-4" /> المستخدمون
                </button>
                <button onClick={() => setActiveTab('activity')} className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'activity' ? 'bg-card shadow-sm text-primary border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
                    <Activity className="h-4 w-4" /> سجل النشاطات
                </button>
            </div>

            {/* User Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8" onClick={() => setShowForm(false)}>
                    <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 pb-2 border-b border-border">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                                {editId ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                            </div>
                            <h2 className="text-lg font-bold text-foreground flex-1">{editId ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}</h2>
                            <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">الاسم الكامل *</label>
                                <input data-validation="text-only" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="مثال: أحمد محمد" className={inputClass} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">اسم المستخدم *</label>
                                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="بالإنجليزية" className={inputClass} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">كلمة المرور *</label>
                                <div className="relative">
                                    <input type={showPass ? 'text' : 'password'} value={form.password}
                                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                        placeholder="4 أحرف على الأقل"
                                        className={`${inputClass} pl-10`} />
                                    <button type="button" onClick={() => setShowPass(s => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">الدور</label>
                                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as AppUser['role'] }))} className={inputClass}>
                                    <option value="user">مستخدم عادي</option>
                                    <option value="owner">صاحب النظام</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-3 pt-5">
                                <button type="button" onClick={() => setForm(f => ({ ...f, active: !f.active }))} className="flex items-center gap-2 text-sm">
                                    {form.active ? <ToggleRight className="h-6 w-6 text-emerald-500" /> : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                                    <span className={form.active ? 'text-emerald-500' : 'text-muted-foreground'}>{form.active ? 'حساب نشط' : 'حساب معطل'}</span>
                                </button>
                            </div>
                        </div>

                        {form.role === 'user' && (
                            <div className="rounded-xl border border-border p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4 text-primary" /> الصلاحيات
                                        <span className="text-xs font-normal text-muted-foreground">({form.permissions.length}/{ALL_PERMISSIONS.length})</span>
                                    </h3>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={selectAll} className="text-xs text-primary hover:underline">تحديد الكل</button>
                                        <span className="text-muted-foreground">|</span>
                                        <button type="button" onClick={clearAll} className="text-xs text-muted-foreground hover:underline">إلغاء الكل</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {ALL_PERMISSIONS.map(perm => (
                                        <label key={perm} className="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors">
                                            <input type="checkbox" checked={form.permissions.includes(perm)} onChange={() => togglePermission(perm)} className="accent-primary" />
                                            <span className="text-xs text-foreground">{PERMISSION_LABELS[perm]}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                        {form.role === 'owner' && (
                            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-center">
                                <p className="text-xs text-primary font-medium">صاحب النظام لديه صلاحية الوصول الكاملة لجميع الأقسام</p>
                            </div>
                        )}

                        <div className="flex gap-2 pt-2">
                            <button onClick={handleSubmit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all">
                                <Check className="h-4 w-4" /> {editId ? 'حفظ التعديلات' : 'إضافة'}
                            </button>
                            <button onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Users Cards */}
            {activeTab === 'users' && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {allUsers.length === 0 ? (
                            <div className="col-span-full rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
                                <UserCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p>لا يوجد مستخدمون</p>
                            </div>
                        ) : allUsers.map(u => (
                            <div key={u.id} className={`rounded-2xl border bg-card p-5 space-y-4 hover:shadow-md transition-all ${!u.active ? 'opacity-60' : ''} ${u.role === 'owner' ? 'border-primary/30 bg-primary/2' : 'border-border'}`}>
                                {/* Top row */}
                                <div className="flex items-start gap-3">
                                    <Avatar name={u.fullName} size="md" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-bold text-foreground truncate">{u.fullName}</p>
                                            {u.role === 'owner' && <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                        </div>
                                        <p className="text-xs text-muted-foreground font-mono mt-0.5">@{u.username}</p>
                                    </div>
                                    {/* Active toggle */}
                                    <button onClick={() => handleToggleActive(u)} disabled={u.role === 'owner'} title={u.active ? 'تعطيل' : 'تفعيل'}
                                        className="disabled:opacity-30 disabled:cursor-not-allowed shrink-0">
                                        {u.active ? <ToggleRight className="h-6 w-6 text-emerald-500" /> : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                                    </button>
                                </div>

                                {/* Role & Permissions badges */}
                                <div className="flex flex-wrap gap-2">
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${u.role === 'owner' ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>
                                        {u.role === 'owner' ? <><Crown className="h-3 w-3" /> صاحب النظام</> : 'مستخدم'}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                                        <ShieldCheck className="h-3 w-3" />
                                        {u.role === 'owner' ? 'كامل' : `${u.permissions.length}/${ALL_PERMISSIONS.length} صلاحية`}
                                    </span>
                                    {!u.active && (
                                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">معطل</span>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                                    <button onClick={() => openEdit(u)}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                                        <Pencil className="h-3.5 w-3.5" /> تعديل
                                    </button>
                                    <button onClick={() => { setShowPass(false); openEdit(u); }}
                                        className="flex items-center justify-center gap-1 rounded-xl py-2 px-3 text-xs font-semibold bg-muted text-muted-foreground hover:bg-muted/80 transition-colors" title="تغيير كلمة المرور">
                                        <KeyRound className="h-3.5 w-3.5" />
                                    </button>
                                    {u.role !== 'owner' && (
                                        <button onClick={() => setDeleteTarget(u)}
                                            className="flex items-center justify-center rounded-xl py-2 px-3 text-xs bg-red-50 dark:bg-red-500/10 text-destructive hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Recovery Code */}
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
                        <ShieldCheck className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-amber-500">كود الاسترداد الخاص بك</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                استخدم هذا الكود لاستعادة حسابك في حالة نسيان كلمة المرور:
                                <code className="mx-1 rounded bg-muted px-2 py-1 text-sm font-mono font-bold">{MASTER_RECOVERY_CODE}</code>
                            </p>
                            <p className="text-xs text-amber-600/70 mt-2">⚠️ احتفظ بهذا الكود في مكان آمن - لا تشاركه مع الآخرين</p>
                        </div>
                    </div>
                </>
            )}

            {/* Activity Log */}
            {activeTab === 'activity' && (
                <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft">
                    <div className="overflow-x-auto pb-4">
                        <table className="w-full text-sm min-w-[600px]">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">التاريخ والوقت</th>
                                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">المستخدم</th>
                                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">الحدث</th>
                                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">النوع</th>
                                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">التفاصيل</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedLogs.length === 0 ? (
                                    <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">لا توجد نشاطات مسجلة</td></tr>
                                ) : sortedLogs.map((log, i) => (
                                    <tr key={log.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 text-xs">
                                                <Clock className="w-3.5 h-3.5" />
                                                {new Date(log.timestamp).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Avatar name={getUserName(log.userId)} size="sm" />
                                                <span className="font-medium text-foreground text-sm">{getUserName(log.userId)}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className="inline-flex items-center rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                                                {formatAction(log.action)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground uppercase">{log.entityType}</td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground">
                                            <code className="bg-muted px-1 py-0.5 rounded text-[10px] break-all max-w-[150px] inline-block truncate" title={log.entityId}>{log.entityId}</code>
                                            {log.afterState?.reason && (
                                                <span className="mr-2 text-destructive font-semibold">سبب: {log.afterState.reason as string}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Confirm Delete Dialog */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => setDeleteTarget(null)}>
                    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/15">
                                <Trash2 className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-foreground">تأكيد حذف المستخدم</h3>
                                <p className="text-xs text-muted-foreground">هذا الإجراء لا يمكن التراجع عنه</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3 mb-4">
                            <Avatar name={deleteTarget.fullName} size="sm" />
                            <div>
                                <p className="font-bold text-foreground text-sm">{deleteTarget.fullName}</p>
                                <p className="text-xs text-muted-foreground font-mono">@{deleteTarget.username}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleDelete(deleteTarget)}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 py-2.5 text-sm font-bold text-white transition-all">
                                <Trash2 className="h-4 w-4" /> نعم، احذف
                            </button>
                            <button onClick={() => setDeleteTarget(null)}
                                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
