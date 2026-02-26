import { useState, useMemo, useRef } from 'react';
import { Printer, Search, Check, X, SlidersHorizontal, Tag, Barcode } from 'lucide-react';
import { getAllInventoryProducts } from '@/repositories/productRepository';
import { getMobiles } from '@/data/mobilesData';
import { getComputers } from '@/data/computersData';
import { getDevices } from '@/data/devicesData';
import { useSettings } from '@/contexts/SettingsContext';

/* ─── Unified print item ─── */
interface PrintItem {
    id: string;
    name: string;
    barcode: string;
    price?: number;
    category: string;
    source: string;
}

/* ─── Print label (6×3 cm) ─── */
function PrintLabel({ name, barcode, price, category, copies, companyName }: {
    name: string; barcode: string; price?: number;
    category?: string; copies: number; companyName: string;
}) {
    return (
        <>
            {Array.from({ length: copies }).map((_, ci) => (
                <div key={ci} style={{
                    width: '6cm', height: '3cm', border: '1px solid #000', borderRadius: '4px',
                    padding: '4px 6px', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'space-between',
                    fontFamily: 'Arial, sans-serif', pageBreakInside: 'avoid',
                    boxSizing: 'border-box', backgroundColor: '#fff', color: '#000',
                }}>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', fontSize: '7px', fontWeight: 'bold' }}>
                        <span>{companyName}</span>
                        {category && <span style={{ color: '#555' }}>{category}</span>}
                    </div>
                    <div style={{ fontSize: '9px', fontWeight: 'bold', textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {name}
                    </div>
                    <InlineSVGBarcode value={barcode} width={140} height={28} />
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', fontSize: '7px' }}>
                        <span style={{ fontFamily: 'monospace' }}>{barcode}</span>
                        {price !== undefined && <span style={{ fontWeight: 'bold', color: '#c00' }}>{price.toLocaleString('ar-EG')} ج.م</span>}
                    </div>
                </div>
            ))}
        </>
    );
}

/* ─── Inline SVG barcode ─── */
function InlineSVGBarcode({ value, width = 140, height = 28 }: { value: string; width?: number; height?: number }) {
    const bars: { x: number; w: number }[] = [];
    if (value) {
        const pattern: number[] = [2, 1, 1, 2, 1, 1];
        for (let i = 0; i < value.length; i++) {
            const c = value.charCodeAt(i);
            pattern.push(((c >> 0) & 3) + 1, ((c >> 2) & 1) + 1, ((c >> 3) & 3) + 1, ((c >> 5) & 1) + 1, ((c >> 1) & 3) + 1, ((c >> 4) & 1) + 1);
        }
        pattern.push(2, 1, 1, 1, 2, 1, 2);
        const total = pattern.reduce((s, p) => s + p, 0);
        const unit = (width - 10) / total;
        let x = 5;
        pattern.forEach((u, idx) => {
            if (idx % 2 === 0) bars.push({ x, w: Math.max(u * unit, 0.5) });
            x += u * unit;
        });
    }
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
            {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={height - 2} fill="#000" />)}
        </svg>
    );
}

/* ─── Main page ─── */
export default function BarcodePrintPage() {
    const { settings } = useSettings();

    // Aggregate all inventory sources
    const allItems = useMemo<PrintItem[]>(() => {
        const items: PrintItem[] = [];

        // 1. Main inventory products (have dedicated barcode field)
        getAllInventoryProducts().filter(p => p.barcode).forEach(p => items.push({
            id: p.id,
            name: p.name,
            barcode: p.barcode,
            price: p.sellingPrice,
            category: p.category || 'عام',
            source: 'مخزون',
        }));

        // 2. Mobiles — name = "name color storage"
        getMobiles().forEach(m => {
            const label = [m.name, m.color, m.storage].filter(Boolean).join(' ').trim();
            items.push({
                id: `mob-${m.id}`,
                name: label || 'موبايل',
                barcode: `GX-M-${m.id.slice(-8).toUpperCase()}`,
                price: m.salePrice || undefined,
                category: 'موبيلات',
                source: 'موبيلات',
            });
        });

        // 3. Computers — fields: name, model, salePrice
        getComputers().forEach(c => {
            const label = [c.name, c.model].filter(Boolean).join(' ').trim();
            items.push({
                id: `comp-${c.id}`,
                name: label || 'كمبيوتر',
                barcode: `GX-C-${c.id.slice(-8).toUpperCase()}`,
                price: c.salePrice || undefined,
                category: 'كمبيوتر',
                source: 'كمبيوتر',
            });
        });

        // 4. Devices — fields: name, model, salePrice
        getDevices().forEach(d => {
            const label = [d.name, d.model].filter(Boolean).join(' ').trim();
            items.push({
                id: `dev-${d.id}`,
                name: label || 'جهاز',
                barcode: `GX-D-${d.id.slice(-8).toUpperCase()}`,
                price: d.salePrice || undefined,
                category: 'أجهزة',
                source: 'أجهزة',
            });
        });

        return items;
    }, []);

    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [copies, setCopies] = useState<Record<string, number>>({});
    const [labelsPerRow, setLabelsPerRow] = useState(3);
    const [showPrice, setShowPrice] = useState(true);
    const [sourceFilter, setSourceFilter] = useState('الكل');
    const printRef = useRef<HTMLDivElement>(null);

    const filtered = useMemo(() =>
        allItems.filter(p =>
            (sourceFilter === 'الكل' || p.source === sourceFilter) &&
            (p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.barcode.toLowerCase().includes(search.toLowerCase()) ||
                p.category.toLowerCase().includes(search.toLowerCase()))
        ), [allItems, search, sourceFilter]
    );

    const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const selectAll = () => setSelected(new Set(filtered.map(p => p.id)));
    const clearAll = () => setSelected(new Set());
    const getCopies = (id: string) => copies[id] ?? 1;
    const setCopy = (id: string, n: number) => setCopies(c => ({ ...c, [id]: Math.max(1, n) }));

    const selectedItems = allItems.filter(p => selected.has(p.id));
    const totalLabels = selectedItems.reduce((s, p) => s + getCopies(p.id), 0);
    const sources = ['الكل', ...Array.from(new Set(allItems.map(p => p.source)))];

    const sourceColors: Record<string, string> = {
        'مخزون': 'bg-blue-500/10 text-blue-400',
        'موبيلات': 'bg-cyan-500/10 text-cyan-400',
        'كمبيوتر': 'bg-indigo-500/10 text-indigo-400',
        'أجهزة': 'bg-amber-500/10 text-amber-400',
    };

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;
        const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<title>طباعة الباركود</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: white; font-family: Arial, sans-serif; }
