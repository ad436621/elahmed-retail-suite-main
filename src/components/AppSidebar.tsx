import { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Settings,
  RotateCcw,
  Smartphone,
  Monitor,
  Tv,
  Wrench,
  FileText,
  TrendingDown,
  LogOutIcon,
  Users,
  Barcode,
  Car,
  AlertTriangle,
  Warehouse,
  DollarSign,
  ChevronDown,
  Package,
  Cog,
  Wallet,
  UserCheck,
  BookOpen,
  Truck,
  ShieldAlert,
  Bell,
  ClipboardCheck,
  FileInput,
  BarChart3,
  Handshake,
  PackageSearch,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
// theme & language toggles are handled in TopHeader, not sidebar
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { Permission } from '@/data/usersData';

// ─── Types ──────────────────────────────────────────────────

type NavItem = {
  to: string;
  icon: React.ElementType;
  label: string;
  perm?: Permission;
};

type NavGroup = {
  title: string;
  icon: React.ElementType;
  items: NavItem[];
  defaultOpen?: boolean;
};

// ─── Collapsible Section ────────────────────────────────────

function CollapsibleSection({ title, icon: Icon, items, defaultOpen = false, filterByPerm }: NavGroup & { filterByPerm: (items: NavItem[]) => NavItem[] }) {
  const [open, setOpen] = useState(defaultOpen);
  const visible = filterByPerm(items);
  if (visible.length === 0) return null;

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200"
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-right">{title}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-0.5 mr-3 border-r-2 border-sidebar-border/40 pr-2 space-y-0.5 animate-slide-down">
          {visible.map(item => (
            <SidebarNavItem key={item.to} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Single Nav Item ────────────────────────────────────────

function SidebarNavItem({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-primary/10 text-primary font-bold'
            : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-l-full" />
          )}
          <item.icon className={cn('h-[18px] w-[18px] shrink-0 transition-colors', isActive ? 'text-primary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80')} />
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

// ─── Main Sidebar ───────────────────────────────────────────

const AppSidebar = () => {
  useLanguage(); // keeps context alive (language direction)
  const { user, logout, hasPermission, isOwner } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  // Single nav items (always visible at top)
  const topNav: NavItem[] = [
    { to: '/', icon: LayoutDashboard, label: 'الرئيسية', perm: 'dashboard' },
    { to: '/pos', icon: ShoppingCart, label: 'نقطة البيع', perm: 'pos' },
    { to: '/maintenance', icon: Wrench, label: 'الصيانة', perm: 'maintenance' },
    { to: '/reports', icon: BarChart3, label: 'التقارير', perm: 'dashboard' },
  ];

  // Collapsible groups
  const navGroups: NavGroup[] = [
    {
      title: 'المخازن',
      icon: Package,
      defaultOpen: true,
      items: [
        { to: '/mobiles', icon: Smartphone, label: 'الموبيلات', perm: 'mobiles' },
        { to: '/computers', icon: Monitor, label: 'الكمبيوترات', perm: 'computers' },
        { to: '/devices', icon: Tv, label: 'الأجهزة', perm: 'devices' },
        { to: '/cars', icon: Car, label: 'السيارات', perm: 'cars' },
        { to: '/used-inventory', icon: Package, label: 'المستعمل', perm: 'used' },
        { to: '/warehouse', icon: Warehouse, label: 'المستودع', perm: 'warehouse' },
        { to: '/stocktake', icon: PackageSearch, label: 'جرد المخزون', perm: 'stocktake' },
        { to: '/barcodes', icon: Barcode, label: 'طباعة الباركود', perm: 'inventory' },
      ],
    },
    {
      title: 'العمليات',
      icon: Cog,
      defaultOpen: false,
      items: [
        { to: '/installments', icon: FileText, label: 'التقسيط', perm: 'installments' },
        { to: '/expenses', icon: TrendingDown, label: 'المصروفات', perm: 'expenses' },
        { to: '/damaged', icon: AlertTriangle, label: 'الهالك', perm: 'damaged' },
        { to: '/other-revenue', icon: DollarSign, label: 'أرباح أخرى', perm: 'otherRevenue' },
        { to: '/returns', icon: RotateCcw, label: 'المرتجعات', perm: 'returns' },
        { to: '/customers', icon: UserCheck, label: 'إدارة العملاء', perm: 'customers' },
      ],
    },
    {
      title: 'المبيعات',
      icon: Receipt,
      defaultOpen: false,
      items: [
        { to: '/sales', icon: Receipt, label: 'سجل المبيعات', perm: 'sales' },
      ],
    },
    {
      title: 'الإدارة المالية',
      icon: Wallet,
      defaultOpen: false,
      items: [
        { to: '/wallets', icon: Wallet, label: 'المحافظ والخزنة', perm: 'wallets' },
        { to: '/employees', icon: Users, label: 'الموظفين والرواتب', perm: 'employees' },
      ],
    },
    {
      title: 'الأطراف',
      icon: Truck,
      defaultOpen: false,
      items: [
        { to: '/suppliers', icon: Truck, label: 'الموردون', perm: 'suppliers' },
        { to: '/partners', icon: Handshake, label: 'الشركاء', perm: 'partners' },
      ],
    },
    {
      title: 'المالية المتقدمة',
      icon: FileInput,
      defaultOpen: false,
      items: [
        { to: '/purchase-invoices', icon: FileInput, label: 'فواتير الشراء', perm: 'purchaseInvoices' },
        { to: '/shift-closing', icon: ClipboardCheck, label: 'إقفال الوردية', perm: 'shiftClosing' },
      ],
    },
    {
      title: 'أدوات الإدارة',
      icon: Cog,
      defaultOpen: false,
      items: [
        { to: '/blacklist', icon: ShieldAlert, label: 'القائمة السوداء', perm: 'blacklist' },
        { to: '/reminders', icon: Bell, label: 'التذكيرات', perm: 'reminders' },
      ],
    },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filterByPerm = (items: NavItem[]) =>
    items.filter(item => !item.perm || hasPermission(item.perm));

  return (
    <aside className="hidden md:flex h-screen w-[260px] flex-col bg-sidebar-background border-e border-sidebar-border/60 shrink-0 relative">

      {/* ─── Logo + Branch + User ─── */}
      <div className="px-4 py-3.5 border-b border-sidebar-border/40 space-y-3">

        {/* Company logo + name */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="h-10 w-10 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-sm">
              <img
                src={settings.logoUrl || '/logo.png'}
                alt={settings.companyName || 'GLEAMEX'}
                className="h-full w-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fb = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fb) fb.style.display = 'flex';
                }}
              />
              <span className="text-base font-black text-primary hidden items-center justify-center w-full h-full" style={{ display: 'none' }}>
                GX
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-extrabold text-sidebar-foreground tracking-wide truncate">
              {settings.companyName || 'GLEAMEX'}
            </h1>
            {settings.branchName && (
              <p className="text-[10px] text-sidebar-foreground/55 font-medium truncate">
                {settings.branchName}
              </p>
            )}
            {settings.branchAddress && (
              <p className="text-[10px] text-sidebar-foreground/40 truncate">
                {settings.branchAddress}
              </p>
            )}
          </div>
        </div>

        {/* Logged-in user badge */}
        {user && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-sidebar-accent/40 border border-sidebar-border/30">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-black shrink-0">
              {user.fullName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-sidebar-foreground truncate">{user.fullName}</p>
              <p className="text-[9px] text-sidebar-foreground/45 leading-tight">
                {user.role === 'owner' ? 'مدير النظام' : 'مستخدم'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Navigation ─── */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-1 scrollbar-thin">

        {/* Top-level items (not collapsible) */}
        {filterByPerm(topNav).map(item => (
          <SidebarNavItem key={item.to} item={item} />
        ))}

        {/* Divider */}
        <div className="h-px bg-sidebar-border/30 my-2.5" />

        {/* Collapsible groups */}
        {navGroups.map(group => (
          <CollapsibleSection
            key={group.title}
            {...group}
            filterByPerm={filterByPerm}
          />
        ))}

        {/* Divider */}
        <div className="h-px bg-sidebar-border/30 my-2.5" />

        {/* System */}
        {hasPermission('settings') && (
          <SidebarNavItem item={{ to: '/settings', icon: Settings, label: 'الإعدادات', perm: 'settings' }} />
        )}
        {isOwner() && (
          <SidebarNavItem item={{ to: '/users', icon: Users, label: 'إدارة المستخدمين', perm: 'users' }} />
        )}
        <SidebarNavItem item={{ to: '/help', icon: BookOpen, label: 'المساعدة والدليل' }} />
      </nav>

      {/* ─── Footer ─── */}
      <div className="border-t border-sidebar-border/40 px-3 py-2.5">

        {/* Logout — compact */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-500/20 bg-rose-50/60 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 hover:border-rose-300 dark:hover:border-rose-500/30 transition-colors"
        >
          <LogOutIcon className="h-3.5 w-3.5" />
          <span>تسجيل الخروج</span>
        </button>

        <p className="text-[9px] text-sidebar-foreground/25 text-center mt-2">
          v3.1.0 • {new Date().getFullYear()}
        </p>
      </div>
    </aside>
  );
};

export default AppSidebar;
