// ============================================================
// PageHeader — ELOS-style gradient animated page title
// Usage: <PageHeader title="نقطة البيع" icon={<ShoppingCart />}
//          subtitle="3 أصناف" actions={<Button>...</Button>} />
// ============================================================

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
    title: string;
    icon?: ReactNode;
    subtitle?: string;
    actions?: ReactNode;
    className?: string;
}

export default function PageHeader({ title, icon, subtitle, actions, className }: PageHeaderProps) {
    return (
        <div className={cn('flex items-center justify-between flex-wrap gap-3 mb-5', className)}>
            {/* Left: icon + title + subtitle */}
            <div className="flex items-center gap-3">
                {icon && (
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0">
                        {icon}
                    </div>
                )}
                <div>
                    <h1
                        className="text-2xl font-black tracking-tight"
                        style={{
                            background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, #a855f7 50%, #06b6d4 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            animation: 'gleamex-title-glow 3s ease-in-out infinite',
                        }}
                    >
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                    )}
                </div>
            </div>

            {actions && (
                <div className="flex items-center gap-2 flex-wrap">
                    {actions}
                </div>
            )}
        </div>
    );
}
