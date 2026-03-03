import { useState, useMemo } from 'react';
import { Users2, Plus, X, Check, Search, Trash2, Pencil, Phone, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { getPartners, addPartner, updatePartner, deletePartner, addPartnerTransaction, getTotalInvestment, getTotalWithdrawals, type Partner } from '@/data/partnersData';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const IC = 'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';
const fmt = (n: number) => n.toLocaleString('ar-EG');

const emptyForm = { name: '', phone: '', email: '', sharePercentage: 0, partnershipType: 'active' as const, investmentAmount: 0, status: 'active' as const, notes: '' };

export default function PartnersPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [partners, setPartners] = useState<Partner[]>(() => getPartners());
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [showWithdraw, setShowWithdraw] = useState<Partner | null>(null);
    const [withdrawAmount, setWithdrawAmount] = useState(0);
    const [withdrawDesc, setWithdrawDesc] = useState('');

    const refresh = () => setPartners(getPartners());

    const filtered = useMemo(() =>
        partners.filter(p => p.name.includes(search) || (p.phone ?? '').includes(search)),
        [partners, search]);

    const handleSubmit = () => {
        if (!form.name.trim()) { toast({ title: 'خطأ', description: 'اسم الشريك مطلوب', variant: 'destructive' }); return; }
        if (editId) {
            updatePartner(editId, form);
            toast({ title: '✅ تم التعديل' });
        } else {
            addPartner(form);
            toast({ title: '✅ تمت الإضافة', description: form.name });
        }
        setForm(emptyForm); setEditId(null); setShowForm(false); refresh();
    };

    const startEdit = (p: Partner) => {
        setForm({ name: p.name, phone: p.phone ?? '', email: p.email ?? '', sharePercentage: p.sharePercentage, partnershipType: p.partnershipType, investmentAmount: p.investmentAmount, status: p.status, notes: p.notes ?? '' });
        setEditId(p.id); setShowForm(true);
    };

    const handleWithdraw = () => {
        if (!showWithdraw || withdrawAmount <= 0) return;
        addPartnerTransaction({ partnerId: showWithdraw.id, partnerName: showWithdraw.name, type: 'withdrawal', amount: withdrawAmount, description: withdrawDesc, createdBy: user?.fullName ?? 'system' });
        toast({ title: '✅ تم تسجيل السحب', description: `${fmt(withdrawAmount)} ج.م` });
        setShowWithdraw(null); setWithdrawAmount(0); setWithdrawDesc(''); refresh();
    };

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 border border-purple-200">
                        <Users2 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">الشركاء</h1>
                        <p className="text-xs text-muted-foreground">{partners.filter(p => p.status === 'active').length} نشط</p>
                    </div>
                </div>
                <button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true); }}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm">
                    <Plus className="h-4 w-4" /> إضافة شريك
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'إجمالي الشركاء', value: String(partners.length), color: 'text-foreground' },
                    { label: 'إجمالي الاستثمارات', value: `${fmt(getTotalInvestment())} ج.م`, color: 'text-emerald-600' },
                    { label: 'إجمالي السحوبات', value: `${fmt(getTotalWithdrawals())} ج.م`, color: 'text-rose-600' },
                    { label: 'شركاء نشطون', value: String(partners.filter(p => p.status === 'active').length), color: 'text-blue-600' },
                ].map(stat => (
                    <div key={stat.label} className="rounded-2xl border border-border bg-card p-4">
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                        <p className={`text-xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم..." className={`${IC} pr-9`} />
            </div>

            {/* Partners Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.length === 0 ? (
                    <div className="col-span-3 rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">لا يوجد شركاء</div>
                ) : filtered.map(p => (
                    <div key={p.id} className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-primary/30 transition-all hover:shadow-md">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="font-bold text-foreground text-lg">{p.name}</p>
                                {p.phone && <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><Phone className="h-3 w-3" />{p.phone}</span>}
                            </div>
                            {/* Share % badge */}
                            <div className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-lg shadow-purple-500/30">
                                <span className="text-lg font-extrabold leading-none">{p.sharePercentage}%</span>
                                <span className="text-[9px] opacity-80">حصة</span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3 text-emerald-500" /> الاستثمار</span>
                                <span className="font-semibold text-emerald-600">{fmt(p.investmentAmount)} ج.م</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3 text-rose-500" /> السحوبات</span>
                                <span className="font-semibold text-rose-600">{fmt(p.totalWithdrawals)} ج.م</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">نوع الشراكة</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${p.partnershipType === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {p.partnershipType === 'active' ? 'نشط' : 'صامت'}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => { setShowWithdraw(p); setWithdrawAmount(0); setWithdrawDesc(''); }}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors">
                                <DollarSign className="h-3.5 w-3.5" /> سحب أرباح
                            </button>
                            <button onClick={() => startEdit(p)} className="rounded-xl p-2 bg-primary/10 hover:bg-primary/20 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => { deletePartner(p.id); toast({ title: 'تم الحذف' }); refresh(); }}
                                className="rounded-xl p-2 bg-red-50 hover:bg-red-100 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-6">
                    <div className="w-full max-w-md mx-4 rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">{editId ? 'تعديل شريك' : 'إضافة شريك'}</h2>
                            <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2"><label className="mb-1 block text-xs font-semibold text-muted-foreground">اسم الشريك *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={IC} /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">الهاتف</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={IC} /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">نسبة المشاركة %</label><input type="number" min={0} max={100} value={form.sharePercentage} onChange={e => setForm(f => ({ ...f, sharePercentage: +e.target.value }))} className={IC} /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">نوع الشراكة</label>
                                <select value={form.partnershipType} onChange={e => setForm(f => ({ ...f, partnershipType: e.target.value as 'active' | 'silent' }))} className={IC}>
                                    <option value="active">نشط</option>
                                    <option value="silent">صامت</option>
                                </select>
                            </div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">قيمة الاستثمار</label><input type="number" min={0} value={form.investmentAmount} onChange={e => setForm(f => ({ ...f, investmentAmount: +e.target.value }))} className={IC} /></div>
                            <div className="col-span-2"><label className="mb-1 block text-xs font-semibold text-muted-foreground">ملاحظات</label><textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={`${IC} resize-none`} /></div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleSubmit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                                <Check className="h-4 w-4" /> {editId ? 'حفظ' : 'إضافة'}
                            </button>
                            <button onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Withdraw Dialog */}
            {showWithdraw && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="w-full max-w-sm mx-4 rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">سحب أرباح</h2>
                            <button onClick={() => setShowWithdraw(null)} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
                        </div>
                        <p className="text-sm text-muted-foreground">الشريك: <span className="font-bold text-foreground">{showWithdraw.name}</span></p>
                        <div className="space-y-3">
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">المبلغ (ج.م)</label>
                                <input type="number" min={0} value={withdrawAmount} onChange={e => setWithdrawAmount(+e.target.value)} className={IC} /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">وصف</label>
                                <input value={withdrawDesc} onChange={e => setWithdrawDesc(e.target.value)} className={IC} /></div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleWithdraw} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-500">
                                <Check className="h-4 w-4" /> تأكيد السحب
                            </button>
                            <button onClick={() => setShowWithdraw(null)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
