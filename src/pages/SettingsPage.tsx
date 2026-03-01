import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';
import {
  Sun, Moon, Globe, Plus, X, Trash2, RotateCcw, CalendarClock, Archive, AlertTriangle,
  FileDown, FileUp, Save, FolderOpen, HardDriveDownload, Image, Upload,
  Settings, Building2, Printer, Bell, BellOff, Volume2, VolumeX,
  Database, Shield, Type, Minus as MinusIcon, Plus as PlusIcon, ChevronLeft,
  Wallet, Receipt, Hash, CreditCard, Banknote, ToggleLeft, Info, Phone, Clock, ExternalLink, MessageCircle
} from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
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

const IC = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/60";

type TabId = 'general' | 'system' | 'notifications' | 'backup' | 'wallets' | 'invoices' | 'about' | 'danger';

const TABS: { id: TabId; label: string; icon: React.ReactNode; color?: string }[] = [
  { id: 'general', label: 'الإعدادات العامة', icon: <Building2 className="h-4 w-4" /> },
  { id: 'system', label: 'تخصيصات النظام', icon: <Settings className="h-4 w-4" /> },
  { id: 'invoices', label: 'إعدادات الفواتير', icon: <Receipt className="h-4 w-4" /> },
  { id: 'wallets', label: 'إدارة المحفظة', icon: <Wallet className="h-4 w-4" /> },
  { id: 'notifications', label: 'الإشعارات', icon: <Bell className="h-4 w-4" /> },
  { id: 'backup', label: 'النسخ الاحتياطي', icon: <Database className="h-4 w-4" /> },
  { id: 'about', label: 'حول البرنامج', icon: <Info className="h-4 w-4" /> },
  { id: 'danger', label: 'منطقة الخطر', icon: <AlertTriangle className="h-4 w-4" />, color: 'text-red-500' },
];

// Wallet/Transfer settings
const WALLETS_KEY = 'elos_wallets';
const INVOICES_KEY = 'elos_invoice_settings';
const TRANSFERS_KEY = 'elos_transfer_settings';

interface EWallet { id: string; name: string; isDefault: boolean; }
interface BankAccount { id: string; name: string; isDefault: boolean; }
interface InvoiceNumbering { prefix: string; padding: number; }
interface InvoiceSettings {
  sales: InvoiceNumbering; expense: InvoiceNumbering; repair: InvoiceNumbering;
  return_: InvoiceNumbering; purchase: InvoiceNumbering;
  showDate: boolean; showInvoiceNo: boolean; showClientDetails: boolean; showPaymentMethod: boolean;
  footerMessage: string;
}
interface TransferMethod { id: string; name: string; enabled: boolean; commission: number; }

const defaultInvoiceSettings: InvoiceSettings = {
  sales: { prefix: 'ACC-', padding: 6 }, expense: { prefix: 'EXP-', padding: 6 },
  repair: { prefix: 'REP-', padding: 6 }, return_: { prefix: 'RET-', padding: 6 },
  purchase: { prefix: 'PUR-', padding: 6 },
  showDate: true, showInvoiceNo: true, showClientDetails: true, showPaymentMethod: true,
  footerMessage: 'شكراً لتعاملكم معنا',
};
const defaultTransfers: TransferMethod[] = [
  { id: 'vodafone', name: 'فودافون كاش', enabled: true, commission: 10 },
  { id: 'etisalat', name: 'اتصالات كاش', enabled: true, commission: 10 },
  { id: 'orange', name: 'أورنج كاش', enabled: true, commission: 10 },
  { id: 'dbay', name: 'دي باي', enabled: true, commission: 10 },
  { id: 'instapay', name: 'استلامي', enabled: true, commission: 10 },
];

// Notification settings stored in localStorage  
const NOTIF_KEY = 'elos_notifications_settings';
interface NotifSettings {
  enabled: boolean;
  sounds: boolean;
  reminders: boolean;
  salesAlerts: boolean;
  inventoryAlerts: boolean;
}
const defaultNotifs: NotifSettings = { enabled: true, sounds: true, reminders: true, salesAlerts: true, inventoryAlerts: true };

