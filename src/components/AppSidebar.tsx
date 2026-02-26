import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Settings,
  Moon,
  Sun,
  RotateCcw,
  Store,
  Smartphone,
  Monitor,
  Tv,
  Wrench,
  FileText,
  TrendingDown,
  Languages,
  LogOutIcon,
  Users,
  Barcode,
  Archive,
  Car,
  AlertTriangle,
  Warehouse,
  DollarSign,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { Permission } from '@/data/usersData';

const AppSidebar = () => {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user, logout, hasPermission, isOwner } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  // Nav item type — permission is optional; if omitted the item is always shown
  type NavItem = {
    to: string;
    icon: React.ElementType;
    label: string;
    gradient: string;
    iconColor: string;
    perm?: Permission;
  };

  const mainNav: NavItem[] = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard'), gradient: 'from-blue-500/20 to-indigo-500/20', iconColor: 'text-blue-400', perm: 'dashboard' },
    { to: '/pos', icon: ShoppingCart, label: t('nav.pos'), gradient: 'from-emerald-500/20 to-teal-500/20', iconColor: 'text-emerald-400', perm: 'pos' },
    { to: '/sales', icon: Receipt, label: t('nav.sales'), gradient: 'from-violet-500/20 to-purple-500/20', iconColor: 'text-violet-400', perm: 'sales' },
    { to: '/returns', icon: RotateCcw, label: language === 'ar' ? 'المرتجعات' : 'Returns', gradient: 'from-rose-500/20 to-pink-500/20', iconColor: 'text-rose-400', perm: 'returns' },
  ];

  const inventoryNav: NavItem[] = [
    { to: '/mobiles', icon: Smartphone, label: 'الموبيلات وإكسسوارات', gradient: 'from-cyan-500/20 to-sky-500/20', iconColor: 'text-cyan-400', perm: 'mobiles' },
    { to: '/computers', icon: Monitor, label: 'الكمبيوتر وإكسسوارات', gradient: 'from-indigo-500/20 to-blue-500/20', iconColor: 'text-indigo-400', perm: 'computers' },
    { to: '/devices', icon: Tv, label: 'الأجهزة وإكسسوارات', gradient: 'from-amber-500/20 to-orange-500/20', iconColor: 'text-amber-400', perm: 'devices' },
    { to: '/used', icon: Archive, label: 'المستعمل', gradient: 'from-violet-500/20 to-purple-500/20', iconColor: 'text-violet-400', perm: 'used' },
    { to: '/cars', icon: Car, label: 'السيارات', gradient: 'from-emerald-500/20 to-teal-500/20', iconColor: 'text-emerald-400', perm: 'cars' },
    { to: '/warehouse', icon: Warehouse, label: 'المستودع', gradient: 'from-teal-500/20 to-cyan-500/20', iconColor: 'text-teal-400', perm: 'warehouse' },
    { to: '/barcodes', icon: Barcode, label: 'طباعة الباركود', gradient: 'from-violet-500/20 to-purple-500/20', iconColor: 'text-violet-400', perm: 'inventory' },
  ];


  const servicesNav: NavItem[] = [
    { to: '/maintenance', icon: Wrench, label: 'الصيانة', gradient: 'from-amber-500/20 to-yellow-500/20', iconColor: 'text-amber-400', perm: 'maintenance' },
    { to: '/installments', icon: FileText, label: 'التقسيط', gradient: 'from-blue-500/20 to-sky-500/20', iconColor: 'text-blue-400', perm: 'installments' },
    { to: '/expenses', icon: TrendingDown, label: 'المصروفات', gradient: 'from-rose-500/20 to-red-500/20', iconColor: 'text-rose-400', perm: 'expenses' },
    { to: '/damaged', icon: AlertTriangle, label: 'الهالك', gradient: 'from-red-500/20 to-orange-500/20', iconColor: 'text-red-400', perm: 'damaged' },
    { to: '/other-revenue', icon: DollarSign, label: 'أرباح أخرى', gradient: 'from-green-500/20 to-emerald-500/20', iconColor: 'text-green-400', perm: 'otherRevenue' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Filter items by user permissions (owner sees all)
  const filterByPerm = (items: NavItem[]) =>
    items.filter(item => !item.perm || hasPermission(item.perm));

  const NavItem = ({ item, i }: { item: NavItem; i: number }) => (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300',
          isActive
            ? 'bg-gradient-to-l from-primary/15 to-primary/5 text-sidebar-foreground shadow-lg shadow-primary/5'
            : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground'
        )
      }
      style={{ animationDelay: `${i * 50}ms` }}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <div className="absolute inset-0 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent" />
          )}
          <div className={cn(
            'relative flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300',
            isActive ? `bg-gradient-to-br ${item.gradient} shadow-lg` : 'bg-sidebar-accent/30 group-hover:bg-sidebar-accent/50'
          )}>
            <item.icon className={cn('h-4 w-4 transition-all duration-300', isActive ? item.iconColor : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground')} />
          </div>
          <span className="relative text-xs">{item.label}</span>
          {isActive && <div className="absolute end-0 w-1 h-5 bg-gradient-to-b from-primary to-primary/70 rounded-l-full" />}
        </>
      )}
    </NavLink>
  );

  const visibleMain = filterByPerm(mainNav);
  const visibleInventory = filterByPerm(inventoryNav);
  const visibleServices = filterByPerm(servicesNav);

  return (
    <aside className="hidden md:flex h-screen w-64 flex-col glass-dark border-e border-sidebar-border/50 relative overflow-hidden shrink-0">
      {/* Background glow */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-0 left-0 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
      </div>

      {/* Logo */}
      <div className="relative flex flex-col items-start gap-2 px-4 py-4 border-b border-sidebar-border/30">
        <div className="flex items-center gap-3 w-full">
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg opacity-50 animate-pulse" />
            <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-[#111] shadow-lg shadow-primary/30 border border-primary/20 flex items-center justify-center">
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
              <span className="text-xl font-black text-white italic tracking-tighter hidden items-center justify-center w-full h-full" style={{ display: 'none' }}>
                <span>G</span><span className="text-primary">X</span>
              </span>
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black tracking-wider text-sidebar-foreground uppercase">
              {settings.companyName || 'GLEAMEX'}
            </h1>
            <p className="text-[10px] text-primary font-bold tracking-widest uppercase">{settings.companySuffix || 'ش. ذ. م.م'}</p>
          </div>
        </div>
        <div className="w-full p-2 rounded-lg bg-sidebar-accent/50 border border-sidebar-border/50">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Store className="h-3 w-3 text-sidebar-foreground/70 shrink-0" />
            <p className="text-xs font-semibold text-sidebar-foreground truncate">{settings.branchName || 'الفرع الرئيسي'}</p>
          </div>
          {settings.branchAddress && (
            <p className="text-[10px] text-sidebar-foreground/50 truncate pr-4">{settings.branchAddress}</p>
          )}
        </div>
      </div>

      {/* User info */}
      {user && (
        <div className="relative px-3 py-3 border-b border-sidebar-border/30">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/20">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-xs font-bold text-white shadow-lg shadow-primary/20 shrink-0">
              {user.fullName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">{user.fullName}</p>
              <p className="text-[10px] text-sidebar-foreground/50 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                {user.role === 'owner' ? '👑 صاحب النظام' : 'مستخدم'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="relative flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {/* Main */}
        {visibleMain.length > 0 && (
          <>
            <p className="px-3 mb-1 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider">الرئيسية</p>
            {visibleMain.map((item, i) => <NavItem key={item.to} item={item} i={i} />)}
          </>
        )}

        {/* Inventory */}
        {visibleInventory.length > 0 && (
          <div className="pt-3 pb-1">
            <p className="px-3 mb-1 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider">المخزون</p>
            {visibleInventory.map((item, i) => <NavItem key={item.to} item={item} i={i} />)}
          </div>
        )}

        {/* Services */}
        {visibleServices.length > 0 && (
          <div className="pt-3 pb-1">
            <p className="px-3 mb-1 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider">الخدمات</p>
            {visibleServices.map((item, i) => <NavItem key={item.to} item={item} i={i} />)}
          </div>
        )}

        {/* System */}
        <div className="pt-3 pb-1">
          <p className="px-3 mb-1 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider">النظام</p>
          {hasPermission('settings') && (
            <NavItem item={{ to: '/settings', icon: Settings, label: t('nav.settings'), gradient: 'from-slate-500/20 to-gray-500/20', iconColor: 'text-slate-400', perm: 'settings' }} i={0} />
          )}
          {isOwner() && (
            <NavItem item={{ to: '/users', icon: Users, label: 'إدارة المستخدمين', gradient: 'from-primary/20 to-primary/10', iconColor: 'text-primary', perm: 'users' }} i={1} />
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="relative border-t border-sidebar-border/30 px-2 py-3 space-y-1">
        <button
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground transition-all duration-300"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sidebar-accent/30 group-hover:bg-sidebar-accent/50 transition-colors">
            <Languages className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs">{language === 'en' ? 'العربية' : 'English'}</span>
        </button>
        <button
          onClick={toggleTheme}
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground transition-all duration-300"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sidebar-accent/30 group-hover:bg-sidebar-accent/50 transition-colors">
            {theme === 'light' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5 text-amber-400" />}
          </div>
          <span className="text-xs">{theme === 'light' ? t('settings.dark') : t('settings.light')}</span>
        </button>
        <button
          onClick={handleLogout}
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-rose-400/80 hover:bg-rose-500/10 hover:text-rose-400 transition-all duration-300"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 group-hover:bg-rose-500/20 transition-colors">
            <LogOutIcon className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs">{language === 'ar' ? 'تسجيل الخروج' : 'Logout'}</span>
        </button>
        <div className="pt-1 text-center">
          <p className="text-[10px] text-sidebar-foreground/30">v3.1.0 • {new Date().getFullYear()}</p>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
