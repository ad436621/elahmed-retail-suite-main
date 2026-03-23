// ============================================================
// مكون تبويب التحويلات — TransferTab
// #16 FIX: Extracted from POS.tsx into its own component file
// #13 FIX: Replaced all hardcoded bg-white/gray colors with CSS variables
// ============================================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, CheckCircle, Wallet, ChevronRight, Send, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { getWallets, deposit, type Wallet as WalletType } from '@/data/walletsData';
import { cn } from '@/lib/utils';
import { STORAGE_KEYS } from '@/config';

// #08 FIX: Use STORAGE_KEYS.TRANSFERS unified key
const TRANSFER_KEY = STORAGE_KEYS.TRANSFERS ?? 'elos_transfers';

const TRANSFER_TYPES = [
    { label: 'فودافون كاش', icon: '📱' },
    { label: 'اتصالات كاش', icon: '🟠' },
    { label: 'اورنج كاش', icon: '🟠' },
    { label: 'ويي', icon: '🔵' },
    { label: 'انستاباي', icon: '💜' },
    { label: 'تحويل بنكي', icon: '🏦' },
];

export interface PosTransfer {
    id: string;
    customer: string;
    phone: string;
    type: string;
    amount: number;
    commission: number;
    walletId: string;
    walletName: string;
    date: string;
}

type ActionMode = 'withdraw' | 'deposit' | 'deferred';

const ACTION_TABS: { id: ActionMode; label: string; activeClass: string }[] = [
    { id: 'withdraw', label: 'سحب', activeClass: 'bg-emerald-500 text-white' },
    { id: 'deposit', label: 'إيداع', activeClass: 'bg-blue-500 text-white' },
    { id: 'deferred', label: 'تحويل أجل (عميل مسجل)', activeClass: 'bg-foreground text-background' },
];

