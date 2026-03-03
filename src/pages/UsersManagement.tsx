import { useState } from 'react';
import { Plus, Trash2, Pencil, X, Check, Users, ShieldCheck, Eye, EyeOff, ToggleLeft, ToggleRight, Activity, Clock } from 'lucide-react';
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

export default function UsersManagement() {
    const { allUsers, refreshUsers, isOwner } = useAuth();
    const { toast } = useToast();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [showPass, setShowPass] = useState(false);
    const [activeTab, setActiveTab] = useState<'users' | 'activity'>('users');

    // Get audit logs sorted by newest
    const rawLogs = getAllAuditEntries();
    const sortedLogs = [...rawLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (!isOwner()) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">ليس لديك صلاحية لعرض هذه الصفحة</p>
            </div>
        );
    }

    const getUserName = (userId: string) => {
        const u = allUsers.find(x => x.id === userId);
        return u ? u.fullName : 'نظام / محذوف';
    };

    const formatAction = (action: string) => {
        const map: Record<string, string> = {
            'product_created': 'إضافة منتج',
            'product_updated': 'تعديل منتج',
            'product_deleted': 'حذف منتج',
            'price_changed': 'تغيير السعر',
            'sale_voided': 'إلغاء بيع',
            'sale_completed': 'عملية بيع',
            'sale_refunded': 'مرتجع',
        };
        return map[action] || action;
    };

    const openAdd = () => {
        setForm(emptyForm);
        setEditId(null);
        setShowPass(false);
        setShowForm(true);
    };

    const openEdit = (u: AppUser) => {
        setForm({
            fullName: u.fullName,
            username: u.username,
            password: u.password,
            role: u.role,
            permissions: [...u.permissions],
            active: u.active,
        });
        setEditId(u.id);
        setShowPass(false);
        setShowForm(true);
    };

    const togglePermission = (perm: Permission) => {
        setForm(f => ({
            ...f,
            permissions: f.permissions.includes(perm)
                ? f.permissions.filter(p => p !== perm)
                : [...f.permissions, perm],
        }));
    };

    const selectAll = () => setForm(f => ({ ...f, permissions: [...ALL_PERMISSIONS] }));
    const clearAll = () => setForm(f => ({ ...f, permissions: [] }));

    const handleSubmit = () => {
        if (!form.fullName.trim() || !form.username.trim() || !form.password.trim()) {
            toast({ title: 'خطأ', description: 'الاسم واسم المستخدم وكلمة المرور مطلوبة', variant: 'destructive' });
            return;
        }
        if (form.password.length < 4) {
            toast({ title: 'خطأ', description: 'كلمة المرور 4 أحرف على الأقل', variant: 'destructive' });
            return;
        }
        // Check duplicate username
        const existing = allUsers.find(u => u.username.toLowerCase() === form.username.toLowerCase());
        if (!editId && existing) {
            toast({ title: 'خطأ', description: 'اسم المستخدم موجود بالفعل', variant: 'destructive' });
            return;
        }

        if (editId) {
            updateUser(editId, form);
            toast({ title: 'تم التعديل', description: form.fullName });
        } else {
            addUser(form);
            toast({ title: 'تمت الإضافة', description: form.fullName });
        }
        refreshUsers();
        setShowForm(false);
        setEditId(null);
    };

    const handleDelete = (u: AppUser) => {
        if (u.role === 'owner') {
            toast({ title: 'لا يمكن حذف صاحب النظام', variant: 'destructive' });
            return;
        }
        deleteUser(u.id);
        refreshUsers();
        toast({ title: 'تم الحذف', description: u.fullName });
    };

    const handleToggleActive = (u: AppUser) => {
        updateUser(u.id, { active: !u.active });
        refreshUsers();
        toast({ title: u.active ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب', description: u.fullName });
    };

    const inputClass = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                        <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">إدارة المستخدمين</h1>
                        <p className="text-sm text-muted-foreground">{allUsers.length} مستخدم</p>
                    </div>
                </div>
                <button
                    onClick={openAdd}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                    <Plus className="h-4 w-4" /> مستخدم جديد
                </button>
            </div>

            <div className="flex gap-2 rounded-2xl bg-muted/50 p-1 w-fit border border-border/50">
                <button onClick={() => setActiveTab('users')} className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-card shadow-sm text-primary border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
                    <Users className="h-4 w-4" /> إدارة المستخدمين
                </button>
                <button onClick={() => setActiveTab('activity')} className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'activity' ? 'bg-card shadow-sm text-primary border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
                    <Activity className="h-4 w-4" /> سجل النشاطات
                </button>
            </div>

            {/* Form Dialog */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm overflow-y-auto py-8">
                    <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in mx-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">{editId ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}</h2>
                            <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">الاسم الكامل *</label>
                                <input data-validation="text-only" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="مثال: أحمد محمد" className={inputClass} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">اسم المستخدم *</label>
                                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="بالإنجليزية" className={inputClass} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">كلمة المرور *</label>
                                <div className="relative">
                                    <input
                                        type={showPass ? 'text' : 'password'}
                                        value={form.password}
                                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                        placeholder="4 أحرف على الأقل"
                                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 pl-10"
                                    />
                                    <button type="button" onClick={() => setShowPass(s => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">الدور</label>
                                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as AppUser['role'] }))} className={inputClass}>
                                    <option value="user">مستخدم عادي</option>
                                    <option value="owner">صاحب النظام</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-3 pt-5">
                                <button type="button" onClick={() => setForm(f => ({ ...f, active: !f.active }))} className="flex items-center gap-2 text-sm">
                                    {form.active
                                        ? <ToggleRight className="h-6 w-6 text-emerald-500" />
                                        : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                                    <span className={form.active ? 'text-emerald-500' : 'text-muted-foreground'}>{form.active ? 'حساب نشط' : 'حساب معطل'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Permissions */}
                        {form.role === 'user' && (
                            <div className="rounded-xl border border-border p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4 text-primary" /> الصلاحيات
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
                                            <input
                                                type="checkbox"
                                                checked={form.permissions.includes(perm)}
                                                onChange={() => togglePermission(perm)}
                                                className="accent-primary"
                                            />
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
                            <button onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'users' && (
                <>
                    {/* Users table */}
                    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft">
                        <div className="overflow-x-auto pb-4">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="px-4 py-3 text-right font-semibold text-muted-foreground">الاسم</th>
                                        <th className="px-4 py-3 text-right font-semibold text-muted-foreground">اسم المستخدم</th>
                                        <th className="px-4 py-3 text-center font-semibold text-muted-foreground">الدور</th>
                                        <th className="px-4 py-3 text-center font-semibold text-muted-foreground">الصلاحيات</th>
                                        <th className="px-4 py-3 text-center font-semibold text-muted-foreground">الحالة</th>
                                        <th className="px-4 py-3 text-center font-semibold text-muted-foreground">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allUsers.length === 0 ? (
                                        <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">لا يوجد مستخدمون</td></tr>
                                    ) : allUsers.map((u, i) => (
                                        <tr key={u.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                                            <td className="px-4 py-3 font-medium text-foreground">{u.fullName}</td>
                                            <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{u.username}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.role === 'owner' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                                    {u.role === 'owner' ? '👑 صاحب النظام' : 'مستخدم'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {u.role === 'owner'
                                                    ? <span className="text-xs text-primary">كامل</span>
                                                    : <span className="text-xs text-muted-foreground">{u.permissions.length} / {ALL_PERMISSIONS.length}</span>
                                                }
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => handleToggleActive(u)} disabled={u.role === 'owner'} className="disabled:opacity-40 disabled:cursor-not-allowed">
                                                    {u.active
                                                        ? <ToggleRight className="h-6 w-6 text-emerald-500 mx-auto" />
                                                        : <ToggleLeft className="h-6 w-6 text-muted-foreground mx-auto" />
                                                    }
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => openEdit(u)} className="rounded-lg p-1.5 hover:bg-primary/10 text-primary transition-colors"><Pencil className="h-4 w-4" /></button>
                                                    {u.role !== 'owner' && (
                                                        <button onClick={() => handleDelete(u)} className="rounded-lg p-1.5 hover:bg-destructive/10 text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Recovery Code reminder */}
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
                        <ShieldCheck className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-amber-500">كود الاسترداد الخاص بك</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                استخدم هذا الكود لاستعادة حسابك في حالة نسيان كلمة المرور:
                                <code className="mx-1 rounded bg-muted px-2 py-1 text-sm font-mono font-bold">{MASTER_RECOVERY_CODE}</code>
                            </p>
                            <p className="text-xs text-amber-600/70 mt-2">
                                ⚠️ احتفظ بهذا الكود في مكان آمن - لا تشاركه مع الآخرين
                            </p>
                        </div>
                    </div>
                </>
            )}

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
                                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">التفاصيل / المعرف</th>
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
                                        <td className="px-4 py-3 font-medium text-foreground">{getUserName(log.userId)}</td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className="inline-flex items-center rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                                                {formatAction(log.action)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground uppercase">{log.entityType}</td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground">
                                            <code className="bg-muted px-1 py-0.5 rounded text-[10px] break-all max-w-[150px] inline-block truncate" title={log.entityId}>{log.entityId}</code>
                                            {log.afterState?.reason && (
                                                <span className="mr-2 text-destructive font-semibold">
                                                    سبب الإلغاء: {log.afterState.reason as string}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
