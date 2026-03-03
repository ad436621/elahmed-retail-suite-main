import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ELOS color variant system — each variant matches ELOS KPI card colors
export type StatCardVariant = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'cyan' | 'default';

const VARIANT_STYLES: Record<StatCardVariant, {
  border: string;
  iconBg: string;
  valueColor: string;
  glow: string;
  sideBar: string;
}> = {
  blue: { border: 'rgba(59,130,246,0.3)', iconBg: 'rgba(59,130,246,0.12)', valueColor: '#3b82f6', glow: '0 8px 24px rgba(59,130,246,0.15)', sideBar: 'linear-gradient(180deg,#3b82f6,#60a5fa)' },
  green: { border: 'rgba(16,185,129,0.3)', iconBg: 'rgba(16,185,129,0.12)', valueColor: '#10b981', glow: '0 8px 24px rgba(16,185,129,0.15)', sideBar: 'linear-gradient(180deg,#10b981,#34d399)' },
  amber: { border: 'rgba(245,158,11,0.3)', iconBg: 'rgba(245,158,11,0.12)', valueColor: '#f59e0b', glow: '0 8px 24px rgba(245,158,11,0.15)', sideBar: 'linear-gradient(180deg,#f59e0b,#fbbf24)' },
  red: { border: 'rgba(239,68,68,0.3)', iconBg: 'rgba(239,68,68,0.12)', valueColor: '#ef4444', glow: '0 8px 24px rgba(239,68,68,0.15)', sideBar: 'linear-gradient(180deg,#ef4444,#f87171)' },
  purple: { border: 'rgba(139,92,246,0.3)', iconBg: 'rgba(139,92,246,0.12)', valueColor: '#8b5cf6', glow: '0 8px 24px rgba(139,92,246,0.15)', sideBar: 'linear-gradient(180deg,#8b5cf6,#a78bfa)' },
  cyan: { border: 'rgba(6,182,212,0.3)', iconBg: 'rgba(6,182,212,0.12)', valueColor: '#06b6d4', glow: '0 8px 24px rgba(6,182,212,0.15)', sideBar: 'linear-gradient(180deg,#06b6d4,#22d3ee)' },
  default: { border: 'rgba(255,255,255,0.08)', iconBg: 'rgba(255,255,255,0.08)', valueColor: 'hsl(var(--foreground))', glow: 'var(--shadow-md)', sideBar: 'hsl(var(--primary))' },
};

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
  variant?: StatCardVariant;
  // Legacy props — kept for backward compatibility
  iconGradient?: string;
  iconColor?: string;
}

const StatCard = ({
  title,
  value,
  icon: Icon,
  trend,
  trendUp,
  className,
  variant = 'default',
  iconColor = 'text-blue-500',
}: StatCardProps) => {
  const v = VARIANT_STYLES[variant];

  return (
    <div
      className={cn(
        'group relative rounded-2xl bg-card/80 backdrop-blur-sm p-5 overflow-hidden cursor-default transition-all duration-300',
        className
      )}
      style={{
        border: `1px solid ${v.border}`,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = v.glow;
        (e.currentTarget as HTMLDivElement).style.borderColor = v.border.replace('0.3', '0.6');
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = '';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '';
        (e.currentTarget as HTMLDivElement).style.borderColor = v.border;
      }}
    >
      {/* ELOS left-side color bar */}
      <div
        className="absolute top-0 right-0 w-1 h-full rounded-l-sm"
        style={{ background: v.sideBar }}
      />

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{title}</p>
          <p
            className="text-3xl font-black tracking-tight"
            style={{ color: variant === 'default' ? undefined : v.valueColor }}
          >
            {value}
          </p>
        </div>

        {/* Icon box with ELOS-style colored background ring */}
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110',
            variant === 'default' ? 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20' : ''
          )}
          style={variant !== 'default' ? { background: v.iconBg, border: `1px solid ${v.border}` } : {}}
        >
          <Icon
            className={cn('h-5 w-5', variant === 'default' ? iconColor : '')}
            style={variant !== 'default' ? { color: v.valueColor } : {}}
          />
        </div>
      </div>

      {trend && (
        <div className="relative mt-3 flex items-center gap-2">
          <div className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
            trendUp
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-rose-500/10 text-rose-500'
          )}>
            <span className="relative flex h-2 w-2">
              <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping', trendUp ? 'bg-emerald-400' : 'bg-rose-400')} />
              <span className={cn('relative inline-flex rounded-full h-2 w-2', trendUp ? 'bg-emerald-500' : 'bg-rose-500')} />
            </span>
            {trend}
          </div>
        </div>
      )}

      {/* Bottom gradient accent */}
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${v.valueColor.startsWith('#') ? v.valueColor : 'hsl(var(--primary))'}, transparent)` }}
      />
    </div>
  );
};

export { StatCard };
export default StatCard;
