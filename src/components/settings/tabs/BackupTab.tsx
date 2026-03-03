// ── Backup Tab ────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { Database, FileDown, FileUp, FolderOpen, HardDriveDownload, CalendarClock, RotateCcw, Archive } from 'lucide-react';
import SectionCard from '@/components/settings/SectionCard';
import ToggleRow from '@/components/settings/ToggleRow';
import { useToast } from '@/hooks/use-toast';
import {
    getBackupSettings, saveBackupSettings, downloadManualBackup,
    restoreBackupData, saveDirHandle, getDirHandle
} from '@/data/backupData';
import {
    getMonthlyResetSettings, saveMonthlyResetSettings,
    archiveCurrentPeriod, getMonthlyArchive,
    MonthlyArchiveEntry,
} from '@/data/monthlyResetData';

const IC = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/60";

export default function BackupTab() {
    const { toast } = useToast();

    // ─ Backup ─
    const [backupSettings, setBackupSettings] = useState(() => getBackupSettings());
    const [hasBackupDir, setHasBackupDir] = useState(false);

    useEffect(() => {
        getDirHandle().then(handle => setHasBackupDir(!!handle));
    }, []);

    const handleSaveBackupSettings = () => {
        saveBackupSettings(backupSettings);
        toast({ title: '✅ تم حفظ إعدادات النسخ الاحتياطي' });
    };

    const handleChooseBackupDir = async () => {
        try {
            if (!(window as any).showDirectoryPicker) {
                toast({ title: 'خطأ', description: 'متصفحك لا يدعم خاصية التحديد التلقائي للمجلدات.', variant: 'destructive' });
                return;
            }
            const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
            await saveDirHandle(dirHandle);
            setHasBackupDir(true);
            toast({ title: '✅ تم تحديد مجلد الحفظ التلقائي بنجاح' });
        } catch (err) {
            console.error(err);
        }
    };

    const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            if (restoreBackupData(text)) {
                toast({ title: '✅ تم استعادة النسخة بنجاح', description: 'سيتم إعادة تحميل الصفحة الآن...' });
                setTimeout(() => window.location.reload(), 1500);
            } else {
                toast({ title: 'خطأ', description: 'ملف النسخة الاحتياطية غير صالح أو تالف', variant: 'destructive' });
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // ─ Monthly Reset ─
    const [resetSettings, setResetSettings] = useState(() => getMonthlyResetSettings());
    const [archive, setArchive] = useState<MonthlyArchiveEntry[]>(() => getMonthlyArchive());

    const handleSaveResetSettings = () => {
        saveMonthlyResetSettings(resetSettings);
        toast({ title: '✅ تم حفظ إعداد التصفير الشهري' });
    };

    const handleManualArchive = () => {
        archiveCurrentPeriod({ note: 'تصفير يدوي من الإعدادات', archivedManually: true });
        setArchive(getMonthlyArchive());
        setResetSettings(getMonthlyResetSettings());
        toast({ title: '✅ تم حفظ الفترة الحالية في الأرشيف', description: 'الإحصائيات الحالية أُرشفت وستبدأ فترة جديدة.' });
    };

    return (
        <>
            {/* Backup Card */}
            <SectionCard icon={<Database className="h-5 w-5" />} title="النسخ الاحتياطي"
                desc="حماية بياناتك — النسخة تشمل كل معلومات قاعدة البيانات"
                color="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400">
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <button onClick={downloadManualBackup}
                            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-3 text-sm font-bold hover:bg-emerald-700 transition-all shadow-md">
                            <FileDown className="h-4 w-4" /> إنشاء نسخة احتياطية الآن
                        </button>
                        <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold hover:bg-muted transition-all">
                            <FileUp className="h-4 w-4 text-blue-500" /> استعادة نسخة احتياطية
                            <input type="file" accept=".json" className="hidden" onChange={handleRestoreFile} />
                        </label>
                    </div>

                    <ToggleRow value={backupSettings.autoBackupEnabled}
                        onChange={v => setBackupSettings(s => ({ ...s, autoBackupEnabled: v }))}
                        label="النسخ الاحتياطي التلقائي" desc="حفظ تلقائي دوري بدون تدخل" />

                    {backupSettings.autoBackupEnabled && (
                        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4 animate-fade-in">
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">معدل الحفظ</label>
                                <select
                                    value={[1, 6, 12, 24].includes(backupSettings.intervalHours) ? backupSettings.intervalHours : 'custom'}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setBackupSettings(s => ({ ...s, intervalHours: val === 'custom' ? 48 : Number(val) }));
                                    }} className={IC}>
                                    <option value={1}>كل ساعة</option>
                                    <option value={6}>كل 6 ساعات</option>
                                    <option value={12}>كل 12 ساعة</option>
                                    <option value={24}>يومياً</option>
                                    <option value="custom">مخصص...</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">مجلد الحفظ</label>
                                <button onClick={handleChooseBackupDir}
                                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                                    <FolderOpen className="h-4 w-4 text-emerald-500" />
                                    {hasBackupDir ? 'تغيير المجلد' : 'تحديد مجلد'}
                                </button>
                                {hasBackupDir && <p className="mt-1.5 text-[10px] text-emerald-600 font-medium">✔️ المجلد محدد</p>}
                            </div>
                            <button onClick={handleSaveBackupSettings}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all">
                                <HardDriveDownload className="h-4 w-4" /> حفظ الإعداد
                            </button>
                        </div>
                    )}
                </div>
            </SectionCard>

            {/* Monthly Reset Card */}
            <SectionCard icon={<CalendarClock className="h-5 w-5" />} title="التصفير الشهري"
                desc="أرشفة إحصائيات الشهر وبدء فترة جديدة"
                color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <div className="space-y-4">
                    <ToggleRow value={resetSettings.resetDay > 0}
                        onChange={v => setResetSettings(s => ({ ...s, resetDay: v ? 1 : 0 }))}
                        label="تفعيل التصفير التلقائي" desc="أرشفة إحصائيات الشهر الماضي تلقائياً" />

                    {resetSettings.resetDay > 0 && (
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-muted-foreground">يوم التصفير</label>
                            <div className="flex items-center gap-3">
                                <input type="number" min={1} max={28} value={resetSettings.resetDay}
                                    onChange={e => setResetSettings(s => ({ ...s, resetDay: Math.min(28, Math.max(1, +e.target.value)) }))}
                                    className="w-20 text-center rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-bold tabular-nums" />
                                <span className="text-xs text-muted-foreground">من كل شهر (1–28)</span>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button onClick={handleSaveResetSettings}
                            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all">
                            <CalendarClock className="h-4 w-4" /> حفظ
                        </button>
                        <button onClick={handleManualArchive}
                            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:bg-muted transition-all">
                            <RotateCcw className="h-4 w-4 text-blue-500" /> أرشف الآن
                        </button>
                    </div>

                    {archive.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                                <Archive className="h-3.5 w-3.5" /> سجل الأرشيف ({archive.length} فترة)
                            </p>
                            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                                {archive.map((entry, i) => (
                                    <div key={entry.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                                        <div>
                                            <p className="text-xs font-bold text-foreground">#{i + 1} {entry.label}</p>
                                            <p className="text-[10px] text-muted-foreground">{entry.periodStart} → {entry.periodEnd}</p>
                                        </div>
                                        <span className="text-[9px] text-muted-foreground/60">{new Date(entry.archivedAt).toLocaleDateString('ar-EG')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </SectionCard>
        </>
    );
}
