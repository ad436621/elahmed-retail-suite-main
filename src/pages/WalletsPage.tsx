// ============================================================
// Wallets Page — Multi-wallet / treasury management
// ============================================================

import { useState, useMemo } from 'react';
import { Wallet, Plus, TrendingUp, TrendingDown, ArrowLeftRight, X, Save, ChevronDown, ChevronUp, Trash2, Star } from 'lucide-react';
import {
    getWallets, getTransactions, addWallet, deleteWallet,
    deposit, withdraw, transfer, getTotalBalance,
    type Wallet as WalletType, type WalletTransaction,
} from '@/data/walletsData';
import { useConfirm } from '@/components/ConfirmDialog';

const fmt = (n: number) => n.toLocaleString('ar-EG');
const WALLET_ICONS = ['💵', '🏦', '📱', '💳', '👛', '🏧'];
const WALLET_COLORS = [
    { label: 'أخضر', value: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    { label: 'أزرق', value: 'bg-blue-100 text-blue-700 border-blue-200' },
    { label: 'بنفسجي', value: 'bg-purple-100 text-purple-700 border-purple-200' },
    { label: 'برتقالي', value: 'bg-amber-100 text-amber-700 border-amber-200' },
    { label: 'أحمر', value: 'bg-rose-100 text-rose-700 border-rose-200' },
    { label: 'رمادي', value: 'bg-slate-100 text-slate-700 border-slate-200' },
];

type OpType = 'deposit' | 'withdrawal' | 'transfer';

// ─── Operation Modal ─────────────────────────────────────────

function OperationModal({ wallet, wallets, type, onClose, onDone }: { wallet: WalletType; wallets: WalletType[]; type: OpType; onClose: () => void; onDone: () => void }) {
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [toWalletId, setToWalletId] = useState(wallets.find(w => w.id !== wallet.id)?.id ?? '');
    const [error, setError] = useState('');

    const labels: Record<OpType, string> = { deposit: 'إيداع في', withdrawal: 'سحب من', transfer: 'تحويل من' };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(amount);
        if (!amt || amt <= 0) { setError('أدخل مبلغاً صحيحاً'); return; }
        if (!reason.trim()) { setError('أدخل سبب العملية'); return; }
        if ((type === 'withdrawal' || type === 'transfer') && amt > wallet.balance) { setError('الرصيد غير كافٍ'); return; }
        if (type === 'transfer') { if (!toWalletId) { setError('اختر محفظة الوجهة'); return; } transfer(wallet.id, toWalletId, amt, reason); }
        else if (type === 'deposit') deposit(wallet.id, amt, reason);
        else withdraw(wallet.id, amt, reason);
        onDone(); onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-sm bg-card rounded-3xl border border-border shadow-2xl animate-scale-in">
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50">
                    <h2 className="text-base font-extrabold">{labels[type]} {wallet.name}</h2>
                    <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && <p className="text-sm text-destructive font-medium">{error}</p>}
                    <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1.5">المبلغ (ج.م)</label>
                        <input value={amount} onChange={e => setAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00"
                            className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-center text-xl font-black focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    {type === 'transfer' && (
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1.5">إلى محفظة</label>
                            <select value={toWalletId} onChange={e => setToWalletId(e.target.value)}
                                className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                                {wallets.filter(w => w.id !== wallet.id).map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1.5">السبب / البيان</label>
                        <input data-validation="text-only" value={reason} onChange={e => setReason(e.target.value)} placeholder="سبب العملية..."
                            className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div className="flex gap-2 pt-1">
                        <button type="submit" className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors">
                            <Save className="h-4 w-4" /> تأكيد
                        </button>
                        <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">إلغاء</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Add Wallet Modal ─────────────────────────────────────────

function AddWalletModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
    const [name, setName] = useState('');
    const [icon, setIcon] = useState('💵');
    const [color, setColor] = useState(WALLET_COLORS[0].value);
    const [balance, setBalance] = useState('0');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        addWallet({ name, icon, color, balance: parseFloat(balance) || 0, isDefault: false });
        onDone(); onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-sm bg-card rounded-3xl border border-border shadow-2xl animate-scale-in">
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50">
                    <h2 className="text-base font-extrabold">إضافة محفظة جديدة</h2>
                    <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1.5">اسم المحفظة *</label>
                        <input data-validation="text-only" value={name} onChange={e => setName(e.target.value)} placeholder="الصندوق / البنك / فودافون كاش"
                            className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1.5">الرصيد الافتتاحي</label>
                        <input value={balance} onChange={e => setBalance(e.target.value)} type="number" min="0"
                            className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-2">الأيقونة</label>
                        <div className="flex gap-2 flex-wrap">
                            {WALLET_ICONS.map(ic => (
                                <button key={ic} type="button" onClick={() => setIcon(ic)}
                                    className={`h-10 w-10 rounded-xl text-xl flex items-center justify-center transition-all ${icon === ic ? 'bg-primary/20 ring-2 ring-primary scale-110' : 'bg-muted hover:bg-muted/80'}`}>{ic}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-2">اللون</label>
                        <div className="flex gap-2 flex-wrap">
                            {WALLET_COLORS.map(c => (
                                <button key={c.value} type="button" onClick={() => setColor(c.value)}
                                    className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-all ${c.value} ${color === c.value ? 'scale-110 ring-2 ring-primary' : 'opacity-70 hover:opacity-100'}`}>{c.label}</button>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                        <button type="submit" className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors">
                            <Save className="h-4 w-4" /> إضافة
                        </button>
                        <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">إلغاء</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Wallet Card ─────────────────────────────────────────────

function WalletCard({ wallet, allWallets, onOperation, onRefresh, onDelete }: { wallet: WalletType; allWallets: WalletType[]; onOperation: (w: WalletType, op: OpType) => void; onRefresh: () => void; onDelete: (w: WalletType) => void }) {
    const [showTxns, setShowTxns] = useState(false);
    const txns = useMemo(() => getTransactions(wallet.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20), [wallet.id, showTxns]);

    const txnLabel: Record<WalletTransaction['type'], string> = { deposit: 'إيداع', withdrawal: 'سحب', transfer_in: 'تحويل وارد', transfer_out: 'تحويل صادر' };
    const txnColor: Record<WalletTransaction['type'], string> = { deposit: 'text-emerald-600', withdrawal: 'text-rose-600', transfer_in: 'text-blue-600', transfer_out: 'text-amber-600' };

    return (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="p-5 border-b border-border/50">
                <div className="flex items-start gap-3">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-2xl border ${wallet.color} shrink-0`}>{wallet.icon}</div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-foreground truncate">{wallet.name}</h3>
                            {wallet.isDefault && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                        </div>
                        <p className="text-2xl font-black text-foreground mt-1 tabular-nums">{fmt(wallet.balance)} <span className="text-sm font-semibold text-muted-foreground">ج.م</span></p>
                    </div>
                    {!wallet.isDefault && (
                        <button onClick={() => onDelete(wallet)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="h-4 w-4" />
                        </button>
                    )}
                </div>
                <div className="flex gap-2 mt-4">
                    <button onClick={() => onOperation(wallet, 'deposit')} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 border border-emerald-200/50 py-2 text-xs font-bold hover:bg-emerald-500/20 transition-colors">
                        <TrendingUp className="h-3.5 w-3.5" /> إيداع
                    </button>
                    <button onClick={() => onOperation(wallet, 'withdrawal')} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-rose-500/10 text-rose-700 border border-rose-200/50 py-2 text-xs font-bold hover:bg-rose-500/20 transition-colors">
                        <TrendingDown className="h-3.5 w-3.5" /> سحب
                    </button>
                    {allWallets.length > 1 && (
                        <button onClick={() => onOperation(wallet, 'transfer')} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-500/10 text-blue-700 border border-blue-200/50 py-2 text-xs font-bold hover:bg-blue-500/20 transition-colors">
                            <ArrowLeftRight className="h-3.5 w-3.5" /> تحويل
                        </button>
                    )}
                </div>
            </div>
            <button onClick={() => setShowTxns(s => !s)} className="w-full flex items-center justify-between px-5 py-3 text-xs font-bold text-muted-foreground hover:bg-muted/40 transition-colors">
                <span>كشف الحساب ({txns.length})</span>
                {showTxns ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showTxns && (
                <div className="divide-y divide-border/40 max-h-52 overflow-y-auto">
                    {txns.length === 0 ? (
                        <p className="py-4 text-center text-xs text-muted-foreground">لا توجد عمليات</p>
                    ) : txns.map(t => (
                        <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                            <div className="flex-1 min-w-0">
                                <p className={`text-xs font-bold ${txnColor[t.type]}`}>{txnLabel[t.type]}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{t.reason}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className={`text-sm font-black tabular-nums ${t.type === 'deposit' || t.type === 'transfer_in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {t.type === 'deposit' || t.type === 'transfer_in' ? '+' : '-'}{fmt(t.amount)}
                                </p>
                                <p className="text-[10px] text-muted-foreground">{new Date(t.date).toLocaleDateString('ar-EG')}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────

export default function WalletsPage() {
    const [wallets, setWallets] = useState(getWallets);
    const [showAdd, setShowAdd] = useState(false);
    const [opModal, setOpModal] = useState<{ wallet: WalletType; type: OpType } | null>(null);
    const { confirm } = useConfirm();
    const refresh = () => setWallets(getWallets());
    const totalBalance = useMemo(() => getTotalBalance(), [wallets]);

    // Compute today's totals
    const today = new Date().toISOString().slice(0, 10);
    const { todayIn, todayOut } = useMemo(() => {
        let todayIn = 0, todayOut = 0;
        wallets.forEach(w => {
            getTransactions(w.id).forEach(t => {
                if (!t.date.startsWith(today)) return;
                if (t.type === 'deposit' || t.type === 'transfer_in') todayIn += t.amount;
                else todayOut += t.amount;
            });
        });
        return { todayIn, todayOut };
    }, [wallets, today]);

    // Default wallet for quick actions
    const defaultWallet = useMemo(() => wallets.find(w => w.isDefault) || wallets[0], [wallets]);

    const handleDeleteWallet = async (w: WalletType) => {
        const balanceWarning = w.balance > 0 ? `\n⚠️ تحذير: هذه المحفظة تحتوي على رصيد ${fmt(w.balance)} ج.م!` : '';
        const ok = await confirm({ title: 'حذف محفظة', message: `هل أنت متأكد من حذف محفظة "${w.name}"؟ سيتم حذف جميع العمليات المرتبطة.${balanceWarning}`, confirmLabel: 'حذف', danger: true });
        if (ok) { deleteWallet(w.id); refresh(); }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">

            {/* ── ELOS Hero Balance Section ── */}
            <div
                className="relative rounded-2xl p-8 overflow-hidden border"
                style={{
                    background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)',
                    borderColor: 'hsl(var(--border))',
                }}
            >
                {/* Radial glow decorations */}
                <div className="absolute -top-1/2 -right-1/5 w-80 h-80 rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)' }} />
                <div className="absolute -bottom-1/3 -left-1/10 w-60 h-60 rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)' }} />

                <div className="relative grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-center">
                    {/* Left: balance info */}
                    <div className="space-y-4">
                        <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                            <Wallet className="h-4 w-4" /> إجمالي الرصيد الكلي
                        </p>
                        <p
                            className="font-black leading-none tracking-tight"
                            dir="ltr"
                            style={{
                                fontSize: 'clamp(40px, 8vw, 64px)',
                                background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            {fmt(totalBalance)}
                            <span className="text-2xl text-muted-foreground mr-2" style={{ WebkitTextFillColor: 'initial', WebkitBackgroundClip: 'initial', backgroundClip: 'initial' }}>ج.م</span>
                        </p>
                        {/* Mini stats */}
                        <div className="flex gap-6 flex-wrap">
                            <div>
                                <p className="text-[11px] text-muted-foreground font-semibold">الإيداع اليوم</p>
                                <p className="text-lg font-black" style={{ color: '#10b981' }}>+{fmt(todayIn)} ج.م</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-muted-foreground font-semibold">السحب اليوم</p>
                                <p className="text-lg font-black" style={{ color: '#ef4444' }}>-{fmt(todayOut)} ج.م</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-muted-foreground font-semibold">عدد المحافظ</p>
                                <p className="text-lg font-black text-foreground">{wallets.length}</p>
                            </div>
                        </div>
                    </div>

                    {/* Right: quick action buttons */}
                    {defaultWallet && (
                        <div className="flex flex-col gap-3 shrink-0">
                            <button
                                onClick={() => setOpModal({ wallet: defaultWallet, type: 'deposit' })}
                                className="flex items-center gap-3 px-6 py-3.5 rounded-xl font-bold text-white text-sm transition-all hover:-translate-y-0.5"
                                style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 15px rgba(16,185,129,0.35)' }}
                            >
                                <TrendingUp className="h-5 w-5" /> إيداع
                            </button>
                            <button
                                onClick={() => setOpModal({ wallet: defaultWallet, type: 'withdrawal' })}
                                className="flex items-center gap-3 px-6 py-3.5 rounded-xl font-bold text-white text-sm transition-all hover:-translate-y-0.5"
                                style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 4px 15px rgba(239,68,68,0.35)' }}
                            >
                                <TrendingDown className="h-5 w-5" /> سحب
                            </button>
                            {wallets.length > 1 && (
                                <button
                                    onClick={() => setOpModal({ wallet: defaultWallet, type: 'transfer' })}
                                    className="flex items-center gap-3 px-6 py-3.5 rounded-xl font-bold text-white text-sm transition-all hover:-translate-y-0.5"
                                    style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', boxShadow: '0 4px 15px rgba(59,130,246,0.35)' }}
                                >
                                    <ArrowLeftRight className="h-5 w-5" /> تحويل
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Header row */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" /> المحافظ ({wallets.length})
                </h2>
                <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg">
                    <Plus className="h-4 w-4" /> محفظة جديدة
                </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {wallets.map(w => (
                    <WalletCard key={w.id} wallet={w} allWallets={wallets}
                        onOperation={(wallet, type) => setOpModal({ wallet, type })}
                        onRefresh={refresh}
                        onDelete={handleDeleteWallet} />
                ))}
            </div>

            {showAdd && <AddWalletModal onClose={() => setShowAdd(false)} onDone={refresh} />}
            {opModal && <OperationModal wallet={opModal.wallet} wallets={wallets} type={opModal.type} onClose={() => setOpModal(null)} onDone={refresh} />}
        </div>
    );
}
