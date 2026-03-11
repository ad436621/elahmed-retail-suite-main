import { useState, useRef } from 'react';
import { Plus, Trash2, Pencil, X, Check, Archive, Search, ImagePlus, ImageOff, AlignLeft, Smartphone, Laptop, Monitor, Layers } from 'lucide-react';
import { UsedDevice, UsedDeviceType } from '@/domain/types';
import { getUsedDevices, addUsedDevice, updateUsedDevice, deleteUsedDevice } from '@/data/usedDevicesData';
import { useToast } from '@/hooks/use-toast';
import { useInventoryData } from '@/hooks/useInventoryData';
import { useConfirm } from '@/components/ConfirmDialog';

const emptyForm: Omit<UsedDevice, 'id' | 'createdAt' | 'updatedAt'> = {
    name: '', model: '', deviceType: 'mobile', serialNumber: '', color: '', storage: '', ram: '',
    condition: '', purchasePrice: 0, salePrice: 0, description: '', image: undefined,
};

const IC = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";

function ImageUpload({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
    const ref = useRef<HTMLInputElement>(null);
    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const img = new Image();
        const reader = new FileReader();
        reader.onload = ev => {
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_DIM = 800;
                let w = img.width, h = img.height;
                if (w > MAX_DIM || h > MAX_DIM) {
                    if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
                    else { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
                }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
                onChange(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = ev.target?.result as string;
        };
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
                        <button type="button" onClick={() => onChange(undefined)} className="absolute top-1 right-1 rounded-full bg-red-500 p-0.5 text-white shadow hover:bg-red-600">
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                ) : (
                    <div className="h-24 w-24 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center shrink-0">
                        <ImageOff className="h-7 w-7 text-muted-foreground/40" />
                    </div>
                )}
                <div className="flex-1">
                    <button type="button" onClick={() => ref.current?.click()} className="w-full rounded-xl border border-dashed border-primary/40 bg-primary/5 py-3 text-sm font-medium text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-2">
                        <ImagePlus className="h-4 w-4" />{value ? 'تغيير الصورة' : 'اختر صورة'}
                    </button>
                    <p className="mt-1.5 text-xs text-muted-foreground">JPG, PNG, WebP — يُحفظ داخل النظام</p>
                </div>
                <input ref={ref} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </div>
        </div>
    );
}

