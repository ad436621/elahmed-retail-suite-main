// ============================================================
// AppSidebar — Enterprise-grade navigation sidebar
// Refactored according to global UX standards:
// - Nielsen Norman Group: Visibility, Feedback, Consistency
// - Laws of UX: Fitts's Law, Hicks Law, Jakob's Law
// - WCAG 2.1 AA: Keyboard navigation, Focus indicators
// - Apple HIG & Material Design patterns
// ============================================================

import { useState, useEffect } from 'react';
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
  ChevronRight,
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
  Activity,
  PanelLeftClose,
  PanelLeft,
  Keyboard,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { Permission } from '@/data/usersData';

// ─── Types ──────────────────────────────────────────────────

type NavItem = {
  to: string;
  icon: React.ElementType;
  label: string;
  perm?: Permission;
  badge?: number | string;
};

type NavGroup = {
  id: string;
  title: string;
  icon: React.ElementType;
  items: NavItem[];
  defaultOpen?: boolean;
};

// ─── Navigation Groups Definition ────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'main',
    title: 'الرئيسية',
    icon: LayoutDashboard,
    defaultOpen: true,
    items: [
      { to: '/', icon: LayoutDashboard, label: 'لوحة التحكم', perm: 'dashboard' },
      { to: '/pos', icon: ShoppingCart, label: 'نقطة البيع', perm: 'pos' },
      { to: '/maintenance', icon: Wrench, label: 'الصيانة', perm: 'maintenance' },
      { to: '/reports', icon: BarChart3, label: 'التقارير', perm: 'dashboard' },
    ],
  },
  {
    id: 'inventory',
    title: 'المخازن',
    icon: Package,
    defaultOpen: true,
    items: [
      { to: '/mobiles', icon: Smartphone, label: 'الموبيلات', perm: 'mobiles' },
      { to: '/computers', icon: Monitor, label: 'الكمبيوترات', perm: 'computers' },
      { to: '/devices', icon: Tv, label: 'الأجهزة', perm: 'devices' },
      { to: '/cars', icon: Car, label: 'السيارات', perm: 'cars' },
      { to: '/used-inventory', icon: Package, label: 'المستعمل', perm: 'used' },
      { to: '/maintenance/parts', icon: Wrench, label: 'قطع وأكسسوارات الصيانة', perm: 'maintenance' },
      { to: '/warehouse', icon: Warehouse, label: 'المستودع', perm: 'warehouse' },
      { to: '/stocktake', icon: PackageSearch, label: 'جرد المخزون', perm: 'stocktake' },
      { to: '/barcodes', icon: Barcode, label: 'طباعة الباركود', perm: 'inventory' },
    ],
  },
  {
    id: 'operations',
    title: 'العمليات',
    icon: Cog,
    defaultOpen: false,
    items: [
      { to: '/sales', icon: Receipt, label: 'سجل المبيعات', perm: 'sales' },
      { to: '/installments', icon: FileText, label: 'التقسيط', perm: 'installments' },
      { to: '/returns', icon: RotateCcw, label: 'المرتجعات', perm: 'returns' },
      { to: '/expenses', icon: TrendingDown, label: 'المصروفات', perm: 'expenses' },
      { to: '/damaged', icon: AlertTriangle, label: 'الهالك', perm: 'damaged' },
      { to: '/other-revenue', icon: DollarSign, label: 'أرباح أخرى', perm: 'otherRevenue' },
    ],
  },
  {
    id: 'people',
    title: 'الأشخاص',
    icon: Users,
    defaultOpen: false,
    items: [
      { to: '/customers', icon: UserCheck, label: 'العملاء', perm: 'customers' },
      { to: '/suppliers', icon: Truck, label: 'الموردون', perm: 'suppliers' },
      { to: '/employees', icon: Users, label: 'الموظفين', perm: 'employees' },
      { to: '/partners', icon: Handshake, label: 'الشركاء', perm: 'partners' },
    ],
  },
  {
    id: 'finance',
    title: 'المالية',
    icon: Wallet,
    defaultOpen: false,
    items: [
      { to: '/wallets', icon: Wallet, label: 'المحافظ والخزنة', perm: 'wallets' },
      { to: '/purchase-invoices', icon: FileInput, label: 'فواتير الشراء', perm: 'purchaseInvoices' },
      { to: '/shift-closing', icon: ClipboardCheck, label: 'إقفال الوردية', perm: 'shiftClosing' },
    ],
  },
  {
    id: 'tools',
    title: 'الأدوات',
    icon: Cog,
    defaultOpen: false,
    items: [
      { to: '/blacklist', icon: ShieldAlert, label: 'القائمة السوداء', perm: 'blacklist' },
      { to: '/reminders', icon: Bell, label: 'التذكيرات', perm: 'reminders' },
    ],
  },
];

