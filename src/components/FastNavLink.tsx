// ============================================================
// Ultra-Fast Navigation Component
// Prefetches data on hover for instant page loads
// ============================================================

import { Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';

interface FastNavLinkProps {
    to: string;
    icon: React.ReactNode;
    label: string;
    badge?: number;
    onClick?: () => void;
}

// Prefetch functions for different routes
const prefetchFunctions: Record<string, () => void> = {
    '/': () => {
        queryClient.prefetchQuery({
            queryKey: queryKeys.dashboard.stats,
            queryFn: async () => {
                const response = await fetch('/api/dashboard/stats');
                return response.json();
            },
        });
    },
    '/inventory': () => {
        queryClient.prefetchQuery({
            queryKey: queryKeys.inventory.all,
            queryFn: async () => {
                const response = await fetch('/api/inventory');
                return response.json();
            },
        });
    },
    '/sales': () => {
        queryClient.prefetchQuery({
            queryKey: queryKeys.sales.today,
            queryFn: async () => {
                const response = await fetch('/api/sales/today');
                return response.json();
            },
        });
    },
    '/pos': () => {
        queryClient.prefetchQuery({
            queryKey: queryKeys.products.all,
            queryFn: async () => {
                const response = await fetch('/api/products');
                return response.json();
            },
        });
    },
};

export function FastNavLink({ to, icon, label, badge, onClick }: FastNavLinkProps) {
    const location = useLocation();
    const isActive = location.pathname === to;

    const handleMouseEnter = useCallback(() => {
        const prefetchFn = prefetchFunctions[to];
        if (prefetchFn) {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => prefetchFn(), { timeout: 1000 });
            } else {
                setTimeout(prefetchFn, 100);
            }
        }
    }, [to]);

    return (
        <Link
            to={to}
            onClick={onClick}
            onMouseEnter={handleMouseEnter}
            className={cn(
                'flex items-center gap-3 px-3 py-2-lg text-sm font-medium rounded-lg transition-all duration-150',
                'hover:bg-accent hover:text-accent-foreground',
                isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground'
            )}
        >
            <span className="w-5 h-5 flex-shrink-0">{icon}</span>
            <span className="flex-1 truncate">{label}</span>
            {badge !== undefined && badge > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-primary text-primary-foreground min-w-[20px] text-center">
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
        </Link>
    );
}

// ============================================================
// Quick Action Button - Optimized for instant feedback
// ============================================================

interface QuickActionButtonProps {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'ghost';
}

export function QuickActionButton({
    icon,
    label,
    onClick,
    variant = 'default'
}: QuickActionButtonProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all duration-150',
                'hover:scale-105 active:scale-95',
                variant === 'default' && 'bg-primary text-primary-foreground hover:bg-primary/90',
                variant === 'outline' && 'border-2 border-border hover:bg-accent',
                variant === 'ghost' && 'hover:bg-accent'
            )}
        >
            <span className="w-8 h-8">{icon}</span>
            <span className="text-sm font-medium">{label}</span>
        </button>
    );
}

export default FastNavLink;
