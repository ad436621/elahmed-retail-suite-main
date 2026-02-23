import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
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
  iconGradient = 'from-blue-500/20 to-indigo-500/20',
  iconColor = 'text-blue-500'
}: StatCardProps) => {
  return (
    <div className={cn(
      'group relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 overflow-hidden card-hover cursor-default',
      className
    )}>
      {/* Animated gradient background on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-700" />
      </div>

      {/* Shimmer effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute inset-0 animate-shimmer" />
      </div>

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-bold text-card-foreground tracking-tight">{value}</p>
        </div>
        <div className={cn(
          'relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-3',
          iconGradient
        )}>
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <Icon className={cn('h-6 w-6 transition-all duration-300', iconColor, 'group-hover:drop-shadow-lg')} />
        </div>
      </div>

      {trend && (
        <div className="relative mt-4 flex items-center gap-2">
          <div className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
            trendUp
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
          )}>
            <span className={cn(
              'relative flex h-2 w-2',
            )}>
              <span className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-75',
                trendUp ? 'bg-emerald-400 animate-ping' : 'bg-rose-400 animate-ping'
              )} />
              <span className={cn(
                'relative inline-flex rounded-full h-2 w-2',
                trendUp ? 'bg-emerald-500' : 'bg-rose-500'
              )} />
            </span>
            {trend}
          </div>
        </div>
      )}

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
  );
};

export default StatCard;