// ─── Collapsible Group Component ────────────────────────────

interface CollapsibleSectionProps {
  group: NavGroup;
  isOpen: boolean;
  onToggle: () => void;
  filterByPerm: (items: NavItem[]) => NavItem[];
}

function CollapsibleSection({ group, isOpen, onToggle, filterByPerm }: CollapsibleSectionProps) {
  const visible = filterByPerm(group.items);

  if (visible.length === 0) return null;

  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`group-${group.id}`}
        className={cn(
          'flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
          isOpen
            ? 'bg-primary/10 text-primary'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
        )}
      >
        <group.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-start">{group.title}</span>
        <span className="text-sm text-muted-foreground font-normal">
          {visible.length}
        </span>
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200",
            isOpen && "rotate-90"
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          id={`group-${group.id}`}
          role="group"
          aria-label={group.title}
          className="mt-0.5 mr-2 pr-1.5 space-y-0.5 animate-slide-down"
        >
          {visible.map(item => (
            <SidebarNavItem key={item.to} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Single Nav Item Component ──────────────────────────────

interface SidebarNavItemProps {
  item: NavItem;
}

function SidebarNavItem({ item }: SidebarNavItemProps) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
          isActive
            ? 'bg-primary/10 text-primary font-bold'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-full bg-primary rounded-l-full"
              aria-hidden="true"
            />
          )}
          <item.icon
            className={cn(
              'h-5 w-5 shrink-0 transition-colors',
              isActive ? 'text-primary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'
            )}
            aria-hidden="true"
          />
          <span className="truncate flex-1">{item.label}</span>
          {item.badge && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-primary/20 text-[10px] font-bold text-primary">
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

// ─── Main Sidebar Component ────────────────────────────────

const AppSidebar = () => {
  useLanguage();
  const { user, logout, hasPermission, isOwner } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  // Track which groups are expanded
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    NAV_GROUPS.forEach(group => {
      initial[group.id] = group.defaultOpen ?? false;
    });
    return initial;
  });

  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filterByPerm = (items: NavItem[]) =>
    items.filter(item => !item.perm || hasPermission(item.perm));

  // Flatten all navigable items for keyboard navigation
  const allNavItems = NAV_GROUPS.flatMap(group =>
    filterByPerm(group.items)
  );

  // Keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (focusedIndex === -1) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(i => Math.min(i + 1, allNavItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
        case ' ':
          if (focusedIndex >= 0 && focusedIndex < allNavItems.length) {
            e.preventDefault();
            navigate(allNavItems[focusedIndex].to);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, allNavItems, navigate]);

  // Close all groups when collapsing
  useEffect(() => {
    if (isCollapsed) {
      setExpandedGroups({});
    }
  }, [isCollapsed]);

  return (
    <aside
      className={cn(
        "hidden md:flex h-screen flex-col bg-sidebar-background border-e border-sidebar-border/60 shrink-0 relative transition-all duration-300",
        isCollapsed ? "w-[56px]" : "w-[200px]"
      )}
      dir="rtl"
      role="navigation"
      aria-label="القائمة الجانبية"
    >
      {/* ─── Header: Logo + Branch + User ─── */}
      <div className={cn(
        "px-2 py-2 border-b border-sidebar-border/40 transition-all duration-300",
        isCollapsed ? "px-1.5 py-2" : ""
      )}>
        {/* Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? "توسيع القائمة" : "طي القائمة"}
          className={cn(
            "flex items-center justify-center rounded-lg mb-3 transition-all",
            isCollapsed ? "w-full" : "",
            "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          )}
        >
          {isCollapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4 mr-2" />
              <span className="text-xs font-medium">طي</span>
            </>
          )}
        </button>

        {!isCollapsed && (
          <>
            {/* Company logo + name */}
            <div className="flex items-center gap-2">
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
              </div>
            </div>

            {/* Logged-in user badge */}
            {user && (
              <div className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg bg-sidebar-accent/40 border border-sidebar-border/30 mt-1.5">
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
          </>
        )}
      </div>

      {/* ─── Navigation ─── */}
      <nav
        className={cn(
          "flex-1 px-1.5 py-1.5 overflow-y-auto space-y-0.5 scrollbar-thin",
          isCollapsed ? "px-1" : ""
        )}
        role="menubar"
        aria-label="التنقل الرئيسي"
      >
        {isCollapsed ? (
          // Collapsed view: Icons that navigate to the first page of each group
          <div className="space-y-0.5">
            {NAV_GROUPS.map(group => {
              const visible = filterByPerm(group.items);
              if (visible.length === 0) return null;

              // Check if any item in this group is active
              const isGroupActive = visible.some(item =>
                item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
              );

              return (
                <div key={group.id} className="relative group">
                  <NavLink
                    to={visible[0].to}
                    aria-label={group.title}
                    className={cn(
                      "flex w-full items-center justify-center p-2 rounded-xl transition-all relative",
                      isGroupActive
                        ? "bg-primary/10 text-primary"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    )}
                  >
                    {isGroupActive && (
                      <div
                        className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-l-full"
                        aria-hidden="true"
                      />
                    )}
                    <group.icon className="h-5 w-5" />
                  </NavLink>

                  {/* Tooltip on hover — RTL: appears on left side */}
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 bg-foreground text-background text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                    {group.title}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-foreground" />
                  </div>
                </div>
              );
            })}

            {/* Divider */}
            <div className="h-px bg-sidebar-border/30 my-2" />

            {/* System items in collapsed mode */}
            {hasPermission('settings') && (
              <div className="relative group">
                <NavLink
                  to="/settings"
                  aria-label="الإعدادات"
                  className={({ isActive }) => cn(
                    "flex w-full items-center justify-center p-2 rounded-xl transition-all relative",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  )}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-l-full" aria-hidden="true" />
                      )}
                      <Settings className="h-5 w-5" />
                    </>
                  )}
                </NavLink>
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 bg-foreground text-background text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  الإعدادات
                </div>
              </div>
            )}
            {isOwner() && (
              <div className="relative group">
                <NavLink
                  to="/users"
                  aria-label="إدارة المستخدمين"
                  className={({ isActive }) => cn(
                    "flex w-full items-center justify-center p-2 rounded-xl transition-all relative",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  )}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-l-full" aria-hidden="true" />
                      )}
                      <Users className="h-5 w-5" />
                    </>
                  )}
                </NavLink>
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 bg-foreground text-background text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  إدارة المستخدمين
                </div>
              </div>
            )}
          </div>
        ) : (
          // Expanded view
          <>
            {NAV_GROUPS.map(group => (
              <CollapsibleSection
                key={group.id}
                group={group}
                isOpen={expandedGroups[group.id] ?? false}
                onToggle={() => toggleGroup(group.id)}
                filterByPerm={filterByPerm}
              />
            ))}
          </>
        )}

        {/* Divider */}
        <div className="h-px bg-sidebar-border/30 my-2" />

        {/* System Items — expanded only */}
        {!isCollapsed && (
          <>
            {hasPermission('settings') && (
              <SidebarNavItem item={{ to: '/settings', icon: Settings, label: 'الإعدادات', perm: 'settings' }} />
            )}
            {isOwner() && (
              <SidebarNavItem item={{ to: '/users', icon: Users, label: 'إدارة المستخدمين' }} />
            )}
            {isOwner() && (
              <SidebarNavItem item={{ to: '/diagnostics', icon: Activity, label: 'تشخيص النظام' }} />
            )}
            <SidebarNavItem item={{ to: '/help', icon: BookOpen, label: 'المساعدة والدليل' }} />
          </>
        )}
      </nav>

      {/* ─── Footer ─── */}
      <div className={cn(
        "border-t border-sidebar-border/40 transition-all duration-300",
        isCollapsed ? "px-1.5 py-2" : "px-2 py-1.5"
      )}>
        {!isCollapsed ? (
          <>
            {/* Logout */}
            <button
              onClick={handleLogout}
              aria-label="تسجيل الخروج"
              className={cn(
                "flex w-full items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold",
                "text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-500/20",
                "bg-rose-50/60 dark:bg-rose-500/10",
                "hover:bg-rose-100 dark:hover:bg-rose-500/20 hover:border-rose-300 dark:hover:border-rose-500/30",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400",
                "transition-colors"
              )}
            >
              <LogOutIcon className="h-3.5 w-3.5" />
              <span>تسجيل الخروج</span>
            </button>

            <p className="text-[9px] text-sidebar-foreground/25 text-center mt-2">
              الإصدار 3.1.0 • {new Date().getFullYear()}
            </p>
          </>
        ) : (
          <button
            onClick={handleLogout}
            aria-label="تسجيل الخروج"
            className={cn(
              "flex w-full items-center justify-center p-2 rounded-lg",
              "text-rose-600 dark:text-rose-400",
              "hover:bg-rose-50 dark:hover:bg-rose-500/10",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400",
              "transition-colors"
            )}
          >
            <LogOutIcon className="h-5 w-5" />
          </button>
        )}
      </div>
    </aside>
  );
};

export default AppSidebar;
