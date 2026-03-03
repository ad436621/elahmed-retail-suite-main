// ============================================================
// ELAHMED RETAIL OS — Settings Section Card
// Shared primitive extracted from SettingsPage.tsx
// ============================================================

import React from 'react';

interface SectionCardProps {
    icon: React.ReactNode;
    title: string;
    desc?: string;
    children: React.ReactNode;
    color?: string;
}

/**
 * A styled card wrapper used across all SettingsPage tabs.
 * Provides a consistent icon + title header with colored icon box.
 */
const SectionCard = ({
    icon,
    title,
    desc,
    children,
    color = 'bg-primary/10 text-primary',
}: SectionCardProps) => (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 ${color}`}>
                {icon}
            </div>
            <div>
                <h3 className="text-sm font-bold text-foreground">{title}</h3>
                {desc && <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
            </div>
        </div>
        {children}
    </div>
);

export default SectionCard;