const SettingsPage = () => {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabId>('general');

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

  // ── Category management ──
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

  // ── Monthly Reset ──
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

  // ── Backup & Restore ──
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

  // ── Clear All Data ──
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

  // ── Logo Upload ──
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'خطأ', description: 'يرجى اختيار ملف صورة صالح', variant: 'destructive' });
      return;
    }
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

  // ── Notifications ──
  const [notifSettings, setNotifSettings] = useState<NotifSettings>(() => {
    try { return { ...defaultNotifs, ...JSON.parse(localStorage.getItem(NOTIF_KEY) || '{}') }; }
    catch { return defaultNotifs; }
  });

  const saveNotifs = (s: NotifSettings) => {
    setNotifSettings(s);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(s));
    toast({ title: '✅ تم حفظ إعدادات الإشعارات' });
  };

  // ── Font Size ──
  const [fontSize, setFontSize] = useState(() => {
    return parseInt(localStorage.getItem('elos_font_size') || '100');
  });

  const applyFontSize = (size: number) => {
    const clamped = Math.max(60, Math.min(150, size));
    setFontSize(clamped);
    document.documentElement.style.fontSize = `${clamped}%`;
    localStorage.setItem('elos_font_size', String(clamped));
  };

  // ── Wallets ──
  const [eWallets, setEWallets] = useState<EWallet[]>(() => {
    try { return JSON.parse(localStorage.getItem(WALLETS_KEY + '_e') || '[]'); } catch { return []; }
  });
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => {
    try { return JSON.parse(localStorage.getItem(WALLETS_KEY + '_b') || '[]'); } catch { return []; }
  });
  const [newWalletName, setNewWalletName] = useState('');
  const [newBankName, setNewBankName] = useState('');

  const addWallet = () => { if (!newWalletName.trim()) return; const w = { id: Date.now().toString(), name: newWalletName.trim(), isDefault: eWallets.length === 0 }; const u = [...eWallets, w]; setEWallets(u); localStorage.setItem(WALLETS_KEY + '_e', JSON.stringify(u)); setNewWalletName(''); toast({ title: 'تمت الإضافة' }); };
  const removeWallet = (id: string) => { const u = eWallets.filter(w => w.id !== id); setEWallets(u); localStorage.setItem(WALLETS_KEY + '_e', JSON.stringify(u)); };
  const addBank = () => { if (!newBankName.trim()) return; const b = { id: Date.now().toString(), name: newBankName.trim(), isDefault: bankAccounts.length === 0 }; const u = [...bankAccounts, b]; setBankAccounts(u); localStorage.setItem(WALLETS_KEY + '_b', JSON.stringify(u)); setNewBankName(''); toast({ title: 'تمت الإضافة' }); };
  const removeBank = (id: string) => { const u = bankAccounts.filter(b => b.id !== id); setBankAccounts(u); localStorage.setItem(WALLETS_KEY + '_b', JSON.stringify(u)); };

  // ── Invoice Settings ──
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(() => {
    try { return { ...defaultInvoiceSettings, ...JSON.parse(localStorage.getItem(INVOICES_KEY) || '{}') }; } catch { return defaultInvoiceSettings; }
  });
  const saveInvoiceSettings = () => { localStorage.setItem(INVOICES_KEY, JSON.stringify(invoiceSettings)); toast({ title: '✅ تم حفظ إعدادات الفواتير' }); };

  // ── Transfer Settings ──
  const [transfers, setTransfers] = useState<TransferMethod[]>(() => {
    try { const s = JSON.parse(localStorage.getItem(TRANSFERS_KEY) || '[]'); return s.length ? s : defaultTransfers; } catch { return defaultTransfers; }
  });
  const [commissionMethod, setCommissionMethod] = useState('per1000');
  const [newTransferName, setNewTransferName] = useState('');
  const saveTransfers = () => { localStorage.setItem(TRANSFERS_KEY, JSON.stringify(transfers)); toast({ title: '✅ تم حفظ إعدادات التحويلات' }); };
  const addTransfer = () => { if (!newTransferName.trim()) return; setTransfers(t => [...t, { id: Date.now().toString(), name: newTransferName.trim(), enabled: true, commission: 10 }]); setNewTransferName(''); };

  // ── Toggle Switch Component ──
  const Toggle = ({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) => (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
      <div>
        <p className="text-sm font-bold text-foreground">{label}</p>
        {desc && <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <button onClick={() => onChange(!value)} dir="ltr"
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${value ? 'bg-primary' : 'bg-muted/50'}`}>
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );

  // ── Section Card ──
  const SectionCard = ({ icon, title, desc, children, color = 'bg-primary/10 text-primary' }: { icon: React.ReactNode; title: string; desc?: string; children: React.ReactNode; color?: string }) => (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 ${color}`}>
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          {desc && <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
        </div>
      </div>
      {children}
    </div>
  );

  return (
    <div className="animate-fade-in" dir="rtl">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 border border-violet-200">
          <Settings className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground">الإعدادات</h1>
          <p className="text-xs text-muted-foreground mt-0.5">إدارة وتخصيص النظام</p>
        </div>
      </div>

      {/* ─── Tab Navigation ─── */}
      <div className="flex gap-1.5 w-full overflow-x-auto hide-scrollbar pb-3 mb-5 border-b border-border">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn(
              'shrink-0 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all border',
              activeTab === tab.id
                ? 'bg-primary/10 text-primary border-primary/30 shadow-sm'
                : `bg-card border-border ${tab.color || 'text-muted-foreground'} hover:text-foreground hover:border-primary/30`
            )}>
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB CONTENT ═══ */}
      <div className="max-w-3xl mx-auto space-y-5">

        {/* ── Tab: General Settings ── */}
        {activeTab === 'general' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Company Info */}
              <SectionCard icon={<Building2 className="h-5 w-5" />} title="معلومات الشركة" desc="البيانات الأساسية للمحل" color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">اسم الشركة</label>
                    <input value={formData.companyName} onChange={e => setFormData(f => ({ ...f, companyName: e.target.value }))} className={IC} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">اللاحقة القانونية</label>
                    <input value={formData.companySuffix} onChange={e => setFormData(f => ({ ...f, companySuffix: e.target.value }))} placeholder="ش. ذ. م.م" className={IC} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">اسم الفرع</label>
                    <input value={formData.branchName} onChange={e => setFormData(f => ({ ...f, branchName: e.target.value }))} className={IC} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">عنوان الفرع</label>
                    <textarea value={formData.branchAddress} onChange={e => setFormData(f => ({ ...f, branchAddress: e.target.value }))} rows={2} className={`${IC} resize-none`} />
                  </div>
                </div>
              </SectionCard>

              {/* Logo & Regional */}
              <SectionCard icon={<Globe className="h-5 w-5" />} title="الإعدادات الإقليمية" desc="اللغة والتاريخ" color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <div className="space-y-3">
                  {/* Logo */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">شعار الشركة (Logo)</label>
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 rounded-xl overflow-hidden border-2 border-border bg-muted flex items-center justify-center shrink-0">
                        {formData.logoUrl
                          ? <img src={formData.logoUrl} alt="Logo" className="h-full w-full object-contain" />
                          : <Image className="h-6 w-6 text-muted-foreground/40" />
                        }
                      </div>
                      <div className="flex-1">
                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                        <button onClick={() => logoInputRef.current?.click()}
                          className="flex items-center gap-1.5 rounded-lg border border-dashed border-primary/50 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 transition-colors">
                          <Upload className="h-3.5 w-3.5" /> اختيار ملف
                        </button>
                        <p className="text-[9px] text-muted-foreground mt-1">PNG / JPG (الحد الأقصى 2MB)</p>
                      </div>
                    </div>
                  </div>

                  {/* Currency */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">العملة</label>
                    <div className="w-full rounded-xl border border-input bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground cursor-not-allowed">EGP (جنيه مصري)</div>
                  </div>

                  {/* Theme */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">المظهر</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setTheme('light')} className={cn('flex items-center gap-2 rounded-xl border-2 p-3 text-xs font-bold transition-all', theme === 'light' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50')}>
                        <Sun className="h-4 w-4" /> فاتح
                      </button>
                      <button onClick={() => setTheme('dark')} className={cn('flex items-center gap-2 rounded-xl border-2 p-3 text-xs font-bold transition-all', theme === 'dark' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50')}>
                        <Moon className="h-4 w-4" /> داكن
                      </button>
                    </div>
                  </div>

                  {/* Language */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">اللغة</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setLanguage('ar')} className={cn('flex items-center gap-2 rounded-xl border-2 p-3 text-xs font-bold transition-all', language === 'ar' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50')}>
                        <Globe className="h-4 w-4" /> العربية
                      </button>
                      <button onClick={() => setLanguage('en')} className={cn('flex items-center gap-2 rounded-xl border-2 p-3 text-xs font-bold transition-all', language === 'en' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50')}>
                        <Globe className="h-4 w-4" /> English
                      </button>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Save Button */}
            <button onClick={handleSave} className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-md">
              <Save className="h-4 w-4" /> حفظ
            </button>
          </>
        )}

        {/* ── Tab: System Customization ── */}
        {activeTab === 'system' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Thermal Printer */}
              <SectionCard icon={<Printer className="h-5 w-5" />} title="إعدادات الطابعة الحرارية" desc="تخصيص الفواتير والإيصالات" color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">عرض الورقة</label>
                    <select value={formData.printerName} onChange={e => setFormData(f => ({ ...f, printerName: e.target.value }))} className={IC}>
                      <option value="80mm Thermal Printer">80mm (قياسي)</option>
                      <option value="58mm Thermal Printer">58mm (صغير)</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">رقم الهاتف (يظهر على الفاتورة)</label>
                    <input value={formData.shopPhone} onChange={e => setFormData(f => ({ ...f, shopPhone: e.target.value }))} placeholder="01xxxxxxxxx" className={IC} dir="ltr" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">العنوان (يظهر على الفاتورة)</label>
                    <input value={formData.branchAddress} onChange={e => setFormData(f => ({ ...f, branchAddress: e.target.value }))} className={IC} />
                  </div>
                </div>
              </SectionCard>

              {/* Inventory Settings */}
              <SectionCard icon={<Shield className="h-5 w-5" />} title="إعدادات المخزون" desc="تنبيهات وحدود المخزون" color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                <div className="space-y-3">
                  <Toggle value={resetSettings.resetDay > 0}
                    onChange={v => setResetSettings(s => ({ ...s, resetDay: v ? 1 : 0 }))}
                    label="تنبيه المخزون المنخفض" desc="ينبهك عند انخفاض المخزون عن الحد" />

                  {resetSettings.resetDay > 0 && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">حد تنبيه المخزون</label>
                      <div className="flex items-center gap-3">
                        <input type="number" min={1} max={100} value={10}
                          className="w-20 text-center rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums" readOnly />
                        <span className="text-xs text-muted-foreground">وحدة</span>
                      </div>
                    </div>
                  )}

                  <Toggle value={true} onChange={() => { }} label="منع البيع بدون مخزون" desc="لا يقبل بيع منتج بكمية صفر أو ناقصة" />
                </div>
              </SectionCard>
            </div>

            {/* Font Size */}
            <SectionCard icon={<Type className="h-5 w-5" />} title="حجم الخط" desc="تغيير أو تصغير/تكبير الخطوط + (إضافة) أو – (تصغير) هنا يمنحك" color="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-muted-foreground">أحجام مسبقة:</label>
                  <div className="space-y-1.5">
                    {[{ l: 'صغير جداً %60', v: 60 }, { l: 'صغير %75', v: 75 }, { l: 'عادي %100', v: 100 }, { l: 'متوسط %115', v: 115 }, { l: 'كبير %130', v: 130 }, { l: 'كبير جداً %150', v: 150 }].map(opt => (
                      <button key={opt.v} onClick={() => applyFontSize(opt.v)}
                        className={cn('w-full text-right rounded-xl px-4 py-2 text-xs font-bold border transition-all',
                          fontSize === opt.v ? 'bg-primary/10 text-primary border-primary/30' : 'bg-card text-muted-foreground border-border hover:bg-muted/50')}>
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center gap-4">
                  <div className="rounded-2xl border border-border bg-muted/30 p-5 text-center w-full">
                    <p className="text-[10px] text-muted-foreground mb-1">الحجم الحالي</p>
                    <p className="text-3xl font-black text-primary tabular-nums">{fontSize}%</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{fontSize < 85 ? 'صغير' : fontSize <= 100 ? 'عادي' : fontSize <= 120 ? 'متوسط' : 'كبير'}</p>
                  </div>
                  <div className="flex items-center gap-3 w-full">
                    <button onClick={() => applyFontSize(fontSize - 5)} className="rounded-xl border border-border p-2 hover:bg-muted transition-colors">
                      <MinusIcon className="h-4 w-4" />
                    </button>
                    <input type="range" min={60} max={150} step={5} value={fontSize}
                      onChange={e => applyFontSize(+e.target.value)}
                      className="flex-1 h-2 rounded-full appearance-none bg-muted cursor-pointer accent-primary" />
                    <button onClick={() => applyFontSize(fontSize + 5)} className="rounded-xl border border-border p-2 hover:bg-muted transition-colors">
                      <PlusIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <button onClick={() => applyFontSize(100)} className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
                    إعادة تعيين للحجم الافتراضي
                  </button>
                  <div className="rounded-xl border border-border bg-card p-3 text-sm text-foreground w-full">
                    <p>هذا نص تجريبي لمعاينة حجم الخط يمكنك رؤية التغييرات مباشرةً هنا.</p>
                    <p className="text-muted-foreground text-xs mt-1">This is a sample text to preview the font size</p>
                  </div>
                </div>
              </div>
            </SectionCard>

            <button onClick={handleSave} className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-md">
              <Save className="h-4 w-4" /> حفظ التخصيصات
            </button>
          </>
        )}

        {/* ── Tab: Notifications ── */}
        {activeTab === 'notifications' && (
          <SectionCard icon={<Bell className="h-5 w-5" />} title="إعدادات الإشعارات" desc="التحكم في التنبيهات" color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <div className="space-y-3">
              <Toggle value={notifSettings.enabled}
                onChange={v => saveNotifs({ ...notifSettings, enabled: v })}
                label="تفعيل الإشعارات" desc="إيقاف وإعادة تشغيل الإخطارات" />
              <Toggle value={notifSettings.sounds}
                onChange={v => saveNotifs({ ...notifSettings, sounds: v })}
                label="الأصوات" desc="تشغيل أصوت للتنبيهات" />
              <Toggle value={notifSettings.reminders}
                onChange={v => saveNotifs({ ...notifSettings, reminders: v })}
                label="تنبيهات التذكيرات" desc="إشعارات الفواتير والتذكيرات" />
              <Toggle value={notifSettings.salesAlerts}
                onChange={v => saveNotifs({ ...notifSettings, salesAlerts: v })}
                label="تنبيهات المبيعات" desc="إخبارك عند إتمام عمليات بيع" />
              <Toggle value={notifSettings.inventoryAlerts}
                onChange={v => saveNotifs({ ...notifSettings, inventoryAlerts: v })}
                label="تنبيهات المخزون" desc="ينبهك لتقريب نفاد المخزون" />
            </div>
          </SectionCard>
        )}

        {/* ── Tab: Backup ── */}
        {activeTab === 'backup' && (
          <>
            <SectionCard icon={<Database className="h-5 w-5" />} title="النسخ الاحتياطي" desc="حماية بياناتك — النسخة تشمل كل معلومات قاعدة البيانات" color="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400">
              <div className="space-y-4">
                {/* Manual */}
                <div className="flex gap-2">
                  <button onClick={downloadManualBackup} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-3 text-sm font-bold hover:bg-emerald-700 transition-all shadow-md">
                    <FileDown className="h-4 w-4" /> إنشاء نسخة احتياطية الآن
                  </button>
                  <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold hover:bg-muted transition-all">
                    <FileUp className="h-4 w-4 text-blue-500" /> استعادة نسخة احتياطية
                    <input type="file" accept=".json" className="hidden" onChange={handleRestoreFile} />
                  </label>
                </div>

                {/* Auto Backup Toggle */}
                <Toggle value={backupSettings.autoBackupEnabled}
                  onChange={v => setBackupSettings(s => ({ ...s, autoBackupEnabled: v }))}
                  label="النسخ الاحتياطي التلقائي" desc="حفظ تلقائي دوري بدون تدخل" />

                {backupSettings.autoBackupEnabled && (
                  <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4 animate-fade-in">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">معدل الحفظ</label>
                      <select value={[1, 6, 12, 24].includes(backupSettings.intervalHours) ? backupSettings.intervalHours : 'custom'}
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
                      <button onClick={handleChooseBackupDir} className="w-full flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                        <FolderOpen className="h-4 w-4 text-emerald-500" />
                        {hasBackupDir ? 'تغيير المجلد' : 'تحديد مجلد'}
                      </button>
                      {hasBackupDir && <p className="mt-1.5 text-[10px] text-emerald-600 font-medium">✔️ المجلد محدد</p>}
                    </div>
                    <button onClick={handleSaveBackupSettings} className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all">
                      <HardDriveDownload className="h-4 w-4" /> حفظ الإعداد
                    </button>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Monthly Reset */}
            <SectionCard icon={<CalendarClock className="h-5 w-5" />} title="التصفير الشهري" desc="أرشفة إحصائيات الشهر وبدء فترة جديدة" color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <div className="space-y-4">
                <Toggle value={resetSettings.resetDay > 0}
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
                  <button onClick={handleSaveResetSettings} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all">
                    <CalendarClock className="h-4 w-4" /> حفظ
                  </button>
                  <button onClick={handleManualArchive} className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:bg-muted transition-all">
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
        )}

        {/* ── Tab: Wallets ── */}
        {activeTab === 'wallets' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* E-Wallets */}
              <SectionCard icon={<Wallet className="h-5 w-5" />} title="المحفظة الإلكترونية" desc="فودافون كاش، اتصالات كاش، أورنج كاش، دي باي، وغيرها" color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                <div className="space-y-3">
                  <button onClick={addWallet} className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-3 text-sm font-bold hover:bg-emerald-700 transition-all shadow-md">
                    <Plus className="h-4 w-4" /> إضافة محفظة إلكترونية
                  </button>
                  {eWallets.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">لا توجد محفظات إلكترونية مضافة. استخدم الزر أعلاه لإضافة محفظة جديدة.</p>
                  ) : eWallets.map(w => (
                    <div key={w.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                      <div className="flex items-center gap-2">
                        {w.isDefault && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">افتراضي</span>}
                        <span className="text-sm font-bold text-foreground">{w.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <button className="rounded-lg px-3 py-1 text-xs font-bold text-primary border border-primary/30 hover:bg-primary/5 transition-colors">تعديل</button>
                        <button onClick={() => removeWallet(w.id)} className="rounded-lg px-3 py-1 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 transition-colors">حذف</button>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input value={newWalletName} onChange={e => setNewWalletName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addWallet()} placeholder="اسم المحفظة الجديدة..." className={`flex-1 ${IC}`} />
                    <button onClick={addWallet} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90">إضافة</button>
                  </div>
                </div>
              </SectionCard>

              {/* Bank Accounts */}
              <SectionCard icon={<CreditCard className="h-5 w-5" />} title="الحسابات البنكية" desc="إدارة الحسابات البنكية المرتبطة" color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <div className="space-y-3">
                  <button onClick={addBank} className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-3 text-sm font-bold hover:bg-emerald-700 transition-all shadow-md">
                    <Plus className="h-4 w-4" /> إضافة حساب بنكي جديد
                  </button>
                  {bankAccounts.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">لا توجد حسابات بنكية مضافة. استخدم الزر أعلاه لإضافة حساب جديد.</p>
                  ) : bankAccounts.map(b => (
                    <div key={b.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                      <div className="flex items-center gap-2">
                        {b.isDefault && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">افتراضي</span>}
                        <span className="text-sm font-bold text-foreground">{b.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <button className="rounded-lg px-3 py-1 text-xs font-bold text-primary border border-primary/30 hover:bg-primary/5 transition-colors">تعديل</button>
                        <button onClick={() => removeBank(b.id)} className="rounded-lg px-3 py-1 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 transition-colors">حذف</button>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input value={newBankName} onChange={e => setNewBankName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBank()} placeholder="اسم الحساب البنكي..." className={`flex-1 ${IC}`} />
                    <button onClick={addBank} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90">إضافة</button>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Transfer Settings */}
            <SectionCard icon={<Banknote className="h-5 w-5" />} title="إعدادات التحويلات" desc="عمولات تحويل (فودافون كاش، اتصالات كاش، أورنج كاش، إلخ)" color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
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
                      <Toggle value={t.enabled} onChange={v => setTransfers(ts => ts.map(x => x.id === t.id ? { ...x, enabled: v } : x))} label="" />
                      <span className="flex-1 text-sm font-bold text-foreground">{t.name}</span>
                      <input type="number" min={0} value={t.commission}
                        onChange={e => setTransfers(ts => ts.map(x => x.id === t.id ? { ...x, commission: +e.target.value } : x))}
                        className="w-20 text-center rounded-xl border border-input bg-background px-2 py-1.5 text-sm font-bold tabular-nums" />
                      <button onClick={() => setTransfers(ts => ts.filter(x => x.id !== t.id))} className="rounded-lg p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add custom */}
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs font-bold text-muted-foreground shrink-0">أخرى</span>
                  <input value={newTransferName} onChange={e => setNewTransferName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTransfer()}
                    placeholder="اسم..." className={`flex-1 ${IC} text-xs`} />
                  <input type="number" min={0} value={10} className="w-20 text-center rounded-xl border border-input bg-background px-2 py-1.5 text-xs font-bold tabular-nums" readOnly />
                  <button onClick={addTransfer} className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90">+</button>
                </div>

                <button onClick={saveTransfers} className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-3 text-sm font-bold hover:bg-emerald-700 transition-all shadow-md">
                  <Save className="h-4 w-4" /> حفظ إعدادات التحويلات
                </button>
              </div>
            </SectionCard>
          </>
        )}

        {/* ── Tab: Invoices ── */}
        {activeTab === 'invoices' && (
          <>
            {/* Invoice Numbering */}
            <SectionCard icon={<Hash className="h-5 w-5" />} title="إعدادات أرقام الفواتير" desc="تخصيص Prefix وPadding لكل نوع فاتورة" color="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400">
              <div className="space-y-4">
                {([
                  { key: 'sales' as const, label: 'مبيعات الإكسسوارات', typeLabel: 'sales_accessory' },
                  { key: 'expense' as const, label: 'مصروفات', typeLabel: 'expense' },
                  { key: 'repair' as const, label: 'إصلاحات', typeLabel: 'maintenance' },
                  { key: 'return_' as const, label: 'مرتجعات', typeLabel: 'return' },
                  { key: 'purchase' as const, label: 'مشتريات', typeLabel: 'purchase' },
                ]).map(inv => (
                  <div key={inv.key} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-foreground">{inv.label}</p>
                        <p className="text-[10px] text-muted-foreground">النوع: {inv.typeLabel} • آخر رقم: 0</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">Prefix (البادئة)</label>
                        <input value={invoiceSettings[inv.key].prefix}
                          onChange={e => setInvoiceSettings(s => ({ ...s, [inv.key]: { ...s[inv.key], prefix: e.target.value } }))}
                          className={`${IC} text-center font-mono`} dir="ltr" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">Padding (عدد الأرقام)</label>
                        <input type="number" min={1} max={10} value={invoiceSettings[inv.key].padding}
                          onChange={e => setInvoiceSettings(s => ({ ...s, [inv.key]: { ...s[inv.key], padding: +e.target.value } }))}
                          className={`${IC} text-center font-mono`} dir="ltr" />
                      </div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-left">
                      <p className="text-[10px] text-muted-foreground">رقم فاتورة أخير</p>
                      <p className="text-sm font-black text-emerald-700 dark:text-emerald-400 font-mono">{invoiceSettings[inv.key].prefix}{'0'.repeat(Math.max(0, invoiceSettings[inv.key].padding - 1))}1</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-border py-2 text-xs font-bold text-muted-foreground hover:bg-muted transition-colors">
                        <RotateCcw className="h-3 w-3" /> إعادة تعيين
                      </button>
                      <button onClick={saveInvoiceSettings} className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-emerald-600 text-white py-2 text-xs font-bold hover:bg-emerald-700 transition-all">
                        <Save className="h-3 w-3" /> حفظ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Invoice Template */}
            <SectionCard icon={<Receipt className="h-5 w-5" />} title="إعدادات قالب الفاتورة" desc="تخصيص شكل الفاتورة المطبوعة" color="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">رسالة نهاية الفاتورة</label>
                  <input value={invoiceSettings.footerMessage}
                    onChange={e => setInvoiceSettings(s => ({ ...s, footerMessage: e.target.value }))}
                    placeholder="شكراً لتعاملكم معنا" className={IC} />
                  <p className="text-[9px] text-muted-foreground mt-1">نص يظهر أسفل كل فاتورة مطبوعة</p>
                </div>

                <Toggle value={invoiceSettings.showDate}
                  onChange={v => setInvoiceSettings(s => ({ ...s, showDate: v }))}
                  label="إظهار تاريخ الفاتورة" desc="عرض التاريخ/الميلادي أسفل الشعار" />
                <Toggle value={invoiceSettings.showInvoiceNo}
                  onChange={v => setInvoiceSettings(s => ({ ...s, showInvoiceNo: v }))}
                  label="إظهار رقم الفاتورة" desc="إظهار رقم الفاتورة على الفاتورة" />
                <Toggle value={invoiceSettings.showClientDetails}
                  onChange={v => setInvoiceSettings(s => ({ ...s, showClientDetails: v }))}
                  label="إظهار تفاصيل العميل" desc="عرض بيانات (رقم هاتف العميل)" />
                <Toggle value={invoiceSettings.showPaymentMethod}
                  onChange={v => setInvoiceSettings(s => ({ ...s, showPaymentMethod: v }))}
                  label="إظهار طريقة الدفع" desc="عرض طريقة الدفع على الفاتورة" />

                {/* Preview */}
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                  <p className="text-xs font-bold text-muted-foreground">معاينة أرقام الفواتير</p>
                  {(['sales', 'expense', 'repair', 'return_', 'purchase'] as const).map(k => {
                    const labels: Record<string, string> = { sales: 'مبيعات الإكسسوارات', expense: 'مصروفات', repair: 'إصلاحات', return_: 'مرتجعات', purchase: 'مشتريات' };
                    return (
                      <div key={k} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2">
                        <span className="text-xs text-muted-foreground">{labels[k]}</span>
                        <span className="text-xs font-black font-mono text-foreground">{invoiceSettings[k].prefix}{'0'.repeat(Math.max(0, invoiceSettings[k].padding - 1))}1</span>
                      </div>
                    );
                  })}
                </div>

                <button onClick={saveInvoiceSettings} className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-3 text-sm font-bold hover:bg-emerald-700 transition-all shadow-md">
                  <Save className="h-4 w-4" /> حفظ إعدادات قالب الفاتورة
                </button>
              </div>
            </SectionCard>
          </>
        )}

        {/* ── Tab: About ── */}
        {activeTab === 'about' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Support Info */}
              <SectionCard icon={<Phone className="h-5 w-5" />} title="الدعم الفني" desc="تواصل معنا للمساعدة" color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <div className="space-y-3">
                  {/* WhatsApp */}
                  <a href="https://wa.me/201202843931" target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border-2 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-700 px-4 py-3 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all group cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md">
                        <MessageCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">واتساب الدعم الفني</p>
                        <p className="text-sm font-black text-foreground font-mono" dir="ltr">+20 1202843931</p>
                        <p className="text-[10px] text-muted-foreground">اضغط للتواصل في واتساب</p>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-emerald-500 group-hover:translate-x-[-2px] transition-transform" />
                  </a>

                  {/* Working Hours */}
                  <div className="rounded-xl border border-border bg-card px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs font-bold text-foreground">ساعات العمل</p>
                    </div>
                    <p className="text-sm text-muted-foreground">متاح طول الوقت 24/7</p>
                  </div>
                </div>
              </SectionCard>

              {/* App Info */}
              <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center justify-center text-center space-y-3">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-xl text-3xl font-black">
                  E
                </div>
                <h2 className="text-xl font-black text-foreground">الأحمد سيستم</h2>
                <p className="text-sm font-bold text-primary">Mobile Suite</p>
                <p className="text-xs text-muted-foreground">حلول إدارة الموبايلات والإكسسوارات</p>
                <p className="text-2xl font-black text-foreground">V 2.0</p>
                <div className="grid grid-cols-2 gap-3 w-full pt-2">
                  <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">تاريخ الإصدار</p>
                    <p className="text-xs font-bold text-foreground">مارس 2026</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">نوع الترخيص</p>
                    <p className="text-xs font-bold text-primary">تجاري</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Developer */}
            <div className="rounded-2xl border border-border bg-card p-5 text-center space-y-2">
              <p className="text-xs text-muted-foreground">تم التطوير بواسطة</p>
              <p className="text-sm font-black text-foreground">Eng Ahmed Eid</p>
              <p className="text-xs text-muted-foreground">© 2026 جميع الحقوق محفوظة</p>
            </div>
          </>
        )}

        {/* ── Tab: Danger Zone ── */}
        {activeTab === 'danger' && (
          <div className="rounded-2xl border border-red-200 bg-red-50/50 dark:bg-red-950/10 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 border border-red-200">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-700">مسح جميع البيانات</h3>
                <p className="text-[11px] text-red-500/80 mt-0.5">حذف كل المبيعات، المخزون، الصيانة، الأقساط، المصاريف، والأرشيف. لا يمكن التراجع.</p>
              </div>
            </div>

            {!confirmClear ? (
              <button onClick={() => setConfirmClear(true)}
                className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-100 transition-all">
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
                <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="امسح كل شيء"
                  className="w-full rounded-xl border border-red-300 bg-white px-3 py-2.5 text-sm text-red-700 placeholder:text-red-300/60 focus:outline-none focus:ring-2 focus:ring-red-400/40 font-bold" />
                <div className="flex gap-2">
                  <button onClick={handleClearAll} disabled={confirmText.trim() !== 'امسح كل شيء'}
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
        )}

      </div>
    </div>
  );
};

export default SettingsPage;
