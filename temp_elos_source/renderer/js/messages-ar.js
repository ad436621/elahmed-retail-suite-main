/**
 * ELOS Arabic Messages - الرسائل العربية
 * ملف مركزي لجميع الرسائل والنصوص العربية
 * Version: 1.0
 */

window.ELOS_MESSAGES = {
  // رسائل تسجيل الدخول
  login: {
    title: 'تسجيل الدخول',
    selectUser: 'اختر المستخدم',
    otherAccount: 'حساب آخر',
    changeUser: 'تغيير المستخدم',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    enterUsername: 'أدخل اسم المستخدم',
    enterPassword: 'أدخل كلمة المرور',
    rememberMe: 'تذكرني',
    forgotPassword: 'نسيت كلمة المرور؟',
    login: 'دخول',
    loggingIn: 'جاري التحقق...',
    loginSuccess: 'تم التسجيل بنجاح! جاري التحويل...',
    loginSuccessBtn: 'تم! جاري التحويل...'
  },

  // رسائل الأخطاء
  errors: {
    emptyFields: 'الرجاء إدخال اسم المستخدم وكلمة المرور',
    loginFailed: 'فشل تسجيل الدخول',
    connectionError: 'حدث خطأ في الاتصال',
    invalidCredentials: 'اسم المستخدم أو كلمة المرور غير صحيحة',
    accountLocked: 'تم إيقاف الحساب مؤقتاً',
    serverError: 'خطأ في الخادم، يرجى المحاولة لاحقاً',
    networkError: 'تعذر الاتصال بالشبكة',
    sessionExpired: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً'
  },

  // Rate Limiting
  rateLimit: {
    tooManyAttempts: 'محاولات دخول كثيرة',
    waitMessage: 'يرجى الانتظار قبل المحاولة مرة أخرى',
    attemptsRemaining: 'المحاولات المتبقية: {count}'
  },

  // استعادة كلمة المرور
  passwordRecovery: {
    title: 'استعادة كلمة المرور',
    description: 'لاستعادة كلمة المرور أو إعادة تعيينها، يرجى التواصل مع فريق الدعم الفني عبر إحدى القنوات التالية:',
    email: 'البريد الإلكتروني',
    whatsapp: 'واتساب',
    system: 'النظام',
    openWhatsapp: 'فتح واتساب',
    close: 'إغلاق'
  },

  // الفوتر
  footer: {
    version: 'الإصدار',
    help: 'مساعدة',
    darkMode: 'داكن',
    lightMode: 'فاتح'
  },

  // تاريخ آخر دخول
  lastLogin: {
    now: 'الآن',
    minutesAgo: 'منذ {count} دقيقة',
    hoursAgo: 'منذ {count} ساعة',
    daysAgo: 'منذ {count} يوم'
  },

  // Caps Lock
  capsLock: {
    warning: 'CAPS LOCK مفعّل'
  },

  // أزرار النافذة
  window: {
    close: 'إغلاق',
    minimize: 'تصغير'
  }
};

// دالة مساعدة لاستبدال المتغيرات في الرسائل
window.formatMessage = function(message, params = {}) {
  let result = message;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, value);
  }
  return result;
};

console.log('[Messages] تم تحميل الرسائل العربية');
