// ============================================================
// POSProductGrid — Enhanced with keyboard navigation
// Changes from original:
//   - Arrow key navigation between cards
//   - Enter/Space to add product
//   - Focus ring management
//   - Out-of-stock: dimmed, not clickable, cursor-not-allowed
//   - role="button" + keyboard Enter/Space to add
//   - Empty state with contextual icon
//   - Price margin color coding
//   - Responsive grid layout
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { Smartphone, Tv, Car, Headphones } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Product } from '@/domain/types';
import type { TabId, SubMode } from './CategoryNavPanel';

interface POSProductGridProps {
    products: Product[];
    onAdd: (product: Product) => void;
    cartProductIds: Set<string>;
    selectedTab: TabId;
    subMode: SubMode;
}

function EmptyState({ selectedTab, subMode }: { selectedTab: TabId; subMode: SubMode }) {
    const Icon =
        selectedTab === 'cars' ? Car
            : subMode === 'accessories' ? Headphones
                : selectedTab === 'devices' ? Tv
                    : Smartphone;

    const label =
        selectedTab === 'cars' ? 'لا توجد سيارات متاحة'
            : subMode === 'accessories' ? 'لا توجد إكسسوارات متاحة'
                : selectedTab === 'devices' ? 'لا توجد أجهزة متاحة'
                    : 'لا توجد موبيلات متاحة';

    return (
        <div className="h-full flex flex-col justify-center items-center text-muted-foreground/40 py-16" aria-live="polite">
            <Icon className="h-16 w-16 mb-4" aria-hidden="true" />
            <p className="font-bold text-lg text-muted-foreground/50">{label}</p>
            <p className="text-sm opacity-70 mt-1">جرب تغيير التصنيف أو كلمة البحث</p>
        </div>
    );
}

// Calculate responsive grid columns
function getGridCols(): string {
    if (typeof window === 'undefined') return 'grid-cols-2';
    if (window.innerWidth >= 1536) return 'grid-cols-6';
    if (window.innerWidth >= 1280) return 'grid-cols-5';
    if (window.innerWidth >= 1024) return 'grid-cols-4';
    if (window.innerWidth >= 768) return 'grid-cols-3';
    return 'grid-cols-2';
}

// Calculate columns for keyboard navigation
function getColCount(): number {
    if (typeof window === 'undefined') return 2;
    if (window.innerWidth >= 1536) return 6;
    if (window.innerWidth >= 1280) return 5;
    if (window.innerWidth >= 1024) return 4;
    if (window.innerWidth >= 768) return 3;
    return 2;
}

