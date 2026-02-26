import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    ShoppingCart,
    Receipt,
    Smartphone,
    Menu,
    Wrench,
    FileText,
    TrendingDown,
    RotateCcw,
    Store,
    Monitor,
    Tv,
    Users,
    Archive,
    Barcode,
    Settings,
    X
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function MobileNavBar() {
    const { hasPermission, isOwner } = useAuth();
    const { t } = useLanguage();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);

    // Core 4 items for the bottom bar
    const bottomItems = [
        { to: '/', icon: LayoutDashboard, label: 'الرئيسية', perm: 'dashboard' },
        { to: '/pos', icon: ShoppingCart, label: 'نقطة البيع', perm: 'pos' },
        { to: '/mobiles', icon: Smartphone, label: 'المخزون', perm: 'mobiles' },
        { to: '/sales', icon: Receipt, label: 'المبيعات', perm: 'sales' },
    ].filter(i => hasPermission(i.perm as any));

    // Additional items for the popup drawer
    const DrawerLink = ({ to, icon: Icon, label, onClick }: any) => {
        const active = location.pathname === to;
        return (
            <NavLink to={to} onClick={onClick} className={cn(
                "flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all",
                active ? "bg-primary/10 text-primary font-bold shadow-sm" : "hover:bg-muted text-foreground font-medium"
            )}>
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", active ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground")}>
                    <Icon className="h-5 w-5" />
                </div>
                <span className="text-base">{label}</span>
            </NavLink>
        );
    };

    return (
        <>
            {/* Bottom Nav Bar - FIXED TO BOTTOM */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around bg-card border-t border-border/50 pb-safe pt-2 px-2 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                {bottomItems.map(item => {
                    const active = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={cn(
                                "flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all duration-300 relative",
                                active ? "text-primary -translate-y-1" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {active && <div className="absolute inset-0 bg-primary/10 rounded-2xl -z-10 animate-fade-in" />}
                            <item.icon className={cn("h-6 w-6 mb-1 transition-all", active ? "scale-110 drop-shadow-md" : "scale-100")} />
                            <span className={cn("text-[10px] transition-all", active ? "font-bold" : "font-medium")}>{item.label}</span>
                        </NavLink>
                    );
                })}

                {/* Menu Button */}
                <button
                    onClick={() => setMenuOpen(true)}
                    className={cn(
                        "flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all duration-300 relative",
                        menuOpen ? "text-primary -translate-y-1" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    {menuOpen && <div className="absolute inset-0 bg-primary/10 rounded-2xl -z-10 animate-fade-in" />}
                    <Menu className={cn("h-6 w-6 mb-1 transition-all", menuOpen ? "scale-110 drop-shadow-md" : "scale-100")} />
                    <span className={cn("text-[10px] transition-all", menuOpen ? "font-bold" : "font-medium")}>المزيد</span>
                </button>
            </nav>

            {/* Full Screen Drawer Menu */}
            {menuOpen && (
                <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setMenuOpen(false)} />

                    {/* Sheet Drawer */}
                    <div className="relative bg-background rounded-t-[2rem] shadow-2xl animate-slide-up flex flex-col max-h-[85vh] overflow-hidden">
                        {/* Handle & Header */}
                        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/40 shrink-0">
                            <h2 className="text-xl font-black text-foreground">قائمة الخدمات</h2>
                            <button onClick={() => setMenuOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">

                            {/* Inventory specific */}
                            <div className="space-y-1">
                                <h3 className="px-4 text-xs font-bold text-muted-foreground/50 uppercase tracking-widest mb-2">أقسام المخزون الإضافية</h3>
                                {hasPermission('computers') && <DrawerLink to="/computers" icon={Monitor} label="الكمبيوترات" onClick={() => setMenuOpen(false)} />}
                                {hasPermission('devices') && <DrawerLink to="/devices" icon={Tv} label="الأجهزة" onClick={() => setMenuOpen(false)} />}
                                {hasPermission('inventory') && <DrawerLink to="/barcodes" icon={Barcode} label="طباعة الباركود" onClick={() => setMenuOpen(false)} />}
                            </div>

                            {/* Services */}
                            <div className="space-y-1 border-t border-border/40 pt-4">
                                <h3 className="px-4 text-xs font-bold text-muted-foreground/50 uppercase tracking-widest mb-2">الخدمات والحسابات</h3>
                                {hasPermission('maintenance') && <DrawerLink to="/maintenance" icon={Wrench} label="الصيانة" onClick={() => setMenuOpen(false)} />}
                                {hasPermission('installments') && <DrawerLink to="/installments" icon={FileText} label="التقسيط" onClick={() => setMenuOpen(false)} />}
                                {hasPermission('returns') && <DrawerLink to="/returns" icon={RotateCcw} label="المرتجعات" onClick={() => setMenuOpen(false)} />}
                                {hasPermission('expenses') && <DrawerLink to="/expenses" icon={TrendingDown} label="المصروفات" onClick={() => setMenuOpen(false)} />}
                            </div>

                            {/* Admin */}
                            {(hasPermission('settings') || isOwner()) && (
                                <div className="space-y-1 border-t border-border/40 pt-4 pb-20"> {/* pb-20 so last item is visible above nav */}
                                    <h3 className="px-4 text-xs font-bold text-muted-foreground/50 uppercase tracking-widest mb-2">النظام</h3>
                                    {hasPermission('settings') && <DrawerLink to="/settings" icon={Settings} label="الإعدادات" onClick={() => setMenuOpen(false)} />}
                                    {isOwner() && <DrawerLink to="/users" icon={Users} label="إدارة المستخدمين" onClick={() => setMenuOpen(false)} />}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
