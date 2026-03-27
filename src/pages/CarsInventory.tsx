import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Pencil, X, Check, Car, Search, ImagePlus, ImageOff, AlignLeft, LayoutGrid, List, FileSpreadsheet, Wrench, Fuel, Download } from 'lucide-react';
import { exportToExcel, CAR_COLUMNS, prepareConditionForExport } from '@/services/excelService';
import { CarItem } from '@/domain/types';
import { getCars, addCar, updateCar, deleteCar, getNewCars, getUsedCars, getCarsCapital, getCarsProfit } from '@/data/carsData';
import { loadCats, saveCats } from '@/data/categoriesData';
import { useToast } from '@/hooks/use-toast';
import { ExcelColumnMappingDialog } from '@/components/ExcelColumnMappingDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/components/ConfirmDialog';

const emptyForm: Omit<CarItem, 'id' | 'createdAt' | 'updatedAt'> = {
    name: '', model: '', year: new Date().getFullYear(), color: '',
    plateNumber: '', licenseExpiry: '', condition: 'new', category: '',
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

// ─── Categories Manager ───────────────────────────────────────
function CarsCategoriesManager({
    cats, onSave, onClose,
}: {
    cats: string[];
    onSave: (cats: string[]) => void;
    onClose: () => void;
}) {
    const [list, setList] = useState<string[]>([...cats]);
    const [newName, setNewName] = useState('');
    const [editIdx, setEditIdx] = useState<number | null>(null);
    const [editVal, setEditVal] = useState('');

    const addCat = () => {
        const n = newName.trim();
        if (!n || list.includes(n)) return;
        setList(l => [...l, n]);
        setNewName('');
    };
    const deleteCat = (idx: number) => {
        setList(l => l.filter((_, i) => i !== idx));
        if (editIdx === idx) setEditIdx(null);
    };
    const startEdit = (idx: number) => { setEditIdx(idx); setEditVal(list[idx]); };
    const saveEdit = () => {
        if (editIdx === null) return;
        const n = editVal.trim();
        if (!n) return;
        if (list.filter((_, i) => i !== editIdx).includes(n)) return;
        setList(l => l.map((c, i) => i === editIdx ? n : c));
        setEditIdx(null);
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={onClose}>
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl animate-scale-in overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2">
                        <Car className="h-5 w-5 text-emerald-600" />
                        <h3 className="text-base font-bold">إدارة تصنيفات السيارات</h3>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
                </div>
                <div className="px-5 pt-4 pb-3 flex gap-2">
                    <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCat()} placeholder="اسم التصنيف الجديد..." className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" autoFocus />
                    <button onClick={addCat} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition"><Plus className="h-4 w-4" /></button>
                </div>
                <div className="px-5 pb-4 space-y-1.5 max-h-64 overflow-y-auto">
                    {list.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">لا توجد تصنيفات بعد</p>}
                    {list.map((cat, idx) => (
                        <div key={idx} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 group hover:border-emerald-500/30 transition-colors">
                            {editIdx === idx ? (
                                <input value={editVal} onChange={e => setEditVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditIdx(null); }} className="flex-1 rounded-lg border border-emerald-500/40 px-2 py-1 text-sm focus:outline-none bg-background" autoFocus />
                            ) : (
                                <span className="flex-1 text-sm font-medium text-foreground">{cat}</span>
                            )}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {editIdx === idx ? (
                                    <>
                                        <button onClick={saveEdit} className="rounded-md p-1 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600"><Check className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => setEditIdx(null)} className="rounded-md p-1 hover:bg-muted text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => startEdit(idx)} className="rounded-md p-1 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600"><Pencil className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => deleteCat(idx)} className="rounded-md p-1 hover:bg-red-50 dark:hover:bg-red-500/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2 px-5 pb-5">
                    <button onClick={() => onSave(list)} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition"><Check className="h-4 w-4" /> حفظ التصنيفات</button>
                    <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition">إلغاء</button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default function CarsInventory() {
    const { toast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const [categories, setCategories] = useState<string[]>(() => loadCats('cars_cats', ['سيدان', 'SUV', 'هاتشباك', 'نقل', 'ميكروباص']));
    const [showCatManager, setShowCatManager] = useState(false);
    const [catFilter, setCatFilter] = useState('الكل');
    const [items, setItems] = useState<CarItem[]>(() => getCars());
    const [tab, setTab] = useState<'new' | 'used'>('new');
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [showExcelRestore, setShowExcelRestore] = useState(false);
    const { user } = useAuth();
    const { confirm } = useConfirm();

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
            condition: item.condition, category: item.category ?? '', purchasePrice: item.purchasePrice,
            salePrice: item.salePrice, notes: item.notes, image: item.image,
        });
        setEditId(item.id);
        setShowForm(true);
    };

    const handleSaveCats = (updated: string[]) => {
        saveCats('cars_cats', updated);
        setCategories(updated);
        setShowCatManager(false);
        toast({ title: '✅ تم حفظ تصنيفات السيارات', description: `${updated.length} تصنيف` });
    };

    const filtered = items.filter(i =>
        (tab === 'new' ? i.condition === 'new' : i.condition === 'used') &&
        (catFilter === 'الكل' || i.category === catFilter) &&
        (i.name.toLowerCase().includes(search.toLowerCase()) ||
            i.model.toLowerCase().includes(search.toLowerCase()) ||
            i.plateNumber.includes(search))
    );

    const totalCapital = getCarsCapital();
    const totalProfit = getCarsProfit();

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">

            {/* ═══ Sub-section Navigation ═══ */}
            <div className="flex gap-2 flex-wrap">
                <button onClick={() => navigate('/cars')}
                    className="flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white shadow-md ring-2 ring-sky-300 ring-offset-1">
                    <Car className="h-4 w-4" /> السيارات
                </button>
                <button onClick={() => navigate('/cars/spare-parts')}
                    className="flex items-center gap-2 rounded-xl bg-muted px-5 py-2.5 text-sm font-bold text-muted-foreground hover:bg-red-600 hover:text-white transition-all shadow-sm">
                    <Wrench className="h-4 w-4" /> قطع الغيار
                </button>
                <button onClick={() => navigate('/cars/oils')}
                    className="flex items-center gap-2 rounded-xl bg-muted px-5 py-2.5 text-sm font-bold text-muted-foreground hover:bg-amber-600 hover:text-white transition-all shadow-sm">
                    <Fuel className="h-4 w-4" /> الزيوت
                </button>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/20">
                        <Car className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">السيارات</h1>
                        <p className="text-xs text-muted-foreground">{getNewCars().length} جديدة • {getUsedCars().length} مستعملة</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-2">
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">رأس المال</p>
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{totalCapital.toLocaleString('ar-EG')} ج.م</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-4 py-2">
                        <p className="text-xs text-blue-600 dark:text-blue-400">الأرباح</p>
                        <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{totalProfit.toLocaleString('ar-EG')} ج.م</p>
                    </div>
                    <div className="flex gap-1 rounded-xl border border-border p-1 bg-muted/30">
                        <button onClick={() => setViewMode('grid')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'grid' ? 'bg-card shadow text-primary border border-border' : 'text-muted-foreground'}`}>شبكة</button>
                        <button onClick={() => setViewMode('table')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'table' ? 'bg-card shadow text-primary border border-border' : 'text-muted-foreground'}`}>جدول</button>
                    </div>
                    <button onClick={() => setShowCatManager(true)} className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all shadow-sm">
                        التصنيفات ({categories.length})
                    </button>
                    <button onClick={() => { setShowForm(true); setEditId(null); setForm({ ...emptyForm, condition: tab }); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-md">
                        <Plus className="h-4 w-4" /> إضافة سيارة
                    </button>
                    <button onClick={() => setShowExcelRestore(true)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-md">
                        <FileSpreadsheet className="h-4 w-4" /> استرداد من Excel
                    </button>
                    <button onClick={() => exportToExcel({ data: prepareConditionForExport(items), columns: CAR_COLUMNS, fileName: 'السيارات' })} className="flex items-center gap-2 rounded-xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all shadow-md">
                        <Download className="h-4 w-4" /> تصدير Excel
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 rounded-2xl bg-muted/50 p-1 w-fit border border-border/50">
                <button onClick={() => setTab('new')} className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all ${tab === 'new' ? 'bg-card shadow-sm text-primary border border-border' : 'text-muted-foreground'}`}>جديدة</button>
                <button onClick={() => setTab('used')} className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all ${tab === 'used' ? 'bg-card shadow-sm text-primary border border-border' : 'text-muted-foreground'}`}>مستعملة</button>
            </div>

            {categories.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => setCatFilter('الكل')} className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all shadow-sm border ${catFilter === 'الكل' ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30' : 'bg-card text-muted-foreground border-border hover:bg-muted/50'}`}>الكل</button>
                    {categories.map(c => (
                        <button key={c} onClick={() => setCatFilter(c)} className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all shadow-sm border ${catFilter === c ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30' : 'bg-card text-muted-foreground border-border hover:bg-muted/50'}`}>{c}</button>
                    ))}
                </div>
            )}

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الموديل أو رقم اللوحة..." className={`${IC} pr-9`} />
            </div>

            {/* Form Modal */}
            {showForm && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-6 px-4" onClick={() => { setShowForm(false); setEditId(null); }}>
                    <div className="w-full max-w-xl mx-auto rounded-2xl border border-border bg-card shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>

                        {/* ── Modal Header ── */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20">
                                    <Car className="h-4 w-4 text-sky-600" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-foreground">{editId ? '✏️ تعديل سيارة' : '➕ إضافة سيارة جديدة'}</h2>
                                    <p className="text-xs text-muted-foreground">مخزون السيارات</p>
                                </div>
                            </div>
                            <button onClick={() => { setShowForm(false); setEditId(null); }} className="rounded-xl p-2 hover:bg-muted text-muted-foreground transition-colors"><X className="h-5 w-5" /></button>
                        </div>

                        {/* ── Modal Body ── */}
                        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                            <ImageUpload value={form.image} onChange={v => setForm(f => ({ ...f, image: v }))} />

                            {/* Section 1: Basic Info */}
                            <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
                                    معلومات أساسية
                                </p>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-foreground/80">اسم السيارة <span className="text-destructive">*</span></label>
                                    <input data-validation="text-only" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="مثال: تويوتا كامري" className={IC} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-foreground/80">الموديل</label>
                                        <input data-validation="text-only" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="SE" className={IC} />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-foreground/80">اللون</label>
                                        <input data-validation="text-only" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className={IC} />
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Classification & Details */}
                            <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500 inline-block" />
                                    التصنيف والتفاصيل
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-foreground/80">سنة الصنع</label>
                                        <input type="number" min={1990} max={new Date().getFullYear() + 1} value={form.year} onChange={e => setForm(f => ({ ...f, year: +e.target.value }))} className={IC} />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-foreground/80">رقم اللوحة</label>
                                        <input value={form.plateNumber} onChange={e => setForm(f => ({ ...f, plateNumber: e.target.value }))} className={IC} />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-foreground/80">انتهاء الرخصة</label>
                                        <input type="date" value={form.licenseExpiry} onChange={e => setForm(f => ({ ...f, licenseExpiry: e.target.value }))} className={IC} />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-foreground/80">الحالة</label>
                                        <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value as 'new' | 'used' }))} className={IC}>
                                            <option value="new">جديدة</option>
                                            <option value="used">مستعملة</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="mb-1.5 block text-xs font-semibold text-foreground/80">التصنيف</label>
                                        <select value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={IC}>
                                            <option value="">-- تصنيف السيارة --</option>
                                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Pricing */}
                            <div className="rounded-xl border border-border/50 bg-gradient-to-l from-primary/5 to-transparent p-4 space-y-3">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                                    التسعير
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-foreground/80">سعر الشراء</label>
                                        <input type="number" min={0} value={form.purchasePrice} onChange={e => setForm(f => ({ ...f, purchasePrice: +e.target.value }))} className={IC} placeholder="0" />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-foreground/80">سعر البيع</label>
                                        <input type="number" min={0} value={form.salePrice} onChange={e => setForm(f => ({ ...f, salePrice: +e.target.value }))} className={IC} placeholder="0" />
                                    </div>
                                </div>
                                {form.salePrice > 0 && form.purchasePrice > 0 && (() => {
                                    const profit = form.salePrice - form.purchasePrice;
                                    const isPos = profit >= 0;
                                    return (
                                        <div className={`rounded-xl border p-3 flex justify-between items-center ${isPos ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'}`}>
                                            <span className="text-sm font-semibold">{isPos ? '✅ الربح المتوقع' : '⚠️ خسارة متوقعة'}</span>
                                            <span className="text-xl font-extrabold">{profit.toLocaleString('ar-EG')} ج.م</span>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-foreground/80">ملاحظات</label>
                                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${IC} resize-none`} placeholder="أي ملاحظات..." />
                            </div>
                        </div>

                        {/* ── Modal Footer ── */}
                        <div className="flex gap-3 px-6 py-4 border-t border-border bg-muted/20 rounded-b-2xl">
                            <button onClick={handleSubmit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 py-2.5 text-sm font-bold text-white shadow-md hover:bg-sky-700 hover:shadow-lg transition-all">
                                <Check className="h-4 w-4" /> {editId ? 'حفظ التعديلات' : 'إضافة السيارة'}
                            </button>
                            <button onClick={() => { setShowForm(false); setEditId(null); }} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">إلغاء</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Content */}
            {showCatManager && <CarsCategoriesManager cats={categories} onSave={handleSaveCats} onClose={() => setShowCatManager(false)} />}
            
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
                                <p className="text-xs text-muted-foreground">{[item.category, item.model, item.year, item.color].filter(Boolean).join(' • ')}</p>
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
                                        <button onClick={async () => { const ok = await confirm({ title: 'حذف سيارة', message: `هل أنت متأكد من حذف "${item.name}"؟`, confirmLabel: 'حذف', danger: true }); if (ok) { deleteCar(item.id); toast({ title: '🗑️ تم الحذف' }); refresh(); } }} className="rounded-xl p-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
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
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">التصنيف</th>
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
                                <tr><td colSpan={10} className="py-12 text-center text-muted-foreground">لا توجد سيارات</td></tr>
                            ) : filtered.map((item, i) => (
                                <tr key={item.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                                    <td className="px-4 py-3 font-semibold text-foreground">{item.name}</td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.category || '—'}</td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.model || '—'}</td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.year}</td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.plateNumber || '—'}</td>
                                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${item.condition === 'new' ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'}`}>{item.condition === 'new' ? 'جديدة' : 'مستعملة'}</span></td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.purchasePrice.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-sm font-bold text-foreground">{item.salePrice.toLocaleString()}</td>
                                    <td className={`px-4 py-3 text-xs font-bold ${(item.salePrice - item.purchasePrice) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{(item.salePrice - item.purchasePrice).toLocaleString()}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            <button onClick={() => startEdit(item)} className="rounded-lg p-1.5 hover:bg-primary/10 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                                            <button onClick={async () => { const ok = await confirm({ title: 'حذف سيارة', message: `هل أنت متأكد من حذف "${item.name}"؟`, confirmLabel: 'حذف', danger: true }); if (ok) { deleteCar(item.id); toast({ title: '🗑️ تم الحذف' }); refresh(); } }} className="rounded-lg p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
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
                            category: '',
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
