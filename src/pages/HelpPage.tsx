// ============================================================
// Help & Guide Page — Interactive user manual
// ============================================================

import { useState } from 'react';
import {
    BookOpen, ShoppingCart, Package, Wrench, Wallet,
    Keyboard, HelpCircle, Zap, ChevronDown, ChevronUp,
    CheckCircle, AlertTriangle, Lightbulb,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

interface StepItem { num: number; title: string; desc: string; warning?: string; tip?: string; }
interface FaqItem { q: string; a: string; }

// ─── Reusable components ─────────────────────────────────────

function StepCard({ num, title, desc, warning, tip }: StepItem) {
    return (
        <div className="flex gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-black shrink-0 mt-0.5">{num}</div>
            <div className="flex-1">
                <p className="font-bold text-foreground">{title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
                {warning && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3 py-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-300">{warning}</p>
                    </div>
                )}
                {tip && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-3 py-2">
                        <Lightbulb className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-700 dark:text-blue-300">{tip}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function FaqItem({ q, a }: FaqItem) {
    const [open, setOpen] = useState(false);
    return (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <button onClick={() => setOpen(o => !o)}
                className="flex items-center justify-between w-full px-5 py-4 text-sm font-bold text-foreground hover:bg-muted/40 transition-colors text-right">
                <span>{q}</span>
                {open ? <ChevronUp className="h-4 w-4 shrink-0 text-primary" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </button>
            {open && (
                <div className="px-5 pb-4 text-sm text-muted-foreground animate-slide-down border-t border-border/40">
                    <p className="mt-3 leading-relaxed">{a}</p>
                </div>
            )}
        </div>
    );
}

// ─── Tab Data ─────────────────────────────────────────────────

const TABS = [
    { id: 'start', label: 'البداية السريعة', icon: Zap },
    { id: 'pos', label: 'نقطة البيع', icon: ShoppingCart },
    { id: 'inventory', label: 'المخزون', icon: Package },
    { id: 'maintenance', label: 'الصيانة', icon: Wrench },
    { id: 'wallets', label: 'المحافظ', icon: Wallet },
    { id: 'shortcuts', label: 'الاختصارات', icon: Keyboard },
    { id: 'faq', label: 'الأسئلة الشائعة', icon: HelpCircle },
];

// ─── Tab Content ─────────────────────────────────────────────

function TabContent({ tab }: { tab: string }) {
    if (tab === 'start') return (
        <div className="space-y-5">
            <div className="rounded-2xl bg-gradient-to-l from-primary/5 to-transparent border border-primary/20 p-5">
                <p className="font-black text-foreground text-lg mb-4 flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /> 🚀 البداية السريعة</p>
                <div className="space-y-4">
                    {[
                        { num: 1, title: 'إعداد الشركة', desc: 'أدخل اسم شركتك والشعار من الإعدادات. هذه البيانات تظهر في الفواتير.' },
                        { num: 2, title: 'إضافة المنتجات', desc: 'أضف أجهزتك للمخزون مع الباركود والسعر. يمكنك الإضافة يدوياً أو بالاستيراد.' },
                        { num: 3, title: 'تسجيل أول بيع', desc: 'اذهب لنقطة البيع، امسح الباركود، اختر العميل، وأتم البيع.' },
                        { num: 4, title: 'متابعة التقارير', desc: 'راجع تقارير المبيعات والأرباح يومياً من لوحة التحكم.' },
                    ].map(s => <StepCard key={s.num} {...s} />)}
                </div>
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3">
                    <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-primary">نصيحة: استخدم الاختصار Ctrl + K للبحث السريع في أي مكان بالبرنامج</p>
                </div>
            </div>
        </div>
    );

    if (tab === 'pos') return (
        <div className="space-y-5">
            <p className="font-black text-lg text-foreground flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-primary" /> 🛒 نقطة البيع (POS)</p>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <p className="text-sm font-bold text-muted-foreground">كيفية إتمام عملية بيع:</p>
                {[
                    { num: 1, title: 'البحث عن المنتج', desc: 'امسح الباركود بالقارئ أو اكتب اسم المنتج في خانة البحث.' },
                    { num: 2, title: 'إضافة للسلة', desc: 'اضغط على المنتج لإضافته للسلة. يمكنك تعديل الكمية أو السعر.' },
                    { num: 3, title: 'اختيار العميل', desc: 'اختر العميل إذا كان البيع آجل أو تريد تسجيله باسمه.', tip: 'اختياري — يمكن البيع بدون اختيار عميل' },
                    { num: 4, title: 'إتمام البيع', desc: 'اضغط زر إتمام البيع، اختر طريقة الدفع، وستُطبع الفاتورة.' },
                ].map(s => <StepCard key={s.num} {...s} />)}
            </div>
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl px-4 py-3">
                <Keyboard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <p className="text-sm text-blue-700 dark:text-blue-300">للوصول السريع: اضغط <kbd className="px-2 py-0.5 bg-blue-100 dark:bg-blue-500/20 rounded font-mono text-xs">Ctrl + 2</kbd> من أي صفحة</p>
            </div>
        </div>
    );

    if (tab === 'inventory') return (
        <div className="space-y-5">
            <p className="font-black text-lg text-foreground flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> 📱 إدارة المخزون</p>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <p className="text-sm font-bold text-muted-foreground">إضافة جهاز جديد:</p>
                {[
                    { num: 1, title: 'اضغط زر "إضافة جهاز"', desc: 'الزر الأخضر في أعلى الصفحة.' },
                    { num: 2, title: 'أدخل بيانات الجهاز', desc: 'الاسم، الموديل، IMEI، سعر الشراء، سعر البيع.' },
                    { num: 3, title: 'امسح أو أدخل الباركود', desc: 'استخدم قارئ الباركود أو أدخله يدوياً.' },
                    { num: 4, title: 'احفظ الجهاز', desc: 'اضغط "حفظ" وسيُضاف الجهاز للمخزون.', warning: 'تأكد من إدخال IMEI صحيح للأجهزة - يُستخدم للتتبع والضمان.' },
                ].map(s => <StepCard key={s.num} {...s} />)}
            </div>
        </div>
    );

    if (tab === 'maintenance') return (
        <div className="space-y-5">
            <p className="font-black text-lg text-foreground flex items-center gap-2"><Wrench className="h-5 w-5 text-primary" /> 🔧 إدارة الصيانة</p>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <p className="text-sm font-bold text-muted-foreground">استلام جهاز للصيانة:</p>
                {[
                    { num: 1, title: 'فتح تذكرة جديدة', desc: 'اضغط "تذكرة جديدة" من صفحة الصيانة.' },
                    { num: 2, title: 'إدخال بيانات العميل والجهاز', desc: 'أدخل اسم العميل، رقم الهاتف، نوع الجهاز، الماركة، الموديل، IMEI.' },
                    { num: 3, title: 'وصف المشكلة والملحقات', desc: 'اكتب وصف المشكلة بالتفصيل وسجَّل الملحقات المستلمة.' },
                    { num: 4, title: 'استلام العربون', desc: 'يمكنك استلام عربون من العميل واختيار المحفظة للإيداع.', tip: 'اختياري' },
                    { num: 5, title: 'طباعة إيصال الاستلام', desc: 'سيُطبع إيصال للعميل يحتوي على رقم التذكرة والباركود.' },
                ].map(s => <StepCard key={s.num} {...s} />)}
            </div>
        </div>
    );

    if (tab === 'wallets') return (
        <div className="space-y-5">
            <p className="font-black text-lg text-foreground flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> 💰 المحافظ المتعددة</p>
            <div className="grid gap-3 sm:grid-cols-2">
                {[
                    { icon: '💵', title: 'إيداع', desc: 'إضافة مبلغ للمحفظة مع تسجيل السبب (مبيعات، تحصيل، إلخ)' },
                    { icon: '💸', title: 'سحب', desc: 'سحب مبلغ من المحفظة مع تسجيل السبب (مصروفات، مشتريات، إلخ)' },
                    { icon: '🔄', title: 'تحويل', desc: 'تحويل مبلغ من محفظة لأخرى (مثال: من الصندوق للبنك)' },
                    { icon: '📊', title: 'كشف حساب', desc: 'عرض جميع العمليات على المحفظة وتاريخها الكامل' },
                ].map(op => (
                    <div key={op.title} className="rounded-2xl border border-border bg-card p-4">
                        <p className="text-2xl mb-2">{op.icon}</p>
                        <p className="font-bold text-foreground">{op.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{op.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );

    if (tab === 'shortcuts') return (
        <div className="space-y-4">
            <p className="font-black text-lg text-foreground flex items-center gap-2"><Keyboard className="h-5 w-5 text-primary" /> ⌨️ اختصارات لوحة المفاتيح</p>
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
                {[
                    ['Ctrl + K', 'البحث الشامل'],
                    ['Ctrl + 1', 'الصفحة الرئيسية'],
                    ['Ctrl + 2', 'نقطة البيع'],
                    ['Ctrl + 3', 'المخزون'],
                    ['Ctrl + 5', 'المبيعات'],
                    ['Alt + H', 'العودة للرئيسية'],
                    ['ESC', 'إغلاق النوافذ المنبثقة'],
                ].map(([key, fn], i) => (
                    <div key={key} className={`flex items-center justify-between px-5 py-3 ${i % 2 === 0 ? 'bg-muted/20' : ''} border-b border-border/30 last:border-0`}>
                        <kbd className="px-3 py-1.5 bg-muted border border-border rounded-lg font-mono text-xs font-bold text-foreground">{key}</kbd>
                        <span className="text-sm text-muted-foreground">{fn}</span>
                    </div>
                ))}
            </div>
        </div>
    );

    if (tab === 'faq') return (
        <div className="space-y-3">
            <p className="font-black text-lg text-foreground flex items-center gap-2"><HelpCircle className="h-5 w-5 text-primary" /> ❓ الأسئلة الشائعة</p>
            {[
                { q: 'كيف أعمل نسخة احتياطية من البيانات؟', a: 'النظام يعمل نسخ احتياطية تلقائية يومياً. للتصدير اليدوي، اذهب للإعدادات > النسخ الاحتياطي.' },
                { q: 'كيف أطبع فاتورة سابقة؟', a: 'اذهب لصفحة المبيعات، ابحث عن الفاتورة المطلوبة، واضغط على زر الطباعة.' },
                { q: 'كيف أعدل سعر منتج؟', a: 'اذهب للمخزون، ابحث عن المنتج، اضغط عليه لفتح التفاصيل، ثم اضغط "تعديل". غيَّر السعر واحفظ.' },
                { q: 'كيف أضيف مستخدم (كاشير) جديد؟', a: 'من الإعدادات > المستخدمون > إضافة مستخدم. حدد الصلاحيات المناسبة.' },
                { q: 'كيف أرجع منتج (مرتجع)؟', a: 'من صفحة المبيعات، ابحث عن الفاتورة، واضغط "إرجاع". اختر المنتج وسيعود للمخزون تلقائياً.' },
                { q: 'كيف أستخدم قارئ الباركود؟', a: 'وصّل قارئ الباركود (USB/Bluetooth). في صفحة نقطة البيع، اضغط على حقل البحث ثم امسح الباركود مباشرة.' },
            ].map(f => <FaqItem key={f.q} {...f} />)}
        </div>
    );

    return null;
}

// ─── Main Page ───────────────────────────────────────────────

export default function HelpPage() {
    const [activeTab, setActiveTab] = useState('start');

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
                    <BookOpen className="h-6 w-6 text-primary" /> المساعدة والدليل
                </h1>
                <p className="text-sm text-muted-foreground mt-1">دليل شامل لاستخدام جميع مميزات النظام</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 flex-wrap">
                {TABS.map(t => {
                    const Icon = t.icon;
                    return (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all ${activeTab === t.id
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}>
                            <Icon className="h-3.5 w-3.5" />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab content */}
            <div className="animate-fade-in">
                <TabContent tab={activeTab} />
            </div>
        </div>
    );
}
