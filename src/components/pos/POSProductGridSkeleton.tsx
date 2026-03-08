// ============================================================
// POSProductGridSkeleton — Loading placeholder for product grid
// Provides visual feedback during data loading
// Improves perceived performance (skeleton screens)
// ============================================================

import { cn } from '@/lib/utils';

interface POSProductGridSkeletonProps {
    /** Number of skeleton cards to display */
    count?: number;
    /** Grid columns configuration */
    columns?: number;
    /** Additional CSS classes */
    className?: string;
}

export default function POSProductGridSkeleton({
    count = 12,
    columns = 4,
    className
}: POSProductGridSkeletonProps) {
    // Generate array of skeleton items
    const items = Array.from({ length: count }, (_, i) => i);

    // Column class mapping
    const colClass = {
        2: 'grid-cols-2',
        3: 'grid-cols-2 md:grid-cols-3',
        4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
        5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
        6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
    }[columns] || 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

    return (
        <div
            role="status"
            aria-label="جاري تحميل المنتجات"
            className={cn('grid gap-3 pb-6 animate-pulse', colClass, className)}
        >
            {items.map((index) => (
                <div
                    key={index}
                    className="flex flex-col rounded-2xl border border-border/30 bg-card p-4 h-[160px]"
                >
                    {/* Category badge skeleton */}
                    <div className="self-end rounded border border-border/30 bg-muted/30 w-16 h-5 mb-2" />

                    {/* Product name skeleton */}
                    <div className="rounded bg-muted/30 w-full h-4 mb-1" />
                    <div className="rounded bg-muted/30 w-2/3 h-4 mb-2" />

                    {/* Model skeleton */}
                    <div className="rounded bg-muted/20 w-1/2 h-3 mb-auto" />

                    {/* Price skeleton */}
                    <div className="flex items-end justify-between pt-3">
                        <div className="rounded bg-muted/30 w-20 h-6" />
                        <div className="rounded-full bg-muted/20 w-12 h-5" />
                    </div>

                    {/* Stock badge skeleton */}
                    <div className="mt-2 rounded-lg bg-muted/20 w-full h-6" />
                </div>
            ))}

            {/* Screen reader text */}
            <span className="sr-only">جاري تحميل المنتجات...</span>
        </div>
    );
}
