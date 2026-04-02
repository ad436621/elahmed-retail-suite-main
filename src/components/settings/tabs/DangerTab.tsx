// ── Danger Zone Tab ───────────────────────────────────────────
import { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { clearAllData } from '@/data/monthlyResetData';

interface Props {
    onDataCleared?: () => void;
}

export default function DangerTab({ onDataCleared }: Props) {
    const { toast } = useToast();
    const [confirmClear, setConfirmClear] = useState(false);
    const [confirmText, setConfirmText] = useState('');

    const handleClearAll = () => {
        if (confirmText.trim() !== 'امسح كل شيء') {
            toast({ title: 'خطأ', description: 'اكتب "امسح كل شيء" للتأكيد', variant: 'destructive' });
            return;
        }
        clearAllData();
        setConfirmClear(false);
        setConfirmText('');
        onDataCleared?.();
        toast({ title: '🗑️ تم مسح جميع البيانات', description: 'جارِ تحديث النظام...' });
        
        // Force a hard reload to clear all React state and memory caches
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    };

    return (
        <div className="rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-950/10 p-5 space-y-4">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/15 border border-red-200 dark:border-red-500/20">
                    <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-red-700">مسح جميع البيانات</h3>
                    <p className="text-[11px] text-red-500/80 mt-0.5">
                        حذف كل المبيعات، المخزون، الصيانة، الأقساط، المصاريف، والأرشيف. لا يمكن التراجع.
                    </p>
                </div>
            </div>

            {!confirmClear ? (
                <button onClick={() => setConfirmClear(true)}
                    className="flex items-center gap-2 rounded-xl border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all">
                    <Trash2 className="h-4 w-4" /> مسح كل البيانات
                </button>
            ) : (
                <div className="space-y-3 rounded-xl border border-red-300 bg-red-50/80 p-4 animate-fade-in">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-sm font-bold text-red-700">
                            تأكيد المسح — هذا الإجراء <u>نهائي</u> ولا يمكن التراجع عنه.<br />
                            اكتب <strong>امسح كل شيء</strong> للمتابعة:
                        </p>
                    </div>
                    <input value={confirmText}
                        onChange={e => setConfirmText(e.target.value)}
                        placeholder="امسح كل شيء"
                        className="w-full rounded-xl border border-red-300 dark:border-red-500/30 bg-white dark:bg-red-950/20 px-3 py-2.5 text-sm text-red-700 dark:text-red-400 placeholder:text-red-300/60 focus:outline-none focus:ring-2 focus:ring-red-400/40 font-bold" />
                    <div className="flex gap-2">
                        <button onClick={handleClearAll}
                            disabled={confirmText.trim() !== 'امسح كل شيء'}
                            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                            🗑️ نعم، امسح الكل
                        </button>
                        <button onClick={() => { setConfirmClear(false); setConfirmText(''); }}
                            className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                            إلغاء
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
