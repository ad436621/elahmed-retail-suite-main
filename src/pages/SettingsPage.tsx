// ============================================================
// SettingsPage — lean orchestrator (tabs extracted to sub-components)
// Tab components live in @/components/settings/tabs/
// ============================================================
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';
import {
  Sun, Moon, Globe, Plus, X, Printer, Save, Upload, Image as ImageIcon,
  Settings, Building2, Bell, Database, Shield, Type,
  Minus as MinusIcon, Plus as PlusIcon,
  Wallet, Receipt, Hash, AlertTriangle, Info,
  Phone, Clock, ExternalLink, MessageCircle, RotateCcw
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { getLegacyCategories, saveLegacyCategories } from '@/data/categoriesData';
import { STORAGE_KEYS } from '@/config';
import SectionCard from '@/components/settings/SectionCard';
import ToggleRow from '@/components/settings/ToggleRow';
import { getMonthlyResetSettings, saveMonthlyResetSettings } from '@/data/monthlyResetData';

// ─ Tab sub-components ─
import BackupTab from '@/components/settings/tabs/BackupTab';
import NotificationsTab from '@/components/settings/tabs/NotificationsTab';
import WalletsTab from '@/components/settings/tabs/WalletsTab';
import InvoicesTab from '@/components/settings/tabs/InvoicesTab';
import DangerTab from '@/components/settings/tabs/DangerTab';

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

// ─────────────────────────────────────────────────────────────

const SettingsPage = () => {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabId>('general');

  // ─ General / Company form ─
  const [formData, setFormData] = useState({
    companyName: settings.companyName,
    companySuffix: settings.companySuffix,
    branchName: settings.branchName,
    branchAddress: settings.branchAddress,
    shopPhone: settings.shopPhone,
    printerName: settings.printerName,
    logoUrl: settings.logoUrl,
  });

  const handleSave = () => {
    updateSettings(formData);
    toast({ title: '✅ تم الحفظ', description: 'تم تطبيق إعدادات المحل.' });
  };

  // ─ Categories ─
  const [cats, setCats] = useState<string[]>(() => getLegacyCategories());
  const [newCat, setNewCat] = useState('');

  const addCategory = () => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    if (cats.includes(trimmed)) { toast({ title: 'خطأ', description: 'الفئة موجودة بالفعل', variant: 'destructive' }); return; }
    const updated = [...cats, trimmed];
    setCats(updated); saveLegacyCategories(updated); setNewCat('');
    toast({ title: 'تم إضافة الفئة', description: trimmed });
  };
  const removeCategory = (cat: string) => {
    const updated = cats.filter(c => c !== cat);
    setCats(updated); saveLegacyCategories(updated);
    toast({ title: 'تم حذف الفئة', description: cat });
  };

  // ─ Logo Upload ─
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast({ title: 'خطأ', description: 'يرجى اختيار ملف صورة صالح', variant: 'destructive' }); return; }
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 400;
        let w = img.width, h = img.height;
        if (w > MAX_DIM || h > MAX_DIM) {
          if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
          else { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/png', 0.9);
        setFormData(f => ({ ...f, logoUrl: dataUrl }));
        toast({ title: 'تم رفع الشعار', description: 'اضغط حفظ لتطبيق التغييرات' });
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ─ Font Size ─
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem(STORAGE_KEYS.FONT_SIZE) || '75'));

  // Apply stored font size to DOM when settings page opens
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}%`;
  }, []);

  const applyFontSize = (size: number) => {
    const clamped = Math.max(60, Math.min(150, size));
    setFontSize(clamped);
    document.documentElement.style.fontSize = `${clamped}%`;
    localStorage.setItem(STORAGE_KEYS.FONT_SIZE, String(clamped));
  };

  // ─ System tab also needs resetSettings for inventory ─
  const [resetSettings, setResetSettings] = useState(() => getMonthlyResetSettings());

  return (
    <div className="animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/20">
          <Settings className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground">الإعدادات</h1>
          <p className="text-xs text-muted-foreground mt-0.5">إدارة وتخصيص النظام</p>
        </div>
      </div>

      {/* Tab Navigation */}
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

      {/* Tab Content */}
      <div className="max-w-3xl mx-auto space-y-5">

        {/* ── General Tab ── */}
        {activeTab === 'general' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <SectionCard icon={<Building2 className="h-5 w-5" />} title="معلومات الشركة" desc="البيانات الأساسية للمحل" color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <div className="space-y-3">
                  <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">اسم الشركة</label><input data-validation="text-only" value={formData.companyName} onChange={e => setFormData(f => ({ ...f, companyName: e.target.value }))} className={IC} /></div>
                  <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">اللاحقة القانونية</label><input data-validation="text-only" value={formData.companySuffix} onChange={e => setFormData(f => ({ ...f, companySuffix: e.target.value }))} placeholder="ش. ذ. م.م" className={IC} /></div>
                  <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">اسم الفرع</label><input data-validation="text-only" value={formData.branchName} onChange={e => setFormData(f => ({ ...f, branchName: e.target.value }))} className={IC} /></div>
                  <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">عنوان الفرع</label><textarea value={formData.branchAddress} onChange={e => setFormData(f => ({ ...f, branchAddress: e.target.value }))} rows={2} className={`${IC} resize-none`} /></div>
                </div>
              </SectionCard>

              <SectionCard icon={<Globe className="h-5 w-5" />} title="الإعدادات الإقليمية" desc="اللغة والتاريخ" color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">شعار الشركة (Logo)</label>
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 rounded-xl overflow-hidden border-2 border-border bg-muted flex items-center justify-center shrink-0">
                        {formData.logoUrl ? <img src={formData.logoUrl} alt="Logo" className="h-full w-full object-contain" /> : <ImageIcon className="h-6 w-6 text-muted-foreground/40" />}
                      </div>
                      <div className="flex-1">
                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                        <button onClick={() => logoInputRef.current?.click()} className="flex items-center gap-1.5 rounded-lg border border-dashed border-primary/50 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 transition-colors">
                          <Upload className="h-3.5 w-3.5" /> اختيار ملف
                        </button>
                        <p className="text-[9px] text-muted-foreground mt-1">PNG / JPG (الحد الأقصى 2MB)</p>
                      </div>
                    </div>
                  </div>
                  <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">العملة</label><div className="w-full rounded-xl border border-input bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground cursor-not-allowed">EGP (جنيه مصري)</div></div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">المظهر</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setTheme('light')} className={cn('flex items-center gap-2 rounded-xl border-2 p-3 text-xs font-bold transition-all', theme === 'light' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50')}><Sun className="h-4 w-4" /> فاتح</button>
                      <button onClick={() => setTheme('dark')} className={cn('flex items-center gap-2 rounded-xl border-2 p-3 text-xs font-bold transition-all', theme === 'dark' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50')}><Moon className="h-4 w-4" /> داكن</button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">اللغة</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setLanguage('ar')} className={cn('flex items-center gap-2 rounded-xl border-2 p-3 text-xs font-bold transition-all', language === 'ar' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50')}><Globe className="h-4 w-4" /> العربية</button>
                      <button onClick={() => setLanguage('en')} className={cn('flex items-center gap-2 rounded-xl border-2 p-3 text-xs font-bold transition-all', language === 'en' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50')}><Globe className="h-4 w-4" /> English</button>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>
            <button onClick={handleSave} className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-md">
              <Save className="h-4 w-4" /> حفظ
            </button>
          </>
        )}

        {/* ── System Tab ── */}
        {activeTab === 'system' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <SectionCard icon={<Printer className="h-5 w-5" />} title="إعدادات الطابعة الحرارية" desc="تخصيص الفواتير والإيصالات" color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                <div className="space-y-3">
                  <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">عرض الورقة</label>
                    <select value={formData.printerName} onChange={e => setFormData(f => ({ ...f, printerName: e.target.value }))} className={IC}>
                      <option value="80mm Thermal Printer">80mm (قياسي)</option>
                      <option value="58mm Thermal Printer">58mm (صغير)</option>
                    </select>
                  </div>
                  <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">رقم الهاتف (يظهر على الفاتورة)</label><input data-validation="phone" value={formData.shopPhone} onChange={e => setFormData(f => ({ ...f, shopPhone: e.target.value }))} placeholder="01xxxxxxxxx" className={IC} dir="ltr" /></div>
                  <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">العنوان (يظهر على الفاتورة)</label><input value={formData.branchAddress} onChange={e => setFormData(f => ({ ...f, branchAddress: e.target.value }))} className={IC} /></div>
                </div>
              </SectionCard>

              <SectionCard icon={<Shield className="h-5 w-5" />} title="إعدادات المخزون" desc="تنبيهات وحدود المخزون" color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                <div className="space-y-3">
                  <ToggleRow value={resetSettings.resetDay > 0} onChange={v => setResetSettings(s => ({ ...s, resetDay: v ? 1 : 0 }))} label="تنبيه المخزون المنخفض" desc="ينبهك عند انخفاض المخزون عن الحد" />
                  {resetSettings.resetDay > 0 && (
                    <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">حد تنبيه المخزون</label>
                      <div className="flex items-center gap-3"><input type="number" min={1} max={100} value={10} className="w-20 text-center rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums" readOnly /><span className="text-xs text-muted-foreground">وحدة</span></div>
                    </div>
                  )}
                  <ToggleRow value={true} onChange={() => { }} label="منع البيع بدون مخزون" desc="لا يقبل بيع منتج بكمية صفر أو ناقصة" />
                </div>
              </SectionCard>
            </div>

            {/* Font Size */}
            <SectionCard icon={<Type className="h-5 w-5" />} title="حجم الخط" desc="تغيير أو تصغير/تكبير الخطوط" color="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-muted-foreground">أحجام مسبقة:</label>
                  <div className="space-y-1.5">
                    {[{ l: 'صغير جداً %60', v: 60 }, { l: 'صغير %75', v: 75 }, { l: 'عادي %100', v: 100 }, { l: 'متوسط %115', v: 115 }, { l: 'كبير %130', v: 130 }, { l: 'كبير جداً %150', v: 150 }].map(opt => (
                      <button key={opt.v} onClick={() => applyFontSize(opt.v)}
                        className={cn('w-full text-right rounded-xl px-4 py-2 text-xs font-bold border transition-all', fontSize === opt.v ? 'bg-primary/10 text-primary border-primary/30' : 'bg-card text-muted-foreground border-border hover:bg-muted/50')}>
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
                    <button onClick={() => applyFontSize(fontSize - 5)} className="rounded-xl border border-border p-2 hover:bg-muted transition-colors"><MinusIcon className="h-4 w-4" /></button>
                    <input type="range" min={60} max={150} step={5} value={fontSize} onChange={e => applyFontSize(+e.target.value)} className="flex-1 h-2 rounded-full appearance-none bg-muted cursor-pointer accent-primary" />
                    <button onClick={() => applyFontSize(fontSize + 5)} className="rounded-xl border border-border p-2 hover:bg-muted transition-colors"><PlusIcon className="h-4 w-4" /></button>
                  </div>
                  <button onClick={() => applyFontSize(75)} className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">إعادة تعيين للحجم الافتراضي (75%)</button>
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

        {/* ── Delegated Tabs ── */}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'backup' && <BackupTab />}
        {activeTab === 'wallets' && <WalletsTab />}
        {activeTab === 'invoices' && <InvoicesTab />}
        {activeTab === 'danger' && <DangerTab />}

        {/* ── About Tab ── */}
        {activeTab === 'about' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <SectionCard icon={<Phone className="h-5 w-5" />} title="الدعم الفني" desc="تواصل معنا للمساعدة" color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <div className="space-y-3">
                  <a href="https://wa.me/201202843931" target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border-2 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-700 px-4 py-3 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all group cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md"><MessageCircle className="h-5 w-5" /></div>
                      <div>
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">واتساب الدعم الفني</p>
                        <p className="text-sm font-black text-foreground font-mono" dir="ltr">+20 1202843931</p>
                        <p className="text-[10px] text-muted-foreground">اضغط للتواصل في واتساب</p>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-emerald-500 group-hover:translate-x-[-2px] transition-transform" />
                  </a>
                  <div className="rounded-xl border border-border bg-card px-4 py-3">
                    <div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-muted-foreground" /><p className="text-xs font-bold text-foreground">ساعات العمل</p></div>
                    <p className="text-sm text-muted-foreground">متاح طول الوقت 24/7</p>
                  </div>
                </div>
              </SectionCard>

              <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center justify-center text-center space-y-3">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-xl text-3xl font-black">E</div>
                <h2 className="text-xl font-black text-foreground">الأحمد سيستم</h2>
                <p className="text-sm font-bold text-primary">Mobile Suite</p>
                <p className="text-xs text-muted-foreground">حلول إدارة الموبايلات والإكسسوارات</p>
                <p className="text-2xl font-black text-foreground">V 2.0</p>
                <div className="grid grid-cols-2 gap-3 w-full pt-2">
                  <div className="rounded-xl border border-border bg-muted/30 px-3 py-2"><p className="text-[10px] text-muted-foreground">تاريخ الإصدار</p><p className="text-xs font-bold text-foreground">مارس 2026</p></div>
                  <div className="rounded-xl border border-border bg-muted/30 px-3 py-2"><p className="text-[10px] text-muted-foreground">نوع الترخيص</p><p className="text-xs font-bold text-primary">تجاري</p></div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 text-center space-y-2">
              <p className="text-xs text-muted-foreground">تم التطوير بواسطة</p>
              <p className="text-sm font-black text-foreground">Eng Ahmed Eid</p>
              <p className="text-xs text-muted-foreground">© 2026 جميع الحقوق محفوظة</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
