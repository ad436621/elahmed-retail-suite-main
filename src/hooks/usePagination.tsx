// ============================================================
// usePagination — Hook for simple client-side pagination
// #23 FIX: Added to Sales.tsx, Installments.tsx, Maintenance.tsx
// ============================================================

import { useState, useMemo } from 'react';

export interface PaginationResult<T> {
    page: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    paginatedItems: T[];
    setPage: (page: number) => void;
    nextPage: () => void;
    prevPage: () => void;
    reset: () => void;
}

/**
 * Simple client-side pagination hook.
 * @param items Full array of items to paginate
 * @param pageSize Number of items per page (default: 30)
 */
export function usePagination<T>(items: T[], pageSize = 30): PaginationResult<T> {
    const [page, setPageState] = useState(1);

    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

    // Clamp page number if items shrink
    const clampedPage = Math.min(page, totalPages);

    const paginatedItems = useMemo(() => {
        const start = (clampedPage - 1) * pageSize;
        return items.slice(start, start + pageSize);
    }, [items, clampedPage, pageSize]);

    const setPage = (p: number) => setPageState(Math.max(1, Math.min(p, totalPages)));
    const nextPage = () => setPage(clampedPage + 1);
    const prevPage = () => setPage(clampedPage - 1);
    const reset = () => setPageState(1);

    return {
        page: clampedPage,
        totalPages,
        totalItems: items.length,
        pageSize,
        paginatedItems,
        setPage,
        nextPage,
        prevPage,
        reset,
    };
}

// ── Pagination UI Component ───────────────────────────────────
interface PaginationBarProps {
    page: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    onPrev: () => void;
    onNext: () => void;
    onPage: (p: number) => void;
}

export function PaginationBar({ page, totalPages, totalItems, pageSize, onPrev, onNext, onPage }: PaginationBarProps) {
    if (totalPages <= 1) return null;

    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalItems);

    // Generate page numbers to show (max 7 buttons)
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        pages.push(1);
        if (page > 3) pages.push('...');
        for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
        if (page < totalPages - 2) pages.push('...');
        pages.push(totalPages);
    }

    return (
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-border/30" dir="rtl">
            <p className="text-xs text-muted-foreground">
                عرض <span className="font-bold text-foreground">{start}–{end}</span> من <span className="font-bold text-foreground">{totalItems}</span> سجل
            </p>

            <div className="flex items-center gap-1">
                <button
                    onClick={onPrev} disabled={page === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-card text-xs font-bold text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    ›
                </button>

                {pages.map((p, i) =>
                    p === '...' ? (
                        <span key={`ellipsis-${i}`} className="text-xs text-muted-foreground px-1">...</span>
                    ) : (
                        <button
                            key={p}
                            onClick={() => onPage(p as number)}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors ${page === p
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'border border-border/60 bg-card text-muted-foreground hover:bg-muted'
                                }`}>
                            {p}
                        </button>
                    )
                )}

                <button
                    onClick={onNext} disabled={page === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-card text-xs font-bold text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    ‹
                </button>
            </div>
        </div>
    );
}