.grid { display: grid; grid-template-columns: repeat(${labelsPerRow}, 6cm); gap: 4px; padding: 8px; }
@media print { @page { size: A4; margin: 10mm; } }
</style></head><body><div class="grid">${content.innerHTML}</div></body></html>`;
        const win = window.open('', '_blank', 'width=900,height=700');
        if (!win) return;
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 400);
    };

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                        <Barcode className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">طباعة الباركود</h1>
                        <p className="text-xs text-muted-foreground">{allItems.length} منتج • {totalLabels} تسمية محددة</p>
                    </div>
                </div>
                <button
                    onClick={handlePrint}
                    disabled={selected.size === 0}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <Printer className="h-4 w-4" />
                    طباعة {totalLabels > 0 ? `(${totalLabels} تسمية)` : ''}
                </button>
            </div>

            {/* Options */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-3 shadow-soft">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">في الصف:</span>
                    {[2, 3, 4].map(n => (
                        <button key={n} onClick={() => setLabelsPerRow(n)}
                            className={`h-7 w-7 rounded-lg text-xs font-bold transition-all ${labelsPerRow === n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                            {n}
                        </button>
                    ))}
                </div>
                <div className="h-5 w-px bg-border" />
                <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground">
                    <input type="checkbox" checked={showPrice} onChange={e => setShowPrice(e.target.checked)} className="accent-primary" />
                    إظهار السعر
                </label>
                <div className="h-5 w-px bg-border" />
                <div className="flex items-center gap-1 flex-wrap">
                    {sources.map(s => (
                        <button key={s} onClick={() => setSourceFilter(s)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${sourceFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search + bulk actions */}
            <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="بحث بالاسم أو الباركود أو الفئة..."
                        className="w-full rounded-xl border border-border/50 bg-card/80 pr-11 pl-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30" />
                </div>
                <button onClick={selectAll} className="rounded-xl border border-border/50 bg-card/80 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> تحديد الكل
                </button>
                <button onClick={clearAll} className="rounded-xl border border-border/50 bg-card/80 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors flex items-center gap-2">
                    <X className="h-4 w-4 text-muted-foreground" /> إلغاء
                </button>
            </div>

            {/* Grid */}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.length === 0 ? (
                    <div className="col-span-3 py-12 text-center text-muted-foreground">لا توجد منتجات</div>
                ) : filtered.map(p => {
                    const isSel = selected.has(p.id);
                    return (
                        <div key={p.id} onClick={() => toggle(p.id)}
                            className={`relative flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${isSel ? 'border-primary/50 bg-primary/5 shadow-md shadow-primary/10' : 'border-border/50 bg-card/80 hover:border-primary/30 hover:bg-muted/30'}`}>
                            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${isSel ? 'border-primary bg-primary' : 'border-border'}`}>
                                {isSel && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <div className="bg-white rounded-lg p-1.5 border border-border/30">
                                <InlineSVGBarcode value={p.barcode} width={90} height={22} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                                <p className="text-[10px] text-muted-foreground font-mono truncate">{p.barcode}</p>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${sourceColors[p.source] || 'bg-primary/10 text-primary'}`}>
                                        {p.source}
                                    </span>
                                    <span className="inline-flex items-center gap-0.5 rounded-md bg-muted/50 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                                        <Tag className="h-2.5 w-2.5" />{p.category}
                                    </span>
                                    {p.price !== undefined && (
                                        <span className="text-[10px] text-muted-foreground">{p.price.toLocaleString('ar-EG')} ج.م</span>
                                    )}
                                </div>
                            </div>
                            {isSel && (
                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => setCopy(p.id, getCopies(p.id) - 1)} className="h-6 w-6 rounded-md bg-muted hover:bg-muted/80 text-foreground text-xs font-bold flex items-center justify-center">−</button>
                                    <span className="min-w-[1.5rem] text-center text-xs font-bold text-foreground">{getCopies(p.id)}</span>
                                    <button onClick={() => setCopy(p.id, getCopies(p.id) + 1)} className="h-6 w-6 rounded-md bg-muted hover:bg-muted/80 text-foreground text-xs font-bold flex items-center justify-center">+</button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Hidden print source */}
            <div ref={printRef} style={{ display: 'none' }}>
                {selectedItems.map(p => (
                    <PrintLabel key={p.id} name={p.name} barcode={p.barcode}
                        price={showPrice ? p.price : undefined} category={p.category}
                        copies={getCopies(p.id)} companyName={settings.companyName || 'GX GLEAMEX'} />
                ))}
            </div>
        </div>
    );
}
