// ── Wallets Tab ── (rewired to use walletsData.ts — same data as WalletsPage)
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { Wallet, CreditCard, Plus, Banknote, Save, Trash2, Settings, ExternalLink } from 'lucide-react';
import SectionCard from '@/components/settings/SectionCard';
import ToggleRow from '@/components/settings/ToggleRow';
import { useToast } from '@/hooks/use-toast';
import { STORAGE_KEYS } from '@/config';
import {
    getWallets, addWallet, deleteWallet,
    type Wallet as WalletType,
} from '@/data/walletsData';

// ── Types ─────────────────────────────────────────────────────

interface TransferMethod { id: string; name: string; enabled: boolean; commission: number; }

const defaultTransfers: TransferMethod[] = [
    { id: 'vodafone', name: 'فودافون كاش', enabled: true, commission: 10 },
    { id: 'etisalat', name: 'اتصالات كاش', enabled: true, commission: 10 },
    { id: 'orange', name: 'أورنج كاش', enabled: true, commission: 10 },
    { id: 'dbay', name: 'دي باي', enabled: true, commission: 10 },
    { id: 'instapay', name: 'استلامي', enabled: true, commission: 10 },
];

const IC = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/60";

const WALLET_ICONS: WalletType['icon'][] = ['💵', '🏦', '📱', '💳', '👛', '🏧'];
const WALLET_COLORS = [
    { label: 'أخضر', value: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    { label: 'أزرق', value: 'bg-blue-100 text-blue-700 border-blue-200' },
    { label: 'بنفسجي', value: 'bg-purple-100 text-purple-700 border-purple-200' },
    { label: 'برتقالي', value: 'bg-amber-100 text-amber-700 border-amber-200' },
];

// ── Component ─────────────────────────────────────────────────

export default function WalletsTab() {
    const { toast } = useToast();
    const [wallets, setWallets] = useState<WalletType[]>([]);

    // New wallet form
    const [newWalletName, setNewWalletName] = useState('');
    const [newWalletIcon, setNewWalletIcon] = useState('💵');
    const [newWalletColor, setNewWalletColor] = useState(WALLET_COLORS[0].value);

    const refresh = async () => {
        try {
            setWallets(await getWallets());
        } catch (error) {
            console.error('Failed to load wallets in settings', error);
            setWallets([]);
        }
    };

    useEffect(() => {
        void refresh();
    }, []);

    const handleAddWallet = async () => {
        const walletName = newWalletName.trim();
        if (!walletName) return;

        try {
            await addWallet({ name: walletName, icon: newWalletIcon, color: newWalletColor, balance: 0, isDefault: false });
            await refresh();
            setNewWalletName('');
            toast({ title: '✅ تمت إضافة المحفظة', description: walletName });
        } catch (error) {
            console.error('Failed to add wallet from settings', error);
            toast({ title: 'تعذر إضافة المحفظة', description: 'حاول مرة أخرى', variant: 'destructive' });
        }
    };

    const handleDeleteWallet = async (w: WalletType) => {
        if (w.isDefault) { toast({ title: 'تنبيه', description: 'لا يمكن حذف المحفظة الافتراضية', variant: 'destructive' }); return; }

        try {
            await deleteWallet(w.id);
            await refresh();
            toast({ title: 'تم الحذف', description: w.name });
        } catch (error) {
            console.error('Failed to delete wallet from settings', error);
            toast({ title: 'تعذر حذف المحفظة', description: w.name, variant: 'destructive' });
        }
    };

    // Transfers
    const [transfers, setTransfers] = useState<TransferMethod[]>(() => {
        try {
            const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSFER_SETTINGS) || '[]');
            return s.length ? s : defaultTransfers;
        } catch { return defaultTransfers; }
    });
    const [commissionMethod, setCommissionMethod] = useState('per1000');
    const [newTransferName, setNewTransferName] = useState('');

    const saveTransfers = () => {
        localStorage.setItem(STORAGE_KEYS.TRANSFER_SETTINGS, JSON.stringify(transfers));
        toast({ title: '✅ تم حفظ إعدادات التحويلات' });
    };
    const addTransfer = () => {
        if (!newTransferName.trim()) return;
        setTransfers(t => [...t, { id: Date.now().toString(), name: newTransferName.trim(), enabled: true, commission: 10 }]);
        setNewTransferName('');
    };

    return (
        <>
            {/* Wallets Management */}
            <SectionCard icon={<Wallet className="h-5 w-5" />} title="إدارة المحافظ"
                desc="المحافظ الرقمية والحسابات — مرتبطة بصفحة المحافظ"
                color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                <div className="space-y-3">
                    {/* Existing wallets */}
                    {wallets.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">لا توجد محافظ مضافة.</p>
                    ) : wallets.map(w => (
                        <div key={w.id} className={`flex items-center justify-between rounded-xl border px-4 py-3 ${w.color}`}>
                            <div className="flex items-center gap-2">
                                <span className="text-xl">{w.icon}</span>
                                {w.isDefault && <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-bold">افتراضية</span>}
                                <span className="text-sm font-bold">{w.name}</span>
                                <span className="text-xs opacity-70 tabular-nums">{w.balance.toLocaleString()} ج.م</span>
                            </div>
                            <button onClick={() => handleDeleteWallet(w)}
                                className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}

                    {/* Add new wallet */}
                    <div className="border-t border-border/50 pt-3 space-y-3">
                        <p className="text-xs font-bold text-muted-foreground">محفظة جديدة</p>
                        <div className="flex gap-2">
                            <input data-validation="text-only" value={newWalletName}
                                onChange={e => setNewWalletName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddWallet()}
                                placeholder="اسم المحفظة..." className={`flex-1 ${IC}`} />
                            <button onClick={handleAddWallet}
                                className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90">
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {WALLET_ICONS.map(ic => (
                                <button key={ic} onClick={() => setNewWalletIcon(ic)}
                                    className={`h-9 w-9 rounded-xl text-lg flex items-center justify-center transition-all ${newWalletIcon === ic ? 'ring-2 ring-primary bg-primary/10 scale-110' : 'bg-muted hover:bg-muted/80'}`}>
                                    {ic}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {WALLET_COLORS.map(c => (
                                <button key={c.value} onClick={() => setNewWalletColor(c.value)}
                                    className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-all ${c.value} ${newWalletColor === c.value ? 'scale-110 ring-2 ring-primary' : 'opacity-60 hover:opacity-100'}`}>
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Link to WalletsPage */}
                    <a href="/wallets"
                        className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-primary hover:bg-primary/5 transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" /> إدارة المحافظ والعمليات المالية
                    </a>
                </div>
            </SectionCard>

            {/* Transfers */}
            <SectionCard icon={<Banknote className="h-5 w-5" />} title="إعدادات التحويلات"
                desc="عمولات تحويل (فودافون كاش، اتصالات كاش، أورنج كاش، إلخ)"
                color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                <div className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">طريقة حساب العمولة</label>
                        <select value={commissionMethod} onChange={e => setCommissionMethod(e.target.value)} className={IC}>
                            <option value="per1000">لكل 1000 ج.م</option>
                            <option value="percentage">نسبة مئوية %</option>
                            <option value="fixed">مبلغ ثابت</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        {transfers.map(t => (
                            <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                                <ToggleRow value={t.enabled}
                                    onChange={v => setTransfers(ts => ts.map(x => x.id === t.id ? { ...x, enabled: v } : x))}
                                    label="" />
                                <span className="flex-1 text-sm font-bold text-foreground">{t.name}</span>
                                <input type="number" min={0} value={t.commission}
                                    onChange={e => setTransfers(ts => ts.map(x => x.id === t.id ? { ...x, commission: +e.target.value } : x))}
                                    className="w-20 text-center rounded-xl border border-input bg-background px-2 py-1.5 text-sm font-bold tabular-nums" />
                                <button onClick={() => setTransfers(ts => ts.filter(x => x.id !== t.id))}
                                    className="rounded-lg p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-xs font-bold text-muted-foreground shrink-0">أخرى</span>
                        <input data-validation="text-only" value={newTransferName}
                            onChange={e => setNewTransferName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addTransfer()}
                            placeholder="اسم..." className={`flex-1 ${IC} text-xs`} />
                        <button onClick={addTransfer}
                            className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90">+</button>
                    </div>
                    <button onClick={saveTransfers}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-3 text-sm font-bold hover:bg-emerald-700 transition-all shadow-md">
                        <Save className="h-4 w-4" /> حفظ إعدادات التحويلات
                    </button>
                </div>
            </SectionCard>
        </>
    );
}
