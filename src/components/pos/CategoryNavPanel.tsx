// ============================================================
// CategoryNavPanel — Unified category selection panel for POS
// Merges: main tab buttons, sub-mode toggle, condition filter,
// and brand/category chips into ONE component.
// Reduces cognitive load from 4 separate UI rows → 2 rows.
// ============================================================

import { Smartphone, Tv, Car, Send, Headphones } from 'lucide-react';
import { cn } from '@/lib/utils';

export const TABS = [
    { id: 'mobiles', label: 'الموبيلات', icon: Smartphone },
    { id: 'devices', label: 'الأجهزة', icon: Tv },
    { id: 'cars', label: 'السيارات', icon: Car },
    { id: 'transfers', label: 'تحويلات', icon: Send },
] as const;

export type TabId = typeof TABS[number]['id'];
export type SubMode = 'main' | 'accessories';
export type ConditionFilter = 'all' | 'new' | 'used';

interface CategoryNavPanelProps {
    selectedTab: TabId;
    onTabChange: (tab: TabId) => void;
    subMode: SubMode;
    onSubModeChange: (mode: SubMode) => void;
    conditionFilter: ConditionFilter;
    onConditionChange: (f: ConditionFilter) => void;
    chips: string[];
    selectedChip: string;
    onChipChange: (chip: string) => void;
    productCount: number;
    filteredCount: number;
}

export default function CategoryNavPanel({
    selectedTab,
    onTabChange,
    subMode,
    onSubModeChange,
    conditionFilter,
    onConditionChange,
    chips,
    selectedChip,
    onChipChange,
    productCount,
    filteredCount,
}: CategoryNavPanelProps) {
    const showSubMode = selectedTab === 'mobiles' || selectedTab === 'devices';
    const showCondition =
        (selectedTab === 'mobiles' && subMode === 'main') ||
        (selectedTab === 'devices' && subMode === 'main') ||
        selectedTab === 'cars';

    return (
        <div className="space-y-2 mb-3">

            {/* ── Row 1: Main category tabs ── */}
            <div role="tablist" aria-label="فئات المنتجات" className="grid grid-cols-4 gap-1.5">
                {TABS.map(tab => {
                    const isActive = selectedTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            role="tab"
                            aria-selected={isActive}
                            aria-controls={`tabpanel-${tab.id}`}
                            id={`tab-${tab.id}`}
                            onClick={() => onTabChange(tab.id)}
                            className={cn(
                                'flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 active:scale-[0.97]',
                                isActive
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'bg-card text-muted-foreground hover:bg-muted/60 border border-border/60'
                            )}
                        >
                            <tab.icon className="h-4 w-4" aria-hidden="true" />
                            <span>{tab.label}</span>
                            {isActive && selectedTab !== 'transfers' && (
                                <span className="text-[9px] font-black opacity-80 leading-none">{filteredCount}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── Row 2: Sub-mode + Condition (combined into one row when both visible) ── */}
            {selectedTab !== 'transfers' && (
                <div className="flex gap-1.5">
                    {/* Sub-mode: main vs accessories */}
                    {showSubMode && (
                        <div
                            role="group"
                            aria-label="نوع المنتج"
                            className="flex rounded-xl bg-muted/40 border border-border/40 p-0.5"
                        >
                            <button
                                role="radio"
                                aria-checked={subMode === 'main'}
                                onClick={() => onSubModeChange('main')}
                                className={cn(
                                    'flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                    subMode === 'main' ? 'bg-blue-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {selectedTab === 'mobiles' ? <Smartphone className="h-3 w-3" aria-hidden="true" /> : <Tv className="h-3 w-3" aria-hidden="true" />}
                                {selectedTab === 'mobiles' ? 'موبيلات' : 'أجهزة'}
                            </button>
                            <button
                                role="radio"
                                aria-checked={subMode === 'accessories'}
                                onClick={() => onSubModeChange('accessories')}
                                className={cn(
                                    'flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                    subMode === 'accessories' ? 'bg-blue-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <Headphones className="h-3 w-3" aria-hidden="true" />
                                إكسسوارات
                            </button>
                        </div>
                    )}

                    {/* Condition filter */}
                    {showCondition && (
                        <div role="group" aria-label="حالة المنتج" className="flex gap-1 flex-1">
                            {(['all', 'new', 'used'] as ConditionFilter[]).map(c => (
                                <button
                                    key={c}
                                    role="radio"
                                    aria-checked={conditionFilter === c}
                                    onClick={() => onConditionChange(c)}
                                    className={cn(
                                        'flex-1 rounded-xl px-2 py-1.5 text-xs font-bold transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                        conditionFilter === c
                                            ? c === 'used'
                                                ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-500/40'
                                                : c === 'new'
                                                    ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40'
                                                    : 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-card border-border/60 text-muted-foreground hover:bg-muted/50'
                                    )}
                                >
                                    {c === 'all' ? 'الكل' : c === 'new' ? 'جديد' : 'مستعمل'}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Row 3: Brand / Category chips ── */}
            {chips.length > 0 && selectedTab !== 'transfers' && (
                <div
                    role="group"
                    aria-label="تصفية حسب الماركة أو الفئة"
                    className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide"
                >
                    {chips.map(chip => (
                        <button
                            key={chip}
                            role="radio"
                            aria-checked={selectedChip === chip}
                            onClick={() => onChipChange(chip)}
                            className={cn(
                                'rounded-xl px-4 py-1.5 text-xs font-bold whitespace-nowrap transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                selectedChip === chip
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-white dark:bg-card border border-border/60 text-muted-foreground hover:bg-muted/50'
                            )}
                        >
                            {chip}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
