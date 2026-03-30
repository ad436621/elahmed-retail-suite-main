import { useState, useEffect } from 'react';
import { Users, Plus, Phone, Trash2, X, Check, Save } from 'lucide-react';
import { useConfirm } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';

// ======================================================
// GX GLEAMEX — Partners Page
// ======================================================

const PARTNERS_KEY = 'gx_partners';

interface Partner {
  id: string;
  name: string;
  phone: string;
  type: 'supplier' | 'distributor' | 'agent';
  balance: number;
  notes: string;
  createdAt: string;
}

function getPartners(): Partner[] {
  try {
    return JSON.parse(localStorage.getItem(PARTNERS_KEY) || '[]');
  } catch { return []; }
}

function savePartners(partners: Partner[]): void {
  localStorage.setItem(PARTNERS_KEY, JSON.stringify(partners));
}

export default function PartnersPage() {
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', type: 'supplier' as Partner['type'], notes: '', balance: 0 });

  const IC = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";

  useEffect(() => {
    setPartners(getPartners());
  }, []);

  const filtered = partners.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const newPartner: Partner = {
      ...form,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...partners, newPartner];
    setPartners(updated);
    savePartners(updated);
    setShowForm(false);
    setForm({ name: '', phone: '', type: 'supplier', notes: '', balance: 0 });
    toast({ title: '✅ تم إضافة الشريك', description: form.name });
  };

  async function deletePartner(id: string, name: string) {
    const ok = await confirm({
      title: 'حذف شريك',
      message: `هل أنت متأكد من حذف الشريك "${name}"؟`,
      confirmLabel: 'حذف',
      danger: true
    });
    if (!ok) return;

    const updated = partners.filter(p => p.id !== id);
    setPartners(updated);
    savePartners(updated);
    toast({ title: '🗑️ تم الحذف', description: name });
  }

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">الشركاء والموزعون</h1>
            <p className="text-sm text-muted-foreground">{partners.length} شريك مسجل</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="h-4 w-4" /> إضافة شريك
        </button>
      </div>

      {/* Quick Stats & Search */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
        <div className="relative">
          <input
            type="text"
            placeholder="بحث بالاسم أو الهاتف..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${IC} pr-10`}
          />
          <Users className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Partners List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-dashed border-border">
          <Users className="w-16 h-16 text-muted-foreground/20 mb-4" />
          <p className="text-muted-foreground font-medium">لا يوجد شريك يطابق البحث</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(partner => (
            <div
              key={partner.id}
              className="group flex flex-col p-5 bg-card border border-border rounded-2xl shadow-soft hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-bold text-primary">
                    {partner.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{partner.name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {partner.phone || 'بدون هاتف'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deletePartner(partner.id, partner.name)}
                  className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              
              <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase">الرصيد الحالي</p>
                  <p className={`text-lg font-black ${partner.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {partner.balance.toLocaleString('ar-EG')} <span className="text-xs font-normal">ج.م</span>
                  </p>
                </div>
                <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-bold text-muted-foreground">
                  {partner.type === 'supplier' ? 'مورد' : partner.type === 'distributor' ? 'موزع' : 'وكيل'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-4 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">إضافة شريك جديد</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-muted rounded-lg transition-colors"><X className="h-5 w-5 text-muted-foreground"/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">الاسم الكامل *</label>
                <input data-validation="text-only" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus className={IC} placeholder="اسم الشريك المسجل" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">رقم الهاتف</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={IC} placeholder="01xxxxxxxxx" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">نوع الشراكة</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))} className={IC}>
                    <option value="supplier">مورد</option>
                    <option value="distributor">موزع</option>
                    <option value="agent">وكيل</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">الرصيد الافتتاحي (ج.م)</label>
                <input type="number" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: +e.target.value }))} className={IC} />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                  <Save className="h-4 w-4" /> حفظ الشريك
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
