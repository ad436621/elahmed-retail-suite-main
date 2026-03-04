import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Trash2, Pencil, X, Check, Car, Search, ImagePlus, ImageOff, AlignLeft, LayoutGrid, List, FileSpreadsheet } from 'lucide-react';
import { CarItem } from '@/domain/types';
import { getCars, addCar, updateCar, deleteCar, getNewCars, getUsedCars, getCarsCapital, getCarsProfit } from '@/data/carsData';
import { useToast } from '@/hooks/use-toast';
import { ExcelColumnMappingDialog } from '@/components/ExcelColumnMappingDialog';
import { useAuth } from '@/contexts/AuthContext';

const emptyForm: Omit<CarItem, 'id' | 'createdAt' | 'updatedAt'> = {
    name: '', model: '', year: new Date().getFullYear(), color: '',
    plateNumber: '', licenseExpiry: '', condition: 'new',
    purchasePrice: 0, salePrice: 0, notes: '', image: undefined,
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
        <div>
            <label className="mb-2 block text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <ImagePlus className="h-3.5 w-3.5 text-primary" /> صورة السيارة
            </label>
            <div className="flex items-center gap-3">
                <div className="shrink-0">
                    {value ? (
                        <div className="relative h-24 w-24 rounded-xl overflow-hidden border-2 border-primary/40 shadow">
                            <img src={value} alt="صورة" className="h-full w-full object-cover" />
                            <button type="button" onClick={() => onChange(undefined)} className="absolute top-1 right-1 rounded-full bg-red-500 p-0.5 text-white shadow hover:bg-red-600">
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ) : (
                        <div className="h-24 w-24 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center">
                            <ImageOff className="h-7 w-7 text-muted-foreground/40" />
                        </div>
                    )}
                </div>
                <div className="flex-1">
                    <button type="button" onClick={() => ref.current?.click()} className="w-full rounded-xl border border-dashed border-primary/40 bg-primary/5 py-3 text-sm font-medium text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-2">
                        <ImagePlus className="h-4 w-4" />{value ? 'تغيير الصورة' : 'اختر صورة'}
                    </button>
                </div>
                <input ref={ref} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </div>
        </div>
    );
}

