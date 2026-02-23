import { useState, useRef } from 'react';
import { Plus, Trash2, Pencil, X, Check, Wrench, Printer, Search, TrendingUp, ImagePlus, ImageOff, AlignLeft } from 'lucide-react';
import { MaintenanceOrder, SparePart } from '@/domain/types';
import { getMaintenanceOrders, addMaintenanceOrder, updateMaintenanceOrder, deleteMaintenanceOrder } from '@/data/maintenanceData';
import { useToast } from '@/hooks/use-toast';

const statusLabels: Record<MaintenanceOrder['status'], string> = {
    pending: 'انتظار', in_progress: 'قيد الإصلاح', done: 'تم الإصلاح', delivered: 'تم التسليم',
};
const statusColors: Record<MaintenanceOrder['status'], string> = {
    pending: 'bg-amber-100 text-amber-700',
    in_progress: 'bg-blue-100 text-blue-700',
    done: 'bg-emerald-100 text-emerald-700',
    delivered: 'bg-muted text-muted-foreground',
};

const emptyOrder = {
    customerName: '', customerPhone: '', date: new Date().toISOString().slice(0, 10),
    deviceName: '', issueDescription: '', spareParts: [] as SparePart[],
    status: 'pending' as MaintenanceOrder['status'],
    description: '', image: undefined as string | undefined,
};

const IC = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";

