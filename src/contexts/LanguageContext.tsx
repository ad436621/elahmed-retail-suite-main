import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { STORAGE_KEYS } from '@/config';

type Language = 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    'app.name': 'GLEAMEX RETAIL SUITE',
    'nav.dashboard': 'Dashboard',
    'nav.pos': 'Point of Sale',
    'nav.inventory': 'Inventory',
    'nav.sales': 'Sales History',
    'nav.settings': 'Settings',
    'dashboard.title': 'Dashboard',
    'dashboard.todayRevenue': "Today's Revenue",
    'dashboard.todayProfit': "Today's Profit",
    'dashboard.totalProducts': 'Total Products',
    'dashboard.lowStock': 'Low Stock',
    'dashboard.monthlySales': 'Monthly Sales',
    'dashboard.topProducts': 'Top Products',
    'dashboard.recentSales': 'Recent Sales',
    'pos.title': 'Point of Sale',
    'pos.scanBarcode': 'Scan barcode or search product...',
    'pos.cart': 'Cart',
    'pos.subtotal': 'Subtotal',
    'pos.discount': 'Discount',
    'pos.total': 'Total',
    'pos.profit': 'Profit',
    'pos.cash': 'Cash',
    'pos.card': 'Card',
    'pos.split': 'Split',
    'pos.checkout': 'Checkout',
    'pos.clearCart': 'Clear',
    'pos.qty': 'Qty',
    'pos.price': 'Price',
    'pos.noItems': 'No items in cart',
    'pos.notFound': 'Product not found',
    'inventory.title': 'Inventory',
    'inventory.addProduct': 'Add Product',
    'inventory.search': 'Search products...',
    'inventory.name': 'Product Name',
    'inventory.sku': 'SKU',
    'inventory.category': 'Category',
    'inventory.cost': 'Cost',
    'inventory.selling': 'Selling Price',
    'inventory.stock': 'Stock',
    'inventory.status': 'Status',
    'sales.title': 'Sales History',
    'sales.invoice': 'Invoice #',
    'sales.date': 'Date',
    'sales.items': 'Items',
    'sales.amount': 'Amount',
    'sales.employee': 'Employee',
    'settings.title': 'Settings',
    'settings.storeName': 'Store Name',
    'settings.companyName': 'Company Name',
    'settings.companySuffix': 'Legal Suffix',
    'settings.logo': 'Company Logo',
    'settings.currency': 'Currency',
    'settings.theme': 'Theme',
    'settings.language': 'Language',
    'settings.light': 'Light',
    'settings.dark': 'Dark',
    'settings.save': 'Save Settings',
    'common.actions': 'Actions',
    'common.inStock': 'In Stock',
    'common.lowStock': 'Low Stock',
    'common.outOfStock': 'Out of Stock',
    'common.used': 'Used',
    'common.mobile': 'Mobile',
    'common.tablet': 'Tablet',
    'common.computer': 'Computer',
    'common.laptop': 'Laptop',
  },
  ar: {
    'app.name': 'نظام جليمكس للبيع بالتجزئة',
    'nav.dashboard': 'لوحة التحكم',
    'nav.pos': 'نقطة البيع',
    'nav.inventory': 'المخزون',
    'nav.sales': 'سجل المبيعات',
    'nav.settings': 'الإعدادات',
    'dashboard.title': 'لوحة التحكم',
    'dashboard.todayRevenue': 'إيرادات اليوم',
    'dashboard.todayProfit': 'أرباح اليوم',
    'dashboard.totalProducts': 'إجمالي المنتجات',
    'dashboard.lowStock': 'مخزون منخفض',
    'dashboard.monthlySales': 'المبيعات الشهرية',
    'dashboard.topProducts': 'أفضل المنتجات',
    'dashboard.recentSales': 'المبيعات الأخيرة',
    'pos.title': 'نقطة البيع',
    'pos.scanBarcode': 'مسح الباركود أو البحث عن منتج...',
    'pos.cart': 'السلة',
    'pos.subtotal': 'المجموع الفرعي',
    'pos.discount': 'الخصم',
    'pos.total': 'الإجمالي',
    'pos.profit': 'الربح',
    'pos.cash': 'نقدي',
    'pos.card': 'بطاقة',
    'pos.split': 'تقسيم',
    'pos.checkout': 'إتمام البيع',
    'pos.clearCart': 'مسح',
    'pos.qty': 'الكمية',
    'pos.price': 'السعر',
    'pos.noItems': 'لا توجد منتجات في السلة',
    'pos.notFound': 'المنتج غير موجود',
    'inventory.title': 'المخزون',
    'inventory.addProduct': 'إضافة منتج',
    'inventory.search': 'البحث في المنتجات...',
    'inventory.name': 'اسم المنتج',
    'inventory.sku': 'رمز المنتج',
    'inventory.category': 'الفئة',
    'inventory.cost': 'التكلفة',
    'inventory.selling': 'سعر البيع',
    'inventory.stock': 'المخزون',
    'inventory.status': 'الحالة',
    'sales.title': 'سجل المبيعات',
    'sales.invoice': 'رقم الفاتورة',
    'sales.date': 'التاريخ',
    'sales.items': 'العناصر',
    'sales.amount': 'المبلغ',
    'sales.employee': 'الموظف',
    'settings.title': 'الإعدادات',
    'settings.storeName': 'اسم المتجر',
    'settings.companyName': 'اسم الشركة',
    'settings.companySuffix': 'اللاحقة القانونية',
    'settings.logo': 'شعار الشركة',
    'settings.currency': 'العملة',
    'settings.theme': 'المظهر',
    'settings.language': 'اللغة',
    'settings.light': 'فاتح',
    'settings.dark': 'داكن',
    'settings.save': 'حفظ الإعدادات',
    'common.actions': 'الإجراءات',
    'common.inStock': 'متوفر',
    'common.lowStock': 'مخزون منخفض',
    'common.outOfStock': 'غير متوفر',
    'common.used': 'مستعمل',
    'common.mobile': 'موبايل',
    'common.tablet': 'تابلت',
    'common.computer': 'كمبيوتر',
    'common.laptop': 'لاب توب',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function isSupportedLanguage(value: string | null): value is Language {
  return value === 'en' || value === 'ar';
}

function getInitialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
    if (isSupportedLanguage(stored)) {
      return stored;
    }
  } catch {
    // Ignore storage access issues and fall back to browser preference.
  }

  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en')) {
    return 'en';
  }

  return 'ar';
}

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
  };

  const t = (key: string) => translations[language][key] || key;
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language, dir]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