export default function POSProductGrid({ products, onAdd, cartProductIds, selectedTab, subMode }: POSProductGridProps) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [gridCols, setGridCols] = useState(getGridCols());
    const gridRef = useRef<HTMLDivElement>(null);
    const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    // Update grid columns on resize
    useEffect(() => {
        const handleResize = () => {
            setGridCols(getGridCols());
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (products.length === 0) {
        return <EmptyState selectedTab={selectedTab} subMode={subMode} />;
    }

    // Keyboard navigation handler
    const handleKeyDown = useCallback((e: React.KeyboardEvent, product: Product, index: number) => {
        const cols = getColCount();

        switch (e.key) {
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (product.quantity > 0) {
                    onAdd(product);
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                // RTL: Arrow Right = previous item (visually moves right = backwards)
                setSelectedIndex(i => Math.max(i - 1, 0));
                break;
            case 'ArrowLeft':
                e.preventDefault();
                // RTL: Arrow Left = next item (visually moves left = forward)
                setSelectedIndex(i => Math.min(i + 1, products.length - 1));
                break;
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + cols, products.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - cols, 0));
                break;
            case 'Home':
                e.preventDefault();
                setSelectedIndex(0);
                break;
            case 'End':
                e.preventDefault();
                setSelectedIndex(products.length - 1);
                break;
            case 'PageDown':
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + cols * 3, products.length - 1));
                break;
            case 'PageUp':
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - cols * 3, 0));
                break;
        }
    }, [products.length, onAdd]);

    // Scroll selected item into view
    useEffect(() => {
        const cardEl = cardRefs.current.get(selectedIndex);
        if (cardEl) {
            cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedIndex]);

    return (
        <div
            ref={gridRef}
            role="list"
            aria-label="قائمة المنتجات"
            aria-activedescendant={`product-${selectedIndex}`}
            className={cn('grid gap-3 pb-6', gridCols)}
        >
            {products.map((p: Product, index: number) => {
                const outOfStock = p.quantity === 0;
                const inCart = cartProductIds.has(p.id);
                const lowStock = p.quantity > 0 && p.quantity <= 5;

                // Calculate margin for color coding
                const margin = p.sellingPrice > 0
                    ? ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100
                    : 0;
                const marginColor = margin > 20
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : margin > 10
                        ? 'text-foreground'
                        : margin > 0
                            ? 'text-amber-600 dark:text-amber-500'
                            : 'text-red-500';

                return (
                    <div
                        key={p.id}
                        id={`product-${index}`}
                        ref={(el) => {
                            if (el) cardRefs.current.set(index, el as HTMLDivElement);
                        }}
                        role="listitem"
                        aria-selected={selectedIndex === index}
                    >
                        <div
                            role="button"
                            tabIndex={selectedIndex === index ? 0 : -1}
                            aria-disabled={outOfStock}
                            aria-label={`${p.name} — ${p.sellingPrice.toLocaleString('ar-EG')} جنيه${outOfStock ? ' — نفد المخزون' : inCart ? ' — في السلة' : ''}`}
                            onClick={() => !outOfStock && onAdd(p)}
                            onKeyDown={(e) => handleKeyDown(e, p, index)}
                            onFocus={() => setSelectedIndex(index)}
                            className={cn(
                                'flex flex-col rounded-2xl border p-4 shadow-sm transition-all select-none h-full cursor-pointer',
                                outOfStock
                                    ? 'opacity-40 cursor-not-allowed border-border/40 bg-card'
                                    : inCart
                                        ? 'border-blue-400/60 bg-blue-50/30 dark:bg-blue-500/5 hover:shadow-md hover:border-blue-500/70'
                                        : selectedIndex === index
                                            ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary ring-offset-2'
                                            : 'border-border/60 bg-white dark:bg-card hover:shadow-md hover:border-blue-400/50 hover:scale-[1.01] active:scale-[0.99]',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
                            )}
                        >
                            {/* Category badge */}
                            <span className="self-end rounded border border-gray-200 bg-gray-50 dark:border-border dark:bg-muted/40 text-muted-foreground px-2 py-0.5 text-[10px] font-bold mb-2 truncate max-w-full">
                                {p.category}
                            </span>

                            {/* Product name */}
                            <h3 className="font-bold text-foreground line-clamp-2 min-h-[36px] leading-tight text-sm">
                                {p.name}
                            </h3>

                            {/* Model */}
                            {p.model && (
                                <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{p.model}</p>
                            )}

                            {/* Price with margin indicator */}
                            <div className="mt-auto pt-3 flex items-end justify-between">
                                <span className={cn('text-lg font-black tabular-nums leading-none', marginColor)}>
                                    {p.sellingPrice.toLocaleString('ar-EG')}
                                    <span className="text-xs font-medium text-muted-foreground ml-0.5">ج.م</span>
                                </span>
                                {inCart && !outOfStock && (
                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-100 dark:bg-blue-500/20 rounded px-1.5 py-0.5">في السلة</span>
                                )}
                            </div>

                            {/* Stock badge */}
                            <div className={cn(
                                'mt-2 rounded-lg px-2 py-1 text-[10px] font-bold text-center',
                                outOfStock
                                    ? 'bg-red-50 dark:bg-red-500/10 text-red-500'
                                    : lowStock
                                        ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600'
                                        : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
                            )}>
                                {outOfStock ? 'نفذ من المخزون' : lowStock ? `متبقي: ${p.quantity} فقط` : `المخزون: ${p.quantity}`}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