export default function CarsInventory() {
    const { toast } = useToast();
    const location = useLocation();
    const [items, setItems] = useState<CarItem[]>(() => getCars());
    const [tab, setTab] = useState<'new' | 'used'>('new');
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [showExcelRestore, setShowExcelRestore] = useState(false);
    const { user } = useAuth();

    // Read navigation state from Dashboard
    useEffect(() => {
        const s = (location.state as { tab?: string } | null);
        if (s?.tab === 'used') setTab('used');
        else if (s?.tab === 'new' || s?.tab === 'all') setTab('new');
    }, [location.state]);

    const refresh = () => setItems(getCars());

    const handleSubmit = () => {
        if (!form.name.trim()) {
            toast({ title: 'خطأ', description: 'اسم السيارة مطلوب', variant: 'destructive' });
            return;
        }
        if (editId) {
            updateCar(editId, form);
            toast({ title: '✅ تم التعديل' });
        } else {
            addCar(form);
            toast({ title: '✅ تمت الإضافة', description: form.name });
        }
        setForm(emptyForm);
        setEditId(null);
        setShowForm(false);
        refresh();
    };

    const startEdit = (item: CarItem) => {
        setForm({
            name: item.name, model: item.model, year: item.year, color: item.color,
            plateNumber: item.plateNumber, licenseExpiry: item.licenseExpiry,
            condition: item.condition, purchasePrice: item.purchasePrice,
            salePrice: item.salePrice, notes: item.notes, image: item.image,
        });
        setEditId(item.id);
        setShowForm(true);
    };

    const filtered = items.filter(i =>
        (tab === 'new' ? i.condition === 'new' : i.condition === 'used') &&
        (i.name.toLowerCase().includes(search.toLowerCase()) ||
            i.model.toLowerCase().includes(search.toLowerCase()) ||
            i.plateNumber.includes(search))
    );

    const totalCapital = getCarsCapital();
    const totalProfit = getCarsProfit();

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 border border-emerald-200">
                        <Car className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">السيارات</h1>
                        <p className="text-xs text-muted-foreground">{getNewCars().length} جديدة • {getUsedCars().length} مستعملة</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2">
                        <p className="text-xs text-emerald-600">رأس المال</p>
                        <p className="text-lg font-bold text-emerald-700">{totalCapital.toLocaleString('ar-EG')} ج.م</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-2">
                        <p className="text-xs text-blue-600">الأرباح</p>
                        <p className="text-lg font-bold text-blue-700">{totalProfit.toLocaleString('ar-EG')} ج.م</p>
                    </div>
                    <div className="flex gap-1 rounded-xl border border-border p-1 bg-muted/30">
                        <button onClick={() => setViewMode('grid')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'grid' ? 'bg-card shadow text-primary border border-border' : 'text-muted-foreground'}`}>شبكة</button>
                        <button onClick={() => setViewMode('table')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'table' ? 'bg-card shadow text-primary border border-border' : 'text-muted-foreground'}`}>جدول</button>
                    </div>
                    <button onClick={() => { setShowForm(true); setEditId(null); setForm({ ...emptyForm, condition: tab }); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-md">
                        <Plus className="h-4 w-4" /> إضافة سيارة
                    </button>
                    <button onClick={() => setShowExcelRestore(true)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-md">
                        <FileSpreadsheet className="h-4 w-4" /> استرداد من Excel
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 rounded-2xl bg-muted/50 p-1 w-fit border border-border/50">
                <button onClick={() => setTab('new')} className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all ${tab === 'new' ? 'bg-card shadow-sm text-primary border border-border' : 'text-muted-foreground'}`}>جديدة</button>
                <button onClick={() => setTab('used')} className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all ${tab === 'used' ? 'bg-card shadow-sm text-primary border border-border' : 'text-muted-foreground'}`}>مستعملة</button>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الموديل أو رقم اللوحة..." className={`${IC} pr-9`} />
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-6 px-4">
                    <div className="w-full max-w-xl mx-auto rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">{editId ? 'تعديل سيارة' : 'إضافة سيارة'}</h2>
                            <button onClick={() => { setShowForm(false); setEditId(null); }} className="rounded-lg p-1.5 hover:bg-muted transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
                        </div>
                        <div className="space-y-3">
                            <ImageUpload value={form.image} onChange={v => setForm(f => ({ ...f, image: v }))} />
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">اسم السيارة *</label>
                                    <input data-validation="text-only" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="مثال: تويوتا كامري" className={IC} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">الموديل</label>
                                    <input data-validation="text-only" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="SE" className={IC} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">سنة الصنع</label>
                                    <input type="number" min={1990} max={new Date().getFullYear() + 1} value={form.year} onChange={e => setForm(f => ({ ...f, year: +e.target.value }))} className={IC} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">اللون</label>
                                    <input data-validation="text-only" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className={IC} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">رقم اللوحة</label>
                                    <input value={form.plateNumber} onChange={e => setForm(f => ({ ...f, plateNumber: e.target.value }))} className={IC} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">انتهاء الرخصة</label>
                                    <input type="date" value={form.licenseExpiry} onChange={e => setForm(f => ({ ...f, licenseExpiry: e.target.value }))} className={IC} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">الحالة</label>
                                    <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value as 'new' | 'used' }))} className={IC}>
                                        <option value="new">جديدة</option>
                                        <option value="used">مستعملة</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">سعر الشراء</label>
                                    <input type="number" min={0} value={form.purchasePrice} onChange={e => setForm(f => ({ ...f, purchasePrice: +e.target.value }))} className={IC} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">سعر البيع</label>
                                    <input type="number" min={0} value={form.salePrice} onChange={e => setForm(f => ({ ...f, salePrice: +e.target.value }))} className={IC} />
                                </div>
                                {form.salePrice > 0 && form.purchasePrice > 0 && (
                                    <div className="col-span-2 rounded-xl border p-3 flex justify-between items-center" style={{ backgroundColor: (form.salePrice - form.purchasePrice) >= 0 ? '#f0fdf4' : '#fef2f2', borderColor: (form.salePrice - form.purchasePrice) >= 0 ? '#bbf7d0' : '#fecaca' }}>
                                        <span className="text-sm font-semibold" style={{ color: (form.salePrice - form.purchasePrice) >= 0 ? '#16a34a' : '#dc2626' }}>الربح المتوقع</span>
                                        <span className="text-lg font-extrabold" style={{ color: (form.salePrice - form.purchasePrice) >= 0 ? '#16a34a' : '#dc2626' }}>{(form.salePrice - form.purchasePrice).toLocaleString()} ج.م</span>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground flex items-center gap-1"><AlignLeft className="h-3.5 w-3.5 text-primary" /> ملاحظات</label>
                                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${IC} resize-none`} />
                            </div>
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

            {/* Content */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.length === 0 ? (
                        <div className="col-span-4 py-16 text-center text-muted-foreground">
                            <Car className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p>لا توجد سيارات {tab === 'new' ? 'جديدة' : 'مستعملة'}</p>
                        </div>
                    ) : filtered.map(item => (
                        <div key={item.id} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft hover:shadow-lg hover:-translate-y-0.5 transition-all">
                            <div className="relative h-44 w-full bg-muted/30 overflow-hidden">
                                {item.image ? (
                                    <img src={item.image} alt={item.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                    <div className="h-full w-full flex flex-col items-center justify-center gap-2">
                                        <ImageOff className="h-10 w-10 text-muted-foreground/25" />
                                    </div>
                                )}
                                <span className={`absolute top-2 right-2 rounded-full px-2.5 py-0.5 text-xs font-bold ${item.condition === 'new' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                                    {item.condition === 'new' ? 'جديدة' : 'مستعملة'}
                                </span>
                            </div>
                            <div className="flex flex-col flex-1 p-4 gap-2">
                                <h3 className="font-bold text-foreground">{item.name}</h3>
                                <p className="text-xs text-muted-foreground">{[item.model, item.year, item.color].filter(Boolean).join(' • ')}</p>
                                {item.plateNumber && <p className="text-xs text-muted-foreground">رقم اللوحة: {item.plateNumber}</p>}
                                <div className="mt-auto flex items-center justify-between pt-2 border-t border-border/40">
                                    <div>
                                        <p className="text-lg font-extrabold text-primary">{item.salePrice.toLocaleString('ar-EG')} ج.م</p>
                                        <p className={`text-xs font-semibold ${(item.salePrice - item.purchasePrice) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            ربح: {(item.salePrice - item.purchasePrice).toLocaleString()} ج.م
                                        </p>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <button onClick={() => startEdit(item)} className="rounded-xl p-2 bg-primary/10 hover:bg-primary/20 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => { deleteCar(item.id); toast({ title: 'تم الحذف' }); refresh(); }} className="rounded-xl p-2 bg-red-50 hover:bg-red-100 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">السيارة</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">موديل</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">سنة</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">رقم اللوحة</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الحالة</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">س.شراء</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">س.بيع</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الربح</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={9} className="py-12 text-center text-muted-foreground">لا توجد سيارات</td></tr>
                            ) : filtered.map((item, i) => (
                                <tr key={item.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                                    <td className="px-4 py-3 font-semibold text-foreground">{item.name}</td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.model || '—'}</td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.year}</td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.plateNumber || '—'}</td>
                                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${item.condition === 'new' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{item.condition === 'new' ? 'جديدة' : 'مستعملة'}</span></td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.purchasePrice.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-sm font-bold text-foreground">{item.salePrice.toLocaleString()}</td>
                                    <td className={`px-4 py-3 text-xs font-bold ${(item.salePrice - item.purchasePrice) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{(item.salePrice - item.purchasePrice).toLocaleString()}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            <button onClick={() => startEdit(item)} className="rounded-lg p-1.5 hover:bg-primary/10 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                                            <button onClick={() => { deleteCar(item.id); toast({ title: 'تم الحذف' }); refresh(); }} className="rounded-lg p-1.5 hover:bg-red-50 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Excel Restore Dialog */}
            <ExcelColumnMappingDialog
                open={showExcelRestore}
                onOpenChange={setShowExcelRestore}
                inventoryType="car"
                onSuccess={() => {
                    refresh();
                }}
                onDataSave={(data) => {
                    data.forEach(row => {
                        const car: Omit<CarItem, 'id' | 'createdAt' | 'updatedAt'> = {
                            name: row.name || '',
                            model: row.model || '',
                            year: Number(row.year) || new Date().getFullYear(),
                            color: row.color || '',
                            plateNumber: row.plateNumber || '',
                            licenseExpiry: row.licenseExpiry || '',
                            condition: row.condition || 'new',
                            purchasePrice: Number(row.purchasePrice) || 0,
                            salePrice: Number(row.salePrice) || 0,
                            notes: row.notes || '',
                        };
                        addCar(car);
                    });
                }}
            />
        </div>
    );
}
