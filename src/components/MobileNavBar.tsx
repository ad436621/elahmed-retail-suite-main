// #15 FIX: Updated MobileNavBar to include all new pages
import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, ShoppingCart, Receipt, Smartphone, Menu,
    Wrench, FileText, TrendingDown, RotateCcw, Monitor, Tv,
    Users, Barcode, Settings, X, Car, Warehouse, Wallet,
    UserCheck, Truck, ShieldAlert, Bell, ClipboardCheck,
    BarChart3,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export default function MobileNavBar() {
    const { hasPermission, isOwner } = useAuth();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);

    // Core 4 items for the bottom bar
    const bottomItems = [
        { to: '/', icon: LayoutDashboard, label: 'الرئيسية', perm: 'dashboard' },
        { to: '/pos', icon: ShoppingCart, label: 'نقطة البيع', perm: 'pos' },
        { to: '/mobiles', icon: Smartphone, label: 'مخزون', perm: 'mobiles' },
        { to: '/sales', icon: Receipt, label: 'مبيعات', perm: 'sales' },
    ].filter(i => hasPermission(i.perm as any));

    const DrawerLink = ({ to, icon: Icon, label, onClick }: any) => {
        const active = location.pathname === to;
        return (
            <NavLink to={to} onClick={onClick} className={cn(
                "flex items-center gap-4 px-4 py-3 rounded-2xl transition-all",
                active ? "bg-primary/10 text-primary font-bold shadow-sm" : "hover:bg-muted text-foreground font-medium"
            )}>
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", active ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground")}>
                    <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm">{label}</span>
            </NavLink>
        );
    };

    const SectionTitle = ({ children }: { children: string }) => (
        <h3 className="px-4 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-1 mt-2">{children}</h3>
    );

    return (
        <>
            {/* Bottom Nav Bar */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around bg-card border-t border-border/50 pb-safe pt-2 px-2 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                {bottomItems.map(item => {
                    const active = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
                    return (
                        <NavLink key={item.to} to={item.to} className={cn(
                            "flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all duration-300 relative",
                            active ? "text-primary -translate-y-1" : "text-muted-foreground hover:text-foreground"
                        )}>
                            {active && <div className="absolute inset-0 bg-primary/10 rounded-2xl -z-10 animate-fade-in" />}
                            <item.icon className={cn("h-6 w-6 mb-1 transition-all", active ? "scale-110 drop-shadow-md" : "scale-100")} />
                            <span className={cn("text-[10px] transition-all", active ? "font-bold" : "font-medium")}>{item.label}</span>
                        </NavLink>
                    );
                })}

                {/* Menu Button */}
                <button onClick={() => setMenuOpen(true)} className={cn(
                    "flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all duration-300 relative",
                    menuOpen ? "text-primary -translate-y-1" : "text-muted-foreground hover:text-foreground"
                )}>
                    {menuOpen && <div className="absolute inset-0 bg-primary/10 rounded-2xl -z-10 animate-fade-in" />}
                    <Menu className={cn("h-6 w-6 mb-1 transition-all", menuOpen ? "scale-110 drop-shadow-md" : "scale-100")} />
                    <span className={cn("text-[10px] transition-all", menuOpen ? "font-bold" : "font-medium")}>المزيد</span>
                </button>
            </nav>

            {/* Full Screen Drawer Menu */}
            {menuOpen && (
                <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setMenuOpen(false)} />
                    <div className="relative bg-background rounded-t-[2rem] shadow-2xl animate-slide-up flex flex-col max-h-[90vh] overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/40 shrink-0">
                            <h2 className="text-xl font-black text-foreground">قائمة الخدمات</h2>
                            <button onClick={() => setMenuOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">

                            {/* المخزون */}
                            <SectionTitle>المخزون</SectionTitle>
                            {hasPermission('computers') && <DrawerLink to="/computers" icon={Monitor} label="الكمبيوترات" onClick={() => setMenuOpen(false)} />}
                            {hasPermission('devices') && <DrawerLink to="/devices" icon={Tv} label="الأجهزة" onClick={() => setMenuOpen(false)} />}
                            {hasPermission('cars') && <DrawerLink to="/cars" icon={Car} label="السيارات" onClick={() => setMenuOpen(false)} />}

                            {hasPermission('warehouse') && <DrawerLink to="/warehouse" icon={Warehouse} label="المستودع" onClick={() => setMenuOpen(false)} />}
                            {hasPermission('inventory') && <DrawerLink to="/barcodes" icon={Barcode} label="طباعة الباركود" onClick={() => setMenuOpen(false)} />}

                            {/* الخدمات والحسابات */}
                            <div className="border-t border-border/30 mt-3 pt-1" />
                            <SectionTitle>الخدمات والحسابات</SectionTitle>
                            {hasPermission('maintenance') && <DrawerLink to="/maintenance" icon={Wrench} label="تذاكر الصيانة" onClick={() => setMenuOpen(false)} />}
                            {hasPermission('maintenance') && <DrawerLink to="/maintenance/parts" icon={Wrench} label="قطع الصيانة" onClick={() => setMenuOpen(false)} />}
                            {hasPermission('installments') && <DrawerLink to="/installments" icon={FileText} label="التقسيط" onClick={() => setMenuOpen(false)} />}
                            {hasPermission('returns') && <DrawerLink to="/returns" icon={RotateCcw} label="المرتجعات" onClick={() => setMenuOpen(false)} />}
                            {hasPermission('expenses') && <DrawerLink to="/expenses" icon={TrendingDown} label="المصروفات" onClick={() => setMenuOpen(false)} />}
                            {hasPermission('wallets') && <DrawerLink to="/wallets" icon={Wallet} label="المحافظ والخزنة" onClick={() => setMenuOpen(false)} />}
                            {hasPermission('shiftClosing') && <DrawerLink to="/shift-closing" icon={ClipboardCheck} label="إقفال الوردية" onClick={() => setMenuOpen(false)} />}
                            {hasPermission('purchaseInvoices') && <DrawerLink to="/purchase-invoices" icon={Receipt} label="فواتير الشراء" onClick={() => setMenuOpen(false)} />}

                            {/* الأشخاص */}
                            <div className="border-t border-border/30 mt-3 pt-1" />
                            <SectionTitle>الأشخاص</SectionTitle>
                            {hasPermission('customers') && <DrawerLink to="/customers" icon={UserCheck} label="العملاء" onClick={() => setMenuOpen(false)} />}
                            {hasPermission('employees') && <DrawerLink to="/employees" icon={Users} label="الموظفون والرواتب" onClick={() => setMenuOpen(false)} />}
                            {hasPermission('suppliers') && <DrawerLink to="/suppliers" icon={Truck} label="الموردون" onClick={() => setMenuOpen(false)} />}

                            {/* أدوات */}
                            <div className="border-t border-border/30 mt-3 pt-1" />
                            <SectionTitle>أدوات</SectionTitle>
                            {hasPermission('blacklist') && <DrawerLink to="/blacklist" icon={ShieldAlert} label="القائمة السوداء" onClick={() => setMenuOpen(false)} />}
                            {hasPermission('reminders') && <DrawerLink to="/reminders" icon={Bell} label="التذكيرات" onClick={() => setMenuOpen(false)} />}
                            {hasPermission('dashboard') && <DrawerLink to="/reports" icon={BarChart3} label="التقارير" onClick={() => setMenuOpen(false)} />}

                            {/* النظام */}
                            {(hasPermission('settings') || isOwner()) && (
                                <>
                                    <div className="border-t border-border/30 mt-3 pt-1" />
                                    <SectionTitle>النظام</SectionTitle>
                                    {hasPermission('settings') && <DrawerLink to="/settings" icon={Settings} label="الإعدادات" onClick={() => setMenuOpen(false)} />}
                                    {isOwner() && <DrawerLink to="/users" icon={Users} label="إدارة المستخدمين" onClick={() => setMenuOpen(false)} />}
                                </>
                            )}

                            {/* Bottom spacer so last item isn't hidden under nav bar */}
                            <div className="h-20" />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
