import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';
import { Sun, Moon, Globe, Plus, X, Trash2, RotateCcw, CalendarClock, Archive, AlertTriangle, FileDown, FileUp, Save, FolderOpen, HardDriveDownload, Image, Upload } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { getLegacyCategories, saveLegacyCategories } from '@/data/categoriesData';
import {
  getMonthlyResetSettings, saveMonthlyResetSettings,
  archiveCurrentPeriod, getMonthlyArchive,
  clearAllData, MonthlyArchiveEntry,
} from '@/data/monthlyResetData';
import {
  getBackupSettings, saveBackupSettings, downloadManualBackup,
  restoreBackupData, saveDirHandle, getDirHandle
} from '@/data/backupData';

const IC = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/60";

const SettingsPage = () => {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    companyName: settings.companyName,
    companySuffix: settings.companySuffix,
    branchName: settings.branchName,
    branchAddress: settings.branchAddress,
    shopPhone: settings.shopPhone,
    printerName: settings.printerName,
    logoUrl: settings.logoUrl,
  });

  useEffect(() => {
    setFormData({
      companyName: settings.companyName,
      companySuffix: settings.companySuffix,
      branchName: settings.branchName,
      branchAddress: settings.branchAddress,
      shopPhone: settings.shopPhone,
      printerName: settings.printerName,
      logoUrl: settings.logoUrl,
    });
  }, [settings]);

  // ── Category management ──────────────────────────────────
  const [cats, setCats] = useState<string[]>(() => getLegacyCategories());
  const [newCat, setNewCat] = useState('');

  const addCategory = () => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    if (cats.includes(trimmed)) {
      toast({ title: 'خطأ', description: 'الفئة موجودة بالفعل', variant: 'destructive' });
      return;
    }
    const updated = [...cats, trimmed];
    setCats(updated);
    saveLegacyCategories(updated);
    setNewCat('');
    toast({ title: 'تم إضافة الفئة', description: trimmed });
  };

  const removeCategory = (cat: string) => {
    const updated = cats.filter(c => c !== cat);
    setCats(updated);
    saveLegacyCategories(updated);
    toast({ title: 'تم حذف الفئة', description: cat });
  };

  const handleSave = () => {
    updateSettings(formData);
    toast({ title: '✅ تم الحفظ', description: 'تم تطبيق إعدادات المحل.' });
  };

  // ── Monthly Reset ────────────────────────────────────────
  const [resetSettings, setResetSettings] = useState(() => getMonthlyResetSettings());
  const [archive, setArchive] = useState<MonthlyArchiveEntry[]>(() => getMonthlyArchive());

  const handleSaveResetSettings = () => {
    saveMonthlyResetSettings(resetSettings);
    toast({ title: '✅ تم حفظ إعداد التصفير الشهري' });
  };

  const handleManualArchive = () => {
    archiveCurrentPeriod({
      note: 'تصفير يدوي من الإعدادات',
      archivedManually: true,
    });
    setArchive(getMonthlyArchive());
    setResetSettings(getMonthlyResetSettings());
    toast({ title: '✅ تم حفظ الفترة الحالية في الأرشيف', description: 'الإحصائيات الحالية أُرشفت وستبدأ فترة جديدة.' });
  };

  // ── Backup & Restore ─────────────────────────────────────
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
        toast({ title: 'خطأ', description: 'متصفحك لا يدعم خاصية التحديد التلقائي للمجلدات. استخدم جوجل كروم أو إيدج.', variant: 'destructive' });
        return;
      }
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      await saveDirHandle(dirHandle);
      setHasBackupDir(true);
      toast({ title: '✅ تم تحديد مجلد الحفظ التلقائي بنجاح' });
    } catch (err) {
      console.error(err);
      // User cancelled or error
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
    e.target.value = ''; // Reset input to allow same file again
  };

  // ── Clear All Data ───────────────────────────────────────
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
    setArchive([]);
    toast({ title: '🗑️ تم مسح جميع البيانات', description: 'تم حذف كل البيانات. الإعدادات محفوظة.' });
  };

  // Handle logo upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: 'خطأ', description: 'يرجى اختيار ملف صورة صالح', variant: 'destructive' });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'خطأ', description: 'حجم الصورة يجب أن يكون أقل من 2 ميجابايت', variant: 'destructive' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setFormData(f => ({ ...f, logoUrl: dataUrl }));
      toast({ title: 'تم رفع الشعار', description: 'اضغط حفظ لتطبيق التغييرات' });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold text-foreground">الإعدادات</h1>

      {/* ── Store Info ── */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-foreground">بيانات المحل</h2>
        <div className="space-y-4">
          {/* Logo Upload */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">شعار الشركة</label>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl overflow-hidden border-2 border-border bg-muted flex items-center justify-center">
                {formData.logoUrl ? (
                  <img src={formData.logoUrl} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <Image className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-primary/50 bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  <Upload className="h-4 w-4" /> تغيير الشعار
                </button>
                <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG بحد أقصى 2MB</p>
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">اسم الشركة</label>
            <input
              value={formData.companyName}
              onChange={e => setFormData(f => ({ ...f, companyName: e.target.value }))}
              placeholder="اسم الشركة"
              className={IC}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">اللاحقة القانونية</label>
            <input
              value={formData.companySuffix}
              onChange={e => setFormData(f => ({ ...f, companySuffix: e.target.value }))}
              placeholder="ش. ذ. م.م"
              className={IC}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">اسم الفرع</label>
            <input value={formData.branchName} onChange={e => setFormData(f => ({ ...f, branchName: e.target.value }))} placeholder="مثال: الفرع الرئيسي" className={IC} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">عنوان الفرع</label>
            <textarea value={formData.branchAddress} onChange={e => setFormData(f => ({ ...f, branchAddress: e.target.value }))} rows={2} className={`${IC} resize-none`} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">رقم هاتف المحل (للفاتورة)</label>
            <input value={formData.shopPhone} onChange={e => setFormData(f => ({ ...f, shopPhone: e.target.value }))} placeholder="مثال: 010xxxxxxxx" className={IC} dir="ltr" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">اسم طابعة الفواتير (للعرض فقط)</label>
            <input value={formData.printerName} onChange={e => setFormData(f => ({ ...f, printerName: e.target.value }))} placeholder="Thermal Printer 80mm" className={IC} dir="ltr" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">العملة</label>
            <div className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed">EGP (ج.م)</div>
          </div>
        </div>
      </div>

      {/* ── Category Management ── */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-foreground">إدارة الفئات</h2>
        <div className="flex gap-2">
          <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCategory()} placeholder="اسم الفئة الجديدة..." className={`flex-1 ${IC}`} />
          <button onClick={addCategory} className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> إضافة
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {cats.map(cat => (
            <span key={cat} className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm font-medium text-card-foreground hover:border-destructive/30 transition-colors">
              {cat}
              <button onClick={() => removeCategory(cat)} className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        {cats.length === 0 && <p className="text-sm text-muted-foreground">لا توجد فئات.</p>}
      </div>

      {/* ── Theme ── */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-foreground">{t('settings.theme')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setTheme('light')} className={cn('flex items-center gap-3 rounded-lg border-2 p-4 transition-colors', theme === 'light' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50')}>
            <Sun className="h-5 w-5 text-card-foreground" /><span className="text-sm font-medium text-card-foreground">{t('settings.light')}</span>
          </button>
          <button onClick={() => setTheme('dark')} className={cn('flex items-center gap-3 rounded-lg border-2 p-4 transition-colors', theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50')}>
            <Moon className="h-5 w-5 text-card-foreground" /><span className="text-sm font-medium text-card-foreground">{t('settings.dark')}</span>
          </button>
        </div>
      </div>

      {/* ── Language ── */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-foreground">{t('settings.language')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setLanguage('en')} className={cn('flex items-center gap-3 rounded-lg border-2 p-4 transition-colors', language === 'en' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50')}>
            <Globe className="h-5 w-5 text-card-foreground" /><span className="text-sm font-medium text-card-foreground">English</span>
          </button>
          <button onClick={() => setLanguage('ar')} className={cn('flex items-center gap-3 rounded-lg border-2 p-4 transition-colors', language === 'ar' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50')}>
            <Globe className="h-5 w-5 text-card-foreground" /><span className="text-sm font-medium text-card-foreground">العربية</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
                🗓️ MONTHLY RESET SECTION
            ══════════════════════════════════════════════ */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 border border-blue-200">
            <CalendarClock className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">التصفير الشهري للإحصائيات</h2>
            <p className="text-xs text-muted-foreground mt-0.5">تعيد ضبط الملخص المالي في لوحة التحكم تلقائياً كل شهر. البيانات الفعلية (مبيعات، صيانة...) تبقى كاملة في كل قسم.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Toggle */}
          <div className="col-span-2">
            <div className="flex items-center justify-between rounded-xl border border-border bg-card shadow-sm px-4 py-3">
              <div>
                <p className="text-sm font-bold text-foreground">تفعيل التصفير التلقائي</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">سيتم أرشفة إحصائيات الشهر الماضي وبدء شهر جديد تلقائياً</p>
              </div>
              <button
                onClick={() => setResetSettings(s => ({ ...s, resetDay: s.resetDay ? 0 : 1 }))}
                dir="ltr"
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${resetSettings.resetDay > 0 ? 'bg-primary' : 'bg-muted/50'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${resetSettings.resetDay > 0 ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* Day picker */}
          {resetSettings.resetDay > 0 && (
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">يوم التصفير في الشهر</label>
              <div className="flex items-center gap-3">
                <input
                  type="number" min={1} max={28}
                  value={resetSettings.resetDay}
                  onChange={e => setResetSettings(s => ({ ...s, resetDay: Math.min(28, Math.max(1, +e.target.value)) }))}
                  className="w-24 rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-center font-bold tabular-nums"
                />
                <p className="text-sm text-muted-foreground">من كل شهر (1–28 لضمان التوافق مع فبراير)</p>
              </div>
              {resetSettings.lastResetDate && (
                <p className="mt-2 text-xs text-muted-foreground">
                  آخر تصفير: <span className="font-semibold text-foreground">{new Date(resetSettings.lastResetDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={handleSaveResetSettings} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all">
            <CalendarClock className="h-4 w-4" /> حفظ الإعداد
          </button>
          <button onClick={handleManualArchive} className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-all">
            <RotateCcw className="h-4 w-4 text-blue-500" /> أرشف وصفّر الآن
          </button>
        </div>

        {/* Archive list */}
        {archive.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Archive className="h-3.5 w-3.5" /> الأرشيف الشهري ({archive.length} فترة)
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {archive.map(entry => (
                <div key={entry.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{entry.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {entry.periodStart} → {entry.periodEnd}
                      {entry.snapshot?.archivedManually && <span className="mr-2 text-blue-500">(يدوي)</span>}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60">{new Date(entry.archivedAt).toLocaleDateString('ar-EG')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
                💾 BACKUP & RESTORE SECTION
            ══════════════════════════════════════════════ */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 border border-teal-200">
            <Save className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">النسخ الاحتياطي والاستعادة</h2>
            <p className="text-xs text-muted-foreground mt-0.5">حفظ واسترجاع كل بيانات النظام في ملف واحد لضمان عدم ضياعها.</p>
          </div>
        </div>

        {/* Manual Backup & Restore */}
        <div className="flex flex-wrap gap-2 pt-1 border-b border-border/40 pb-5">
          <button onClick={downloadManualBackup} className="flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl bg-card border border-primary/30 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 active:scale-95 transition-all">
            <FileDown className="h-4 w-4" /> حفظ نسخة الآن
          </button>
          <label className="flex flex-1 min-w-[140px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-card border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted active:scale-95 transition-all">
            <FileUp className="h-4 w-4 text-blue-500" /> استرداد نسخة
            <input type="file" accept=".json" className="hidden" onChange={handleRestoreFile} />
          </label>
        </div>

        {/* Auto Backup Toggle */}
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border bg-card shadow-sm px-4 py-3">
            <div>
              <p className="text-sm font-bold text-foreground">الحفظ التلقائي</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">أخذ نسخة احتياطية بشكل دوري في مجلد محدد</p>
            </div>
            <button
              onClick={() => setBackupSettings(s => ({ ...s, autoBackupEnabled: !s.autoBackupEnabled }))}
              dir="ltr"
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${backupSettings.autoBackupEnabled ? 'bg-primary' : 'bg-muted/50'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${backupSettings.autoBackupEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {backupSettings.autoBackupEnabled && (
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4 animate-scale-in">
              <div>
                <label className="mb-2 block text-xs font-semibold text-muted-foreground">معدل الحفظ التلقائي</label>
                <select
                  value={[1, 6, 12, 24].includes(backupSettings.intervalHours) ? backupSettings.intervalHours : 'custom'}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === 'custom') {
                      setBackupSettings(s => ({ ...s, intervalHours: 48 })); // default to 2 days
                    } else {
                      setBackupSettings(s => ({ ...s, intervalHours: Number(val) }));
                    }
                  }}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value={1}>كل ساعة</option>
                  <option value={6}>كل 6 ساعات</option>
                  <option value={12}>كل 12 ساعة</option>
                  <option value={24}>يومياً (كل 24 ساعة)</option>
                  <option value="custom">أيام مخصصة...</option>
                </select>

                {![1, 6, 12, 24].includes(backupSettings.intervalHours) && (
                  <div className="mt-3 flex items-center gap-3 animate-fade-in">
                    <input
                      type="number" min={1} max={365}
                      value={backupSettings.intervalHours / 24}
                      onChange={e => {
                        const days = Math.max(1, Number(e.target.value));
                        setBackupSettings(s => ({ ...s, intervalHours: days * 24 }));
                      }}
                      className="w-24 text-center rounded-xl border border-input bg-card px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums"
                    />
                    <span className="text-sm font-medium text-muted-foreground">يوم / أيام يحصل بعدها مسح تلقائي</span>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-muted-foreground">مجلد الحفظ</label>
                <div className="flex items-center gap-2">
                  <button onClick={handleChooseBackupDir} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-card border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
                    <FolderOpen className="h-4 w-4 text-emerald-500" />
                    {hasBackupDir ? 'تغيير المجلد' : 'تحديد مجلد للحفظ التلقائي'}
                  </button>
                </div>
                {hasBackupDir && <p className="mt-2 text-[10px] text-emerald-600 font-medium">✔️ تم تحديد المجلد مسبقاً</p>}
                {!hasBackupDir && <p className="mt-2 text-[10px] text-red-500 font-medium">⚠️ يجب تحديد مجلد ليعمل الحفظ التلقائي بشكل سليم</p>}
              </div>

              <button onClick={handleSaveBackupSettings} className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all">
                <HardDriveDownload className="h-4 w-4" /> حفظ الإعداد
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
                🗑️ CLEAR ALL DATA SECTION
            ══════════════════════════════════════════════ */}
      <div className="rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/10 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 border border-red-200">
            <Trash2 className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-red-700">مسح جميع البيانات</h2>
            <p className="text-xs text-red-500/80 mt-0.5">حذف كل المبيعات، المخزون، الصيانة، الأقساط، المصاريف، والأرشيف. لا يمكن التراجع.</p>
          </div>
        </div>

        {!confirmClear ? (
          <button
            onClick={() => setConfirmClear(true)}
            className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 active:scale-95 transition-all"
          >
            <Trash2 className="h-4 w-4" /> مسح كل البيانات
          </button>
        ) : (
          <div className="space-y-3 rounded-xl border border-red-300 bg-red-50/80 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-red-700">
                تأكيد المسح — هذا الإجراء <u>نهائي</u> ولا يمكن التراجع عنه.<br />
                اكتب <strong>امسح كل شيء</strong> في الخانة أدناه للمتابعة:
              </p>
            </div>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="امسح كل شيء"
              className="w-full rounded-xl border border-red-300 bg-white px-3 py-2.5 text-sm text-red-700 placeholder:text-red-300/60 focus:outline-none focus:ring-2 focus:ring-red-400/40 font-bold"
            />
            <div className="flex gap-2">
              <button
                onClick={handleClearAll}
                disabled={confirmText.trim() !== 'امسح كل شيء'}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                🗑️ نعم، امسح جميع البيانات
              </button>
              <button onClick={() => { setConfirmClear(false); setConfirmText(''); }} className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <button onClick={handleSave} className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors">
        {t('settings.save')}
      </button>
    </div>
  );
};

export default SettingsPage;