export default function TransferTab() {
    const { toast } = useToast();
    const [wallets, setWallets] = useState<WalletType[]>([]);
    const [todayTransfers, setTodayTransfers] = useState<PosTransfer[]>([]);
    const [customer, setCustomer] = useState('');
    const [phone, setPhone] = useState('');
    const [type, setType] = useState(TRANSFER_TYPES[0].label);
    const [amount, setAmount] = useState('');
    const [commission, setCommission] = useState('');
    const [walletId, setWalletId] = useState('');
    const [actionMode, setActionMode] = useState<ActionMode>('withdraw');

    useEffect(() => {
        getWallets().then(ws => {
            setWallets(ws);
            if (ws.length > 0) setWalletId(ws[0].id);
        });

        const all = getStorageItem<PosTransfer[]>(TRANSFER_KEY, []);
        const today = new Date().toDateString();
        setTodayTransfers(all.filter(t => new Date(t.date).toDateString() === today));
    }, []);

    const totalCommission = todayTransfers.reduce((s, t) => s + t.commission, 0);
    const selectedWallet = wallets.find(w => w.id === walletId);

    const handleRegister = async () => {
        const amt = Number(amount);
        const com = Number(commission);
        if (amt <= 0) { toast({ title: '⚠️ أدخل مبلغ التحويل', variant: 'destructive' }); return; }
        if (!walletId) { toast({ title: '⚠️ اختر المحفظة', variant: 'destructive' }); return; }

        try {
            if (com > 0) {
                await deposit(walletId, com, `عمولة تحويل ${type} — ${customer || 'عميل'}`, undefined, 'transfer_commission');
            }

        const newTransfer: PosTransfer = {
            id: crypto.randomUUID(),
            customer, phone, type, amount: amt, commission: com,
            walletId, walletName: selectedWallet?.name ?? '',
            date: new Date().toISOString(),
        };
        const allSaved = getStorageItem<PosTransfer[]>(TRANSFER_KEY, []);
        setStorageItem(TRANSFER_KEY, [...allSaved, newTransfer]);
        setTodayTransfers(prev => [...prev, newTransfer]);
        setCustomer(''); setPhone(''); setAmount(''); setCommission('');
        const updatedWallets = await getWallets();
        setWallets(updatedWallets);

        toast({
            title: '✅ تم تسجيل التحويل',
            description: `${type} — ${amt.toLocaleString('ar-EG')} ج.م${com > 0 ? ` + ${com} ج.م عمولة في ${selectedWallet?.name}` : ''}`,
        });
        } catch (err: any) {
            toast({ title: '❌ خطأ', description: err.message, variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-4 max-w-xl mx-auto pt-1">

            {/* Action Tabs */}
            <div className="flex rounded-2xl overflow-hidden border border-border/60 bg-card shadow-sm">
                {ACTION_TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActionMode(tab.id)}
                        className={cn('flex-1 py-3 text-sm font-bold transition-all',
                            actionMode === tab.id ? tab.activeClass : 'text-muted-foreground hover:bg-muted/50'
                        )}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Deferred mode */}
            {actionMode === 'deferred' && (
                <Link to="/installments?type=transfer"
                    className="flex items-center justify-between rounded-2xl border-2 border-border bg-muted/30 px-5 py-4 text-foreground hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                        <CreditCard className="h-6 w-6 text-muted-foreground" />
                        <div>
                            <p className="text-sm font-bold">إنشاء عقد أجل للعميل</p>
                            <p className="text-xs text-muted-foreground">سيتم نقلك لصفحة التقسيط لتسجيل تحويل بالأجل</p>
                        </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </Link>
            )}

            {/* Info banner */}
            <div className="rounded-xl border border-amber-200 dark:border-amber-800/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-700 dark:text-amber-400">
                💡 سجّل هنا على محفظتك وهتلاقي الفلوس كلها من الدرج
            </div>

            {/* Customer info */}
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                <div className="px-4 py-3 bg-muted/30 border-b border-border/50">
                    <span className="text-sm font-bold text-muted-foreground">👤 بيانات العميل (اختياري)</span>
                </div>
                <div className="p-4 space-y-3">
                    <input value={customer} onChange={e => setCustomer(e.target.value)}
                        placeholder="اكتب اسم العميل أو رقم الواتساب..."
                        className="w-full h-11 rounded-xl border border-border/60 bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                    <input value={phone} onChange={e => setPhone(e.target.value)}
                        placeholder="رقم الهاتف..."
                        className="w-full h-11 rounded-xl border border-border/60 bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                </div>
            </div>

            {/* Transfer type */}
            <div className="rounded-2xl border border-border/60 bg-card p-4">
                <label className="flex items-center gap-2 text-sm font-bold text-muted-foreground mb-2">🔄 نوع التحويل</label>
                <select value={type} onChange={e => setType(e.target.value)}
                    className="w-full h-11 rounded-xl border border-border/60 bg-background px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                    {TRANSFER_TYPES.map(t => <option key={t.label} value={t.label}>{t.icon} {t.label}</option>)}
                </select>
            </div>

            {/* Wallet selector */}
            {wallets.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {wallets.map(w => (
                        <button key={w.id} onClick={() => setWalletId(w.id)}
                            className={cn(
                                'flex-shrink-0 rounded-2xl px-4 py-3 text-sm font-bold transition-all border-2',
                                walletId === w.id
                                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-300 shadow-md'
                                    : 'border-border bg-card text-muted-foreground hover:border-blue-300'
                            )}>
                            <div className="text-lg leading-none mb-1">{w.icon}</div>
                            <div className="text-xs font-bold whitespace-nowrap">{w.name}</div>
                            <div className="text-[11px] text-emerald-600 font-black mt-0.5">{w.balance.toLocaleString('ar-EG')} ج.م</div>
                        </button>
                    ))}
                    <Link to="/wallets"
                        className="flex-shrink-0 rounded-2xl border-2 border-dashed border-border px-4 py-3 text-xs font-bold text-muted-foreground hover:text-blue-500 hover:border-blue-300 flex flex-col items-center justify-center gap-1 transition-colors">
                        <Wallet className="h-5 w-5" />
                        إدارة
                    </Link>
                </div>
            )}

            {/* Amounts */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-foreground mb-1.5 text-end">مبلغ التحويل:</label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" min={0}
                        className="w-full h-14 rounded-xl border border-border/60 bg-background px-3 text-center text-2xl font-black focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                </div>
                <div>
                    <label className="block text-sm font-bold text-amber-600 mb-1.5 text-end">⭐ العمولة (الربح):</label>
                    <input type="number" value={commission} onChange={e => setCommission(e.target.value)} placeholder="0" min={0}
                        className="w-full h-14 rounded-xl border-2 border-amber-300 bg-amber-500/10 px-3 text-center text-2xl font-black text-amber-700 dark:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
            </div>

            {/* Wallet confirm hint */}
            {selectedWallet && Number(commission) > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{commission} ج.م ستُضاف إلى {selectedWallet.icon} {selectedWallet.name}</p>
                </div>
            )}

            {/* Register button */}
            <button onClick={handleRegister}
                className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 py-4 text-base font-bold text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-md">
                <CheckCircle className="h-5 w-5" /> تسجيل التحويل
            </button>

            {/* Shift summary */}
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card px-5 py-3">
                <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                    <Send className="h-4 w-4" /> تحويلات الشفت
                    <span className="flex h-5 w-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-black">{todayTransfers.length}</span>
                </div>
                <span className="text-sm font-black text-emerald-600">{totalCommission.toLocaleString('ar-EG')} ج.م عمولات</span>
            </div>

            {/* Transfer history */}
            {todayTransfers.length > 0 && (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                    {[...todayTransfers].reverse().map(t => (
                        <div key={t.id} className="flex items-center justify-between rounded-xl bg-muted/30 border border-border/30 px-4 py-3">
                            <div>
                                <p className="text-sm font-bold">{t.type} — {t.customer || 'عميل'}</p>
                                <p className="text-xs text-muted-foreground">{new Date(t.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} · {t.walletName}</p>
                            </div>
                            <div className="text-end">
                                <p className="text-sm font-bold">{t.amount.toLocaleString('ar-EG')} ج.م</p>
                                {t.commission > 0 && <p className="text-xs text-emerald-600 font-bold">+{t.commission} ج.م</p>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Link to wallets */}
            <Link to="/wallets" className="flex items-center justify-between rounded-2xl border border-blue-200 dark:border-blue-800/20 bg-blue-500/10 px-5 py-4 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 transition-colors">
                <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5" />
                    <div>
                        <p className="text-sm font-bold">إدارة المحافظ والصندوق</p>
                        <p className="text-xs opacity-70">عرض الأرصدة وتفاصيل المعاملات</p>
                    </div>
                </div>
                <ChevronRight className="h-5 w-5 opacity-60" />
            </Link>
        </div>
    );
}