export default function Maintenance() {
    const { toast } = useToast();
    const [orders, setOrders] = useState<MaintenanceOrder[]>(() => getMaintenanceOrders());
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyOrder);
    const [newPart, setNewPart] = useState({ name: '', costPrice: 0, salePrice: 0 });
    const [search, setSearch] = useState('');
    const [showReport, setShowReport] = useState<MaintenanceOrder | null>(null);

    const refresh = () => setOrders(getMaintenanceOrders());

    const addPart = () => {
        if (!newPart.name.trim()) return;
        setForm(f => ({ ...f, spareParts: [...f.spareParts, { ...newPart }] }));
        setNewPart({ name: '', costPrice: 0, salePrice: 0 });
    };
    const removePart = (idx: number) => setForm(f => ({ ...f, spareParts: f.spareParts.filter((_, i) => i !== idx) }));

    const handleSubmit = () => {
        if (!form.customerName.trim() || !form.deviceName.trim()) {
            toast({ title: 'خطأ', description: 'اسم العميل والجهاز مطلوبان', variant: 'destructive' });
            return;
        }
        if (editId) { updateMaintenanceOrder(editId, form); toast({ title: '✅ تم التعديل' }); }
        else { addMaintenanceOrder(form); toast({ title: '✅ تم إنشاء طلب الصيانة', description: form.deviceName }); }
        setForm(emptyOrder); setEditId(null); setShowForm(false); refresh();
    };

    const startEdit = (o: MaintenanceOrder) => {
        setForm({ customerName: o.customerName, customerPhone: o.customerPhone, date: o.date, deviceName: o.deviceName, issueDescription: o.issueDescription, spareParts: o.spareParts, status: o.status, description: o.description ?? '', image: o.image });
        setEditId(o.id); setShowForm(true);
    };

    // Image upload helper
    const ImageUpload = ({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) => {
        const ref = useRef<HTMLInputElement>(null);
        const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => onChange(ev.target?.result as string);
            reader.readAsDataURL(file);
        };
        return (
            <div className="col-span-2">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <ImagePlus className="h-3.5 w-3.5 text-primary" /> صورة الجهاز
                </label>
                <div className="flex items-center gap-3">
                    {value ? (
                        <div className="relative h-24 w-24 rounded-xl overflow-hidden border-2 border-primary/30 shrink-0 shadow">
                            <img src={value} alt="صورة" className="h-full w-full object-cover" />
                            <button type="button" onClick={() => onChange(undefined)} className="absolute top-1 right-1 rounded-full bg-red-500 p-0.5 text-white shadow hover:bg-red-600"><X className="h-3 w-3" /></button>
                        </div>
                    ) : (
                        <div className="h-24 w-24 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center shrink-0">
                            <ImageOff className="h-7 w-7 text-muted-foreground/40" />
                        </div>
                    )}
                    <div className="flex-1">
                        <button type="button" onClick={() => ref.current?.click()} className="w-full rounded-xl border border-dashed border-primary/40 bg-primary/5 py-3 text-sm font-medium text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-2">
                            <ImagePlus className="h-4 w-4" />{value ? 'تغيير الصورة' : 'اختر صورة للجهاز'}
                        </button>
                        <p className="mt-1.5 text-xs text-muted-foreground">JPG, PNG, WebP</p>
                    </div>
                    <input ref={ref} type="file" accept="image/*" onChange={handleFile} className="hidden" />
                </div>
            </div>
        );
    };

    // Print client invoice (no part details — only total)
    const printClientInvoice = (order: MaintenanceOrder) => {
        const html = `<html dir="rtl"><head><meta charset="UTF-8"><title>فاتورة صيانة</title>
        <style>
          body{font-family:Cairo,sans-serif;padding:32px;max-width:600px;margin:auto;color:#1a1a1a;}
          h2{text-align:center;font-size:1.4em;margin-bottom:4px;}
          .sub{text-align:center;color:#666;font-size:.85em;margin-bottom:24px;}
          table{width:100%;border-collapse:collapse;}td,th{padding:10px;border:1px solid #ddd;text-align:right;}
          th{background:#f5f5f5;font-weight:600;}
          .total{font-size:1.2em;font-weight:700;margin-top:20px;text-align:left;color:#92400e;}
          .footer{margin-top:40px;text-align:center;font-size:.8em;color:#999;}
        </style></head><body>
        <h2>🔧 فاتورة صيانة</h2>
        <div class="sub">رقم الطلب: ${order.orderNumber}</div>
        <table>
          <tr><th>العميل</th><td>${order.customerName}</td></tr>
          <tr><th>الموبايل</th><td>${order.customerPhone}</td></tr>
          <tr><th>التاريخ</th><td>${order.date}</td></tr>
          <tr><th>الجهاز</th><td>${order.deviceName}</td></tr>
          <tr><th>الحالة</th><td>${order.issueDescription || '—'}</td></tr>
        </table>
        <div class="total">الإجمالي: ${order.totalSale.toLocaleString()} ج.م</div>
        <div class="footer">شكراً لثقتكم — نتمنى لكم تجربة رائعة</div>
        </body></html>`;
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.print(); }
    };

    const filtered = orders.filter(o =>
        o.customerName.includes(search) || o.deviceName.includes(search) || o.customerPhone.includes(search) || o.orderNumber.includes(search)
    );

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 border border-orange-200">
                        <Wrench className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">الصيانة</h1>
                        <p className="text-xs text-muted-foreground">{orders.length} طلب</p>
                    </div>
                </div>
                <button onClick={() => { setShowForm(true); setEditId(null); setForm(emptyOrder); }}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-md">
                    <Plus className="h-4 w-4" /> طلب صيانة جديد
                </button>
            </div>

            <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الجهاز أو رقم الطلب..." className={`${IC} pr-9`} />
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-6">
                    <div className="w-full max-w-xl mx-4 rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-scale-in">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">طلب صيانة</h2>
                            <button onClick={() => { setShowForm(false); setEditId(null); }} className="rounded-lg p-1.5 hover:bg-muted transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <ImageUpload value={form.image} onChange={v => setForm(f => ({ ...f, image: v }))} />
                            <div className="col-span-2">
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground flex items-center gap-1"><AlignLeft className="h-3.5 w-3.5 text-primary" /> وصف طلب الصيانة</label>
                                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="ملاحظات الفني — وصف العيب، الإجراءات المتخذة..." className={`${IC} resize-none`} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">اسم العميل *</label>
                                <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">رقم الموبايل</label>
                                <input value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">التاريخ</label>
                                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">الحالة</label>
                                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as MaintenanceOrder['status'] }))} className={IC}>
                                    {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">اسم الجهاز *</label>
                                <input value={form.deviceName} onChange={e => setForm(f => ({ ...f, deviceName: e.target.value }))} className={IC} />
                            </div>
                            <div className="col-span-2">
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">وصف المشكلة</label>
                                <textarea value={form.issueDescription} onChange={e => setForm(f => ({ ...f, issueDescription: e.target.value }))} rows={2} className={`${IC} resize-none`} />
                            </div>
                        </div>

                        {/* Spare Parts */}
                        <div className="rounded-2xl border border-border p-4 space-y-3 bg-muted/20">
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                قطع الغيار
                                <span className="text-xs font-normal text-muted-foreground">(التكلفة داخلية — لا تظهر للعميل)</span>
                            </h3>
                            <div className="grid grid-cols-3 gap-2">
                                <input value={newPart.name} onChange={e => setNewPart(p => ({ ...p, name: e.target.value }))} placeholder="اسم القطعة" className={IC} />
                                <input type="number" placeholder="تكلفتها (ج.م)" value={newPart.costPrice || ''} onChange={e => setNewPart(p => ({ ...p, costPrice: +e.target.value }))} className={IC} />
                                <input type="number" placeholder="سعرها للعميل" value={newPart.salePrice || ''} onChange={e => setNewPart(p => ({ ...p, salePrice: +e.target.value }))} className={IC} />
                            </div>
                            <button onClick={addPart} className="flex items-center gap-1.5 rounded-xl bg-primary/10 text-primary px-3 py-1.5 text-sm font-semibold hover:bg-primary/20 transition-colors">
                                <Plus className="h-4 w-4" /> إضافة قطعة
                            </button>
                            {form.spareParts.length > 0 && (
                                <div className="space-y-1.5">
                                    {form.spareParts.map((p, i) => (
                                        <div key={i} className="flex items-center justify-between rounded-xl bg-card px-3 py-2 border border-border">
                                            <span className="text-sm font-medium text-foreground">{p.name}</span>
                                            <div className="flex items-center gap-3 text-xs">
                                                <span className="text-muted-foreground">تكلفة: {p.costPrice.toLocaleString()}</span>
                                                <span className="text-primary font-semibold">سعر: {p.salePrice.toLocaleString()}</span>
                                                <span className="text-emerald-600 font-bold">ربح: {(p.salePrice - p.costPrice).toLocaleString()}</span>
                                                <button onClick={() => removePart(i)} className="text-destructive hover:opacity-80"><X className="h-3.5 w-3.5" /></button>
                                            </div>
                                        </div>
                                    ))}
                                    {/* Summary */}
                                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 grid grid-cols-3 gap-2 text-center text-xs">
                                        <div>
                                            <p className="text-muted-foreground">إجمالي التكلفة</p>
                                            <p className="font-bold text-orange-600">{form.spareParts.reduce((s, p) => s + p.costPrice, 0).toLocaleString()} ج.م</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">إجمالي البيع</p>
                                            <p className="font-bold text-primary">{form.spareParts.reduce((s, p) => s + p.salePrice, 0).toLocaleString()} ج.م</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">صافي الربح</p>
                                            <p className="font-bold text-emerald-600">{form.spareParts.reduce((s, p) => s + (p.salePrice - p.costPrice), 0).toLocaleString()} ج.م</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <button onClick={handleSubmit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all">
                                <Check className="h-4 w-4" /> {editId ? 'حفظ' : 'إنشاء الطلب'}
                            </button>
                            <button onClick={() => { setShowForm(false); setEditId(null); }} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Internal Report Modal */}
            {showReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowReport(null)}>
                    <div className="w-full max-w-md mx-4 rounded-3xl border border-border bg-card p-6 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-foreground flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-600" /> التقرير الداخلي</h3>
                            <button onClick={() => setShowReport(null)} className="rounded-lg p-1.5 hover:bg-muted transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">رقم: {showReport.orderNumber}</p>
                        <p className="text-sm mb-3"><span className="font-semibold">{showReport.customerName}</span> — {showReport.deviceName}</p>

                        {showReport.spareParts.length > 0 ? (
                            <div className="rounded-xl border border-border overflow-hidden mb-4">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted/40">
                                        <tr>
                                            <th className="p-2 text-right font-semibold">القطعة</th>
                                            <th className="p-2 text-right font-semibold">تكلفة</th>
                                            <th className="p-2 text-right font-semibold">سعر</th>
                                            <th className="p-2 text-right font-semibold">ربح</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {showReport.spareParts.map((p, i) => (
                                            <tr key={i} className="border-t border-border/50">
                                                <td className="p-2">{p.name}</td>
                                                <td className="p-2 text-orange-600">{p.costPrice.toLocaleString()}</td>
                                                <td className="p-2 text-primary">{p.salePrice.toLocaleString()}</td>
                                                <td className="p-2 text-emerald-600 font-bold">{(p.salePrice - p.costPrice).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : <p className="text-sm text-muted-foreground mb-4">لا توجد قطع غيار مسجلة</p>}

                        <div className="grid grid-cols-3 gap-2 text-center text-xs rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                            <div>
                                <p className="text-muted-foreground mb-1">إجمالي التكلفة</p>
                                <p className="font-bold text-orange-600 text-base">{showReport.totalCost.toLocaleString()} ج.م</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">إجمالي البيع</p>
                                <p className="font-bold text-primary text-base">{showReport.totalSale.toLocaleString()} ج.م</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">صافي الربح</p>
                                <p className="font-bold text-emerald-600 text-base">{showReport.netProfit.toLocaleString()} ج.م</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
                <div className="overflow-x-auto pb-4">
                    <table className="w-full text-sm min-w-[650px]">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                {['رقم الطلب', 'العميل', 'التاريخ', 'الجهاز', 'إجمالي البيع', 'ربح', 'الحالة', ''].map(h => (
                                    <th key={h} className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">لا توجد طلبات صيانة</td></tr>
                            ) : filtered.map((o, i) => (
                                <tr key={o.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{o.orderNumber}</td>
                                    <td className="px-3 py-3">
                                        <div className="font-medium text-foreground">{o.customerName}</div>
                                        <div className="text-xs text-muted-foreground">{o.customerPhone}</div>
                                    </td>
                                    <td className="px-3 py-3 text-xs text-muted-foreground">{o.date}</td>
                                    <td className="px-3 py-3 text-foreground text-sm">{o.deviceName}</td>
                                    <td className="px-3 py-3 font-bold text-primary">{o.totalSale.toLocaleString()} ج.م</td>
                                    <td className="px-3 py-3 font-bold text-emerald-600">{o.netProfit.toLocaleString()} ج.م</td>
                                    <td className="px-3 py-3">
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[o.status]}`}>{statusLabels[o.status]}</span>
                                    </td>
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => printClientInvoice(o)} title="فاتورة العميل" className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground transition-colors"><Printer className="h-3.5 w-3.5" /></button>
                                            <button onClick={() => setShowReport(o)} title="التقرير الداخلي" className="rounded-lg p-1.5 hover:bg-emerald-50 text-emerald-600 transition-colors"><TrendingUp className="h-3.5 w-3.5" /></button>
                                            <button onClick={() => startEdit(o)} className="rounded-lg p-1.5 hover:bg-primary/10 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                                            <button onClick={() => { deleteMaintenanceOrder(o.id); toast({ title: 'تم الحذف' }); refresh(); }} className="rounded-lg p-1.5 hover:bg-red-50 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