export default function UsedInventory() {
    const { toast } = useToast();
    const { confirm } = useConfirm();
    const items = useInventoryData(getUsedDevices, ['gx_used_devices']);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    const refresh = () => { };

    const handleSubmit = () => {
        if (!form.name.trim()) { toast({ title: 'خطأ', description: 'اسم الجهاز مطلوب', variant: 'destructive' }); return; }
        if (editId) { updateUsedDevice(editId, form); toast({ title: '✅ تم التعديل', description: form.name }); }
        else { addUsedDevice(form); toast({ title: '✅ تمت الإضافة', description: form.name }); }
        setForm(emptyForm); setEditId(null); setShowForm(false); refresh();
    };

    const startEdit = (item: UsedDevice) => {
        setForm({ name: item.name, model: item.model, deviceType: item.deviceType || 'mobile', serialNumber: item.serialNumber, color: item.color, storage: item.storage, ram: item.ram, condition: item.condition, purchasePrice: item.purchasePrice, salePrice: item.salePrice, description: item.description ?? '', image: item.image });
        setEditId(item.id); setShowForm(true);
    };

    const filtered = items.filter(i =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.model.toLowerCase().includes(search.toLowerCase()) ||
        i.serialNumber.includes(search)
    );

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/20">
                        <Archive className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">الأجهزة المستعملة</h1>
                        <p className="text-xs text-muted-foreground">{items.length} جهاز مستعمل</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="flex gap-1 rounded-xl border border-border p-1 bg-muted/30">
                        <button onClick={() => setViewMode('grid')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'grid' ? 'bg-card shadow text-primary border border-border' : 'text-muted-foreground hover:text-foreground'}`}>شبكة</button>
                        <button onClick={() => setViewMode('table')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'table' ? 'bg-card shadow text-primary border border-border' : 'text-muted-foreground hover:text-foreground'}`}>جدول</button>
                    </div>
                    <button onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }}
                        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-md">
                        <Plus className="h-4 w-4" /> إضافة جهاز مستعمل
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الموديل أو السيريال..." className={`${IC} pr-9`} />
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-6 px-4" onClick={() => { setShowForm(false); setEditId(null); }}>
                    <div className="w-full max-w-xl mx-auto rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">{editId ? 'تعديل جهاز مستعمل' : 'إضافة جهاز مستعمل'}</h2>
                            <button onClick={() => { setShowForm(false); setEditId(null); }} className="rounded-lg p-1.5 hover:bg-muted transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <ImageUpload value={form.image} onChange={v => setForm(f => ({ ...f, image: v }))} />
                            <div className="col-span-2">
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">اسم الجهاز *</label>
                                <input data-validation="text-only" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="مثال: iPhone 13" className={IC} />
                            </div>
                            {/* Device Type */}
                            <div className="col-span-2">
                                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">نوع الجهاز</label>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { type: 'mobile', label: 'موبايل', icon: Smartphone },
                                        { type: 'tablet', label: 'تابلت', icon: Monitor },
                                        { type: 'laptop', label: 'لاب توب', icon: Laptop },
                                        { type: 'computer', label: 'كمبيوتر', icon: Monitor },
                                        { type: 'other', label: 'أخرى', icon: Layers },
                                    ].map(({ type, label, icon: Icon }) => (
                                        <button key={type} type="button" onClick={() => setForm(f => ({ ...f, deviceType: type as UsedDeviceType }))}
                                            className={`flex-1 min-w-[80px] rounded-xl border-2 py-2 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${form.deviceType === type ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                                            <Icon className="h-3.5 w-3.5" /> {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground flex items-center gap-1"><AlignLeft className="h-3.5 w-3.5 text-primary" /> وصف الجهاز</label>
                                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="وصف تفصيلي — مميزات الجهاز، ملاحظات البيع..." className={`${IC} resize-none`} />
                            </div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">الموديل</label><input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} className={IC} /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">السيريال</label><input value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} className={IC} /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">اللون</label><input data-validation="text-only" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className={IC} /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">التخزين</label><input value={form.storage} onChange={e => setForm(f => ({ ...f, storage: e.target.value }))} placeholder="128GB" className={IC} /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">الرام</label><input value={form.ram} onChange={e => setForm(f => ({ ...f, ram: e.target.value }))} placeholder="6GB" className={IC} /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">س.شراء (ج.م)</label><input type="number" min={0} value={form.purchasePrice} onChange={e => setForm(f => ({ ...f, purchasePrice: +e.target.value }))} className={IC} /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">سعر البيع (ج.م)</label><input type="number" min={0} value={form.salePrice} onChange={e => setForm(f => ({ ...f, salePrice: +e.target.value }))} className={IC} /></div>
                            <div className="col-span-2">
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">الحالة (وصف المنتج — حر)</label>
                                <textarea value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} rows={2} placeholder="مثال: حالة ممتازة — شاشة خالية من الشقوق — بطارية 89%" className={`${IC} resize-none`} />
                            </div>
                            {form.salePrice > 0 && form.purchasePrice > 0 && (
                                <div className={`col-span-2 rounded-xl border p-3 flex justify-between items-center ${(form.salePrice - form.purchasePrice) >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'}`}>
                                    <span className={`text-sm font-semibold ${(form.salePrice - form.purchasePrice) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>الربح المتوقع</span>
                                    <span className={`text-lg font-extrabold ${(form.salePrice - form.purchasePrice) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{(form.salePrice - form.purchasePrice).toLocaleString()} ج.م</span>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button onClick={handleSubmit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all">
                                <Check className="h-4 w-4" /> {editId ? 'حفظ' : 'إضافة'}
                            </button>
                            <button onClick={() => { setShowForm(false); setEditId(null); }} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Grid View ── */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.length === 0 ? (
                        <div className="col-span-4 py-16 text-center text-muted-foreground">
                            <Archive className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p>لا توجد أجهزة مستعملة</p>
                        </div>
                    ) : filtered.map(item => (
                        <div key={item.id} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft hover:shadow-lg hover:-translate-y-0.5 transition-all">
                            {/* Image */}
                            <div className="relative h-44 w-full bg-muted/30 overflow-hidden">
                                {item.image ? (
                                    <img src={item.image} alt={item.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                    <div className="h-full w-full flex flex-col items-center justify-center gap-2">
                                        <ImageOff className="h-10 w-10 text-muted-foreground/25" />
                                        <span className="text-xs text-muted-foreground/40">لا توجد صورة</span>
                                    </div>
                                )}
                                {/* Condition badge */}
                                {item.condition && (
                                    <span className="absolute bottom-2 right-2 rounded-lg bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 max-w-[80%] truncate">
                                        {item.condition}
                                    </span>
                                )}
                            </div>
                            {/* Content */}
                            <div className="flex flex-col flex-1 p-4 gap-2">
                                <h3 className="font-bold text-foreground leading-snug">{item.name}</h3>
                                <p className="text-xs text-muted-foreground">{[item.model, item.storage, item.ram, item.color].filter(Boolean).join(' | ')}</p>
                                {item.description && (
                                    <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-3 bg-muted/30 rounded-lg px-2.5 py-2 border border-border/40">
                                        <AlignLeft className="inline h-3 w-3 ml-1 text-primary/50" />{item.description}
                                    </p>
                                )}
                                {item.serialNumber && <p className="font-mono text-[10px] text-muted-foreground/60">SN: {item.serialNumber}</p>}
                                <div className="mt-auto flex items-center justify-between pt-2 border-t border-border/40">
                                    <div>
                                        <p className="text-lg font-extrabold text-primary tabular-nums">{item.salePrice.toLocaleString('ar-EG')} ج.م</p>
                                        <p className={`text-xs font-semibold tabular-nums ${(item.salePrice - item.purchasePrice) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            ربح: {(item.salePrice - item.purchasePrice).toLocaleString()} ج.م
                                        </p>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <button onClick={() => startEdit(item)} className="rounded-xl p-2 bg-primary/10 hover:bg-primary/20 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                                        <button onClick={async () => { const ok = await confirm({ title: 'حذف جهاز', message: `هل أنت متأكد من حذف "${item.name}"؟`, confirmLabel: 'حذف', danger: true }); if (ok) { deleteUsedDevice(item.id); toast({ title: '🗑️ تم الحذف' }); refresh(); } }} className="rounded-xl p-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* ── Table View ── */
                <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
                    <div className="overflow-x-auto pb-4">
                        <table className="w-full text-sm min-w-[750px]">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    {['', 'الاسم', 'الموديل', 'السيريال', 'اللون', 'تخزين', 'الحالة', 'س.شراء', 'سعر بيع', 'الربح', ''].map(h => (
                                        <th key={h} className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={11} className="py-12 text-center text-muted-foreground">لا توجد أجهزة مستعملة</td></tr>
                                ) : filtered.map((item, i) => (
                                    <tr key={item.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                                        <td className="px-3 py-2">{item.image ? <img src={item.image} alt={item.name} className="h-10 w-10 rounded-lg object-cover border border-border" /> : <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><ImageOff className="h-4 w-4 text-muted-foreground/40" /></div>}</td>
                                        <td className="px-3 py-3 font-semibold text-foreground">{item.name}</td>
                                        <td className="px-3 py-3 text-xs text-muted-foreground">{item.model || '—'}</td>
                                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{item.serialNumber || '—'}</td>
                                        <td className="px-3 py-3 text-xs text-muted-foreground">{item.color || '—'}</td>
                                        <td className="px-3 py-3 text-xs text-muted-foreground">{item.storage || '—'}</td>
                                        <td className="px-3 py-3 text-xs text-muted-foreground max-w-[120px] truncate" title={item.condition}>{item.condition || '—'}</td>
                                        <td className="px-3 py-3 text-xs text-muted-foreground">{item.purchasePrice.toLocaleString()}</td>
                                        <td className="px-3 py-3 text-xs font-semibold text-foreground">{item.salePrice.toLocaleString()}</td>
                                        <td className={`px-3 py-3 text-xs font-bold ${(item.salePrice - item.purchasePrice) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{(item.salePrice - item.purchasePrice).toLocaleString()}</td>
                                        <td className="px-3 py-3"><div className="flex gap-1">
                                            <button onClick={() => startEdit(item)} className="rounded-lg p-1.5 hover:bg-primary/10 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                                            <button onClick={async () => { const ok = await confirm({ title: 'حذف جهاز', message: `هل أنت متأكد من حذف "${item.name}"؟`, confirmLabel: 'حذف', danger: true }); if (ok) { deleteUsedDevice(item.id); toast({ title: '🗑️ تم الحذف' }); refresh(); } }} className="rounded-lg p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                                        </div></td>
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
