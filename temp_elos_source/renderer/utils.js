// utils.js - دوال مشتركة لجميع صفحات المشروع
// ===================================================

// ============================================
// نظام التسجيل (Logger) - يمكن تعطيله في الإنتاج
// ============================================
if (!window.Logger) {
  window.Logger = {
    // تغيير إلى false لتعطيل التسجيل في الإنتاج
    enabled: typeof process !== 'undefined' && process.env ? process.env.NODE_ENV !== 'production' : true,

    log(...args) {
      if (this.enabled) console.log('[LOG]', ...args);
    },

    warn(...args) {
      if (this.enabled) console.warn('[WARN]', ...args);
    },

    error(...args) {
      // الأخطاء تظهر دائماً
      console.error('[ERROR]', ...args);
    },

    debug(...args) {
      if (this.enabled) console.log('[DEBUG]', ...args);
    },

    info(...args) {
      if (this.enabled) console.info('[INFO]', ...args);
    },

    // تعطيل جميع رسائل التسجيل
    disable() {
      this.enabled = false;
    },

    // تفعيل رسائل التسجيل
    enable() {
      this.enabled = true;
    }
  };
}

/**
 * عرض رسائل Toast
 * @param {string} message - النص المراد عرضه
 * @param {string} type - نوع الرسالة: 'success', 'error', 'warning', 'info'
 * @param {number} duration - مدة العرض بالميللي ثانية (افتراضي 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
  const existingToast = document.querySelector('.toast-container');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = `toast-container toast-${type}`;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#17a2b8'};
    color: white;
    padding: 15px 25px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    font-size: 16px;
    font-weight: 500;
    animation: slideIn 0.3s ease-out;
    direction: rtl;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// إضافة Animations للـ CSS
if (!document.querySelector('#toast-animations')) {
  const style = document.createElement('style');
  style.id = 'toast-animations';
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

/**
 * التحقق من صحة المدخلات
 * @param {string} value - القيمة المراد التحقق منها
 * @param {string} type - نوع التحقق: 'text', 'number', 'phone', 'email'
 * @param {boolean} required - هل الحقل إلزامي
 * @returns {Object} - {valid: boolean, message: string}
 */
function validateInput(value, type = 'text', required = true) {
  if (required && (!value || value.trim() === '')) {
    return { valid: false, message: 'هذا الحقل مطلوب' };
  }

  if (!value || value.trim() === '') {
    return { valid: true, message: '' };
  }

  switch (type) {
    case 'number':
      if (isNaN(value) || parseFloat(value) < 0) {
        return { valid: false, message: 'يجب إدخال رقم صحيح' };
      }
      break;
    case 'phone':
      if (!/^[\d\s\-+()]{7,15}$/.test(value)) {
        return { valid: false, message: 'رقم الهاتف غير صحيح' };
      }
      break;
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return { valid: false, message: 'البريد الإلكتروني غير صحيح' };
      }
      break;
  }

  return { valid: true, message: '' };
}

/**
 * تنسيق التاريخ حسب إعداد الإعدادات الإقليمية (dateFormat)
 * @param {string|Date} date - التاريخ المراد تنسيقه
 * @param {boolean} includeTime - إضافة الوقت
 * @returns {string} - التاريخ المنسق
 */
function formatDate(date, includeTime = false) {
  if (!date) return '';
  let d;
  if (typeof date === 'string' && date.includes(' ') && !date.includes('T')) {
    const [datePart, timePart] = date.split(' ');
    d = timePart ? new Date(datePart + 'T' + timePart) : new Date(datePart + 'T00:00:00');
  } else {
    d = new Date(date);
  }
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  if (includeTime) {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const dateStr = formatDatePart(year, month, day);
    return dateStr + ' ' + hours + ':' + minutes;
  }

  return formatDatePart(year, month, day);
}

/**
 * تطبيق تنسيق التاريخ من الإعدادات (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)
 */
function formatDatePart(year, month, day) {
  try {
    const raw = localStorage.getItem('appSettings');
    const format = (raw && JSON.parse(raw).dateFormat) || 'YYYY-MM-DD';
    if (format === 'DD/MM/YYYY') return `${day}/${month}/${year}`;
    if (format === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
  } catch (e) {}
  return `${year}-${month}-${day}`;
}

/**
 * رمز العملة من الإعدادات الإقليمية (للعرض في الواجهات)
 * @returns {string} - رمز العملة مثل ج.م أو USD
 */
function getCurrencySymbol() {
  try {
    const raw = localStorage.getItem('appSettings');
    const currency = (raw && JSON.parse(raw).currency) || '';
    if (currency) return currency;
  } catch (e) {}
  return 'ج.م';
}

/**
 * تنسيق الأرقام بالفواصل
 * @param {number} num - الرقم المراد تنسيقه
 * @param {number} decimals - عدد الخانات العشرية
 * @returns {string} - الرقم المنسق
 */
function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return '0.00';
  return parseFloat(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * تحويل التاريخ إلى نص نسبي (منذ 5 دقائق، منذ ساعتين، إلخ)
 * @param {string|Date} date - التاريخ
 * @returns {string} - النص النسبي
 */
function getRelativeTime(date) {
  if (!date) return '';

  // SQLite يخزن التاريخ بصيغة 'YYYY-MM-DD HH:MM:SS' بدون timezone
  // نحتاج نتعامل معه كتوقيت محلي وليس UTC
  let d;
  if (typeof date === 'string' && !date.includes('T') && !date.includes('Z')) {
    const [datePart, timePart] = date.split(' ');
    if (timePart) {
      d = new Date(`${datePart}T${timePart}`);
    } else {
      d = new Date(datePart + 'T00:00:00');
    }
  } else {
    d = new Date(date);
  }

  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 0) return 'الآن'; // في حالة فرق التوقيت
  if (diffMins < 1) return 'الآن';
  if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  if (diffDays < 30) return `منذ ${diffDays} يوم`;

  return formatDate(date);
}

/**
 * مربع حوار تأكيد
 * @param {string} message - رسالة التأكيد
 * @param {Function} onConfirm - دالة يتم تنفيذها عند التأكيد
 * @param {Function} onCancel - دالة يتم تنفيذها عند الإلغاء
 */
function confirmDialog(message, onConfirm, onCancel = null) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    animation: fadeIn 0.2s;
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    max-width: 400px;
    text-align: center;
    direction: rtl;
  `;

  const messageEl = document.createElement('p');
  messageEl.textContent = message;
  messageEl.style.cssText = 'font-size: 18px; margin-bottom: 25px; color: #333;';

  const buttonsDiv = document.createElement('div');
  buttonsDiv.style.cssText = 'display: flex; gap: 10px; justify-content: center;';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'تأكيد';
  confirmBtn.style.cssText = `
    padding: 10px 30px;
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s;
  `;
  confirmBtn.onmouseover = () => confirmBtn.style.background = '#c82333';
  confirmBtn.onmouseout = () => confirmBtn.style.background = '#dc3545';
  confirmBtn.onclick = () => {
    overlay.remove();
    if (onConfirm) onConfirm();
  };

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'إلغاء';
  cancelBtn.style.cssText = `
    padding: 10px 30px;
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s;
  `;
  cancelBtn.onmouseover = () => cancelBtn.style.background = '#5a6268';
  cancelBtn.onmouseout = () => cancelBtn.style.background = '#6c757d';
  cancelBtn.onclick = () => {
    overlay.remove();
    if (onCancel) onCancel();
  };

  buttonsDiv.appendChild(confirmBtn);
  buttonsDiv.appendChild(cancelBtn);
  dialog.appendChild(messageEl);
  dialog.appendChild(buttonsDiv);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
}

/**
 * Debounce function - تأخير تنفيذ دالة حتى يتوقف المستخدم عن الكتابة
 * @param {Function} func - الدالة المراد تنفيذها
 * @param {number} wait - وقت الانتظار بالميللي ثانية
 * @returns {Function} - الدالة المعدلة
 */
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Export to CSV
 * @param {Array} data - البيانات المراد تصديرها
 * @param {string} filename - اسم الملف
 */
function exportToCSV(data, filename = 'export.csv') {
  if (!data || data.length === 0) {
    showToast('لا توجد بيانات للتصدير', 'warning');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  
  showToast('تم التصدير بنجاح', 'success');
}

/**
 * Print table
 * @param {string} tableId - معرف الجدول
 * @param {string} title - عنوان الطباعة
 */
function printTable(tableId, title = 'طباعة') {
  const table = document.getElementById(tableId);
  if (!table) {
    showToast('لم يتم العثور على الجدول', 'error');
    return;
  }

  const printWindow = window.open('', '', 'width=800,height=600');
  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; direction: rtl; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
          th { background-color: #f4f4f4; font-weight: bold; }
          h2 { text-align: center; }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <h2>${title}</h2>
        ${table.outerHTML}
        <button onclick="window.print()">طباعة</button>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
}

/**
 * Loading spinner
 * @param {boolean} show - إظهار أو إخفاء
 */
function toggleLoading(show = true) {
  let spinner = document.getElementById('global-spinner');
  
  if (show) {
    if (!spinner) {
      spinner = document.createElement('div');
      spinner.id = 'global-spinner';
      spinner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9998;
      `;
      spinner.innerHTML = `
        <div style="
          border: 8px solid #f3f3f3;
          border-top: 8px solid #3498db;
          border-radius: 50%;
          width: 60px;
          height: 60px;
          animation: spin 1s linear infinite;
        "></div>
      `;
      document.body.appendChild(spinner);
      
      // Add spin animation if not exists
      if (!document.querySelector('#spin-animation')) {
        const style = document.createElement('style');
        style.id = 'spin-animation';
        style.textContent = `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
      }
    }
  } else {
    if (spinner) spinner.remove();
  }
}

/**
 * تنظيف النص من المسافات الزائدة
 * @param {string} text - النص المراد تنظيفه
 * @returns {string} - النص المنظف
 */
function cleanText(text) {
  if (!text) return '';
  return text.toString().trim().replace(/\s+/g, ' ');
}

/**
 * Generate unique ID
 * @returns {string} - معرف فريد
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ============================================
// دوال التحقق من المدخلات الرقمية
// ============================================

/**
 * التحقق من صحة رقم ضمن نطاق معين
 * @param {any} value - القيمة المراد التحقق منها
 * @param {Object} options - خيارات التحقق
 * @returns {Object} - {valid: boolean, value: number, message: string}
 */
function validateNumber(value, options = {}) {
  const {
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    required = true,
    allowZero = true,
    allowNegative = false,
    decimals = 2,
    fieldName = 'القيمة'
  } = options;

  // التحقق من القيمة الفارغة
  if (value === null || value === undefined || value === '') {
    if (required) {
      return { valid: false, value: 0, message: `${fieldName} مطلوب` };
    }
    return { valid: true, value: 0, message: '' };
  }

  // تحويل إلى رقم
  const num = parseFloat(value);

  // التحقق من أنه رقم صحيح
  if (isNaN(num)) {
    return { valid: false, value: 0, message: `${fieldName} يجب أن يكون رقماً صحيحاً` };
  }

  // التحقق من الأرقام السالبة
  if (!allowNegative && num < 0) {
    return { valid: false, value: 0, message: `${fieldName} لا يمكن أن يكون سالباً` };
  }

  // التحقق من الصفر
  if (!allowZero && num === 0) {
    return { valid: false, value: 0, message: `${fieldName} لا يمكن أن يكون صفراً` };
  }

  // التحقق من النطاق
  if (num < min) {
    return { valid: false, value: num, message: `${fieldName} يجب أن يكون ${min} على الأقل` };
  }

  if (num > max) {
    return { valid: false, value: num, message: `${fieldName} يجب ألا يتجاوز ${max}` };
  }

  // تقريب الرقم للخانات العشرية المطلوبة
  const roundedValue = Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);

  return { valid: true, value: roundedValue, message: '' };
}

/**
 * التحقق من صحة نسبة مئوية (0-100)
 * @param {any} value - القيمة المراد التحقق منها
 * @param {string} fieldName - اسم الحقل للرسائل
 * @returns {Object} - {valid: boolean, value: number, message: string}
 */
function validatePercentage(value, fieldName = 'النسبة المئوية') {
  return validateNumber(value, {
    min: 0,
    max: 100,
    fieldName,
    allowZero: true,
    decimals: 2
  });
}

/**
 * التحقق من صحة السعر
 * @param {any} value - القيمة المراد التحقق منها
 * @param {string} fieldName - اسم الحقل للرسائل
 * @returns {Object} - {valid: boolean, value: number, message: string}
 */
function validatePrice(value, fieldName = 'السعر') {
  return validateNumber(value, {
    min: 0,
    max: 999999999,
    fieldName,
    allowZero: true,
    allowNegative: false,
    decimals: 2
  });
}

/**
 * التحقق من صحة الكمية
 * @param {any} value - القيمة المراد التحقق منها
 * @param {string} fieldName - اسم الحقل للرسائل
 * @returns {Object} - {valid: boolean, value: number, message: string}
 */
function validateQuantity(value, fieldName = 'الكمية') {
  return validateNumber(value, {
    min: 0,
    max: 999999,
    fieldName,
    allowZero: false,
    allowNegative: false,
    decimals: 0
  });
}

/**
 * التحقق من صحة الخصم
 * @param {any} discountValue - قيمة الخصم
 * @param {any} totalValue - المبلغ الإجمالي
 * @param {boolean} isPercentage - هل الخصم نسبة مئوية
 * @returns {Object} - {valid: boolean, value: number, message: string}
 */
function validateDiscount(discountValue, totalValue = null, isPercentage = false) {
  if (isPercentage) {
    return validatePercentage(discountValue, 'نسبة الخصم');
  }

  const result = validateNumber(discountValue, {
    min: 0,
    fieldName: 'قيمة الخصم',
    allowZero: true,
    decimals: 2
  });

  if (!result.valid) return result;

  // التحقق من أن الخصم لا يتجاوز المبلغ الإجمالي
  if (totalValue !== null && result.value > totalValue) {
    return {
      valid: false,
      value: result.value,
      message: `قيمة الخصم لا يمكن أن تتجاوز المبلغ الإجمالي (${formatNumber(totalValue)})`
    };
  }

  return result;
}

/**
 * تنظيف قيمة رقمية من الفواصل والرموز
 * @param {string} value - القيمة المراد تنظيفها
 * @returns {number} - الرقم النظيف
 */
function cleanNumber(value) {
  if (value === null || value === undefined) return 0;
  // إزالة كل شيء ما عدا الأرقام والنقطة والسالب
  const cleaned = String(value).replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * تنسيق الأرقام بشكل مختصر (fmt)
 * @param {number} n - الرقم
 * @param {number} decimals - عدد الخانات العشرية
 * @returns {string} - الرقم المنسق
 */
if (!window.fmt) {
  window.fmt = function(n, decimals = 2) {
    return Number(n || 0).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };
}
// Local reference for use within this file
var fmt = window.fmt;

// ============================================
// نظام معالجة الأخطاء الموحد
// ============================================

/**
 * فئة الأخطاء المخصصة للتطبيق
 */
class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * معالجة الأخطاء بشكل موحد
 * @param {Error} error - الخطأ
 * @param {string} context - سياق الخطأ
 * @param {boolean} showToUser - عرض رسالة للمستخدم
 */
function handleError(error, context = '', showToUser = true) {
  // تسجيل الخطأ
  Logger.error(`[${context}]`, error.message, error.details || '');

  // عرض رسالة للمستخدم
  if (showToUser && typeof showToast === 'function') {
    const userMessage = error instanceof AppError
      ? error.message
      : 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
    showToast(userMessage, 'error');
  }

  return error;
}

/**
 * تنفيذ دالة مع معالجة الأخطاء
 * @param {Function} fn - الدالة المراد تنفيذها
 * @param {string} context - سياق العملية
 * @param {any} fallbackValue - قيمة افتراضية في حالة الخطأ
 */
async function safeExecute(fn, context = '', fallbackValue = null) {
  try {
    return await fn();
  } catch (error) {
    handleError(error, context);
    return fallbackValue;
  }
}

// تصدير الدوال للاستخدام العام
window.validateNumber = validateNumber;
window.validatePercentage = validatePercentage;
window.validatePrice = validatePrice;
window.validateQuantity = validateQuantity;
window.validateDiscount = validateDiscount;
window.cleanNumber = cleanNumber;
// window.fmt already exported above
window.AppError = AppError;
window.handleError = handleError;
window.safeExecute = safeExecute;

// ============================================
// دالة حماية XSS الموحدة
// ============================================

/**
 * تحويل النص لـ HTML آمن (منع XSS)
 * @param {any} text - النص المراد تأمينه
 * @returns {string} - النص الآمن
 */
if (!window.escapeHtml) {
  window.escapeHtml = function(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  };
}
// Local reference for use within this file
var escapeHtml = window.escapeHtml;

// ═══════════════════════════════════════════════════════════════
// 🔒 INPUT VALIDATION SYSTEM - نظام التحقق من صحة المدخلات
// ═══════════════════════════════════════════════════════════════

/**
 * نظام التحقق الشامل من المدخلات
 */
window.Validator = {
  /**
   * التحقق من IMEI
   * @param {string} imei - رقم IMEI
   * @returns {{valid: boolean, message: string}}
   */
  imei(imei) {
    if (!imei || imei.trim() === '') {
      return { valid: true, message: '' }; // IMEI اختياري
    }
    const cleaned = imei.replace(/\D/g, '');
    if (cleaned.length !== 15) {
      return { valid: false, message: 'رقم IMEI يجب أن يكون 15 رقم' };
    }
    // Luhn algorithm check
    if (!this._luhnCheck(cleaned)) {
      return { valid: false, message: 'رقم IMEI غير صالح' };
    }
    return { valid: true, message: '' };
  },

  /**
   * Luhn algorithm للتحقق من IMEI
   * @private
   */
  _luhnCheck(num) {
    let sum = 0;
    for (let i = 0; i < num.length; i++) {
      let digit = parseInt(num[i]);
      if ((num.length - i) % 2 === 0) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }
    return sum % 10 === 0;
  },

  /**
   * التحقق من رقم الهاتف المصري
   * @param {string} phone - رقم الهاتف
   * @returns {{valid: boolean, message: string}}
   */
  phone(phone) {
    if (!phone || phone.trim() === '') {
      return { valid: true, message: '' }; // الهاتف اختياري في بعض الحالات
    }
    const cleaned = phone.replace(/[\s\-()]/g, '');
    // أرقام مصرية: 01xxxxxxxx أو +201xxxxxxxx
    if (!/^(\+?20)?01[0-25]\d{8}$/.test(cleaned)) {
      return { valid: false, message: 'رقم الهاتف يجب أن يبدأ بـ 01 ويكون 11 رقم' };
    }
    return { valid: true, message: '' };
  },

  /**
   * التحقق من المبلغ المالي
   * @param {number|string} amount - المبلغ
   * @param {Object} options - خيارات {min, max, allowZero, required}
   * @returns {{valid: boolean, message: string}}
   */
  money(amount, options = {}) {
    const { min = 0, max = Infinity, allowZero = true, required = false } = options;

    if (amount === '' || amount === null || amount === undefined) {
      if (required) {
        return { valid: false, message: 'المبلغ مطلوب' };
      }
      return { valid: true, message: '' };
    }

    const num = parseFloat(amount);
    if (isNaN(num)) {
      return { valid: false, message: 'المبلغ يجب أن يكون رقماً' };
    }
    if (!allowZero && num === 0) {
      return { valid: false, message: 'المبلغ لا يمكن أن يكون صفر' };
    }
    if (num < min) {
      return { valid: false, message: `المبلغ يجب أن يكون على الأقل ${min}` };
    }
    if (num > max) {
      return { valid: false, message: `المبلغ لا يمكن أن يتجاوز ${max}` };
    }
    return { valid: true, message: '' };
  },

  /**
   * التحقق من النص
   * @param {string} text - النص
   * @param {Object} options - خيارات {minLength, maxLength, required, pattern}
   * @returns {{valid: boolean, message: string}}
   */
  text(text, options = {}) {
    const { minLength = 0, maxLength = 1000, required = false, pattern = null, patternMessage = 'تنسيق غير صحيح' } = options;

    if (!text || text.trim() === '') {
      if (required) {
        return { valid: false, message: 'هذا الحقل مطلوب' };
      }
      return { valid: true, message: '' };
    }

    const trimmed = text.trim();
    if (trimmed.length < minLength) {
      return { valid: false, message: `يجب أن يكون على الأقل ${minLength} حرف` };
    }
    if (trimmed.length > maxLength) {
      return { valid: false, message: `لا يمكن أن يتجاوز ${maxLength} حرف` };
    }
    if (pattern && !pattern.test(trimmed)) {
      return { valid: false, message: patternMessage };
    }
    return { valid: true, message: '' };
  },

  /**
   * التحقق من التاريخ
   * @param {string} date - التاريخ
   * @param {Object} options - خيارات {required, notFuture, notPast}
   * @returns {{valid: boolean, message: string}}
   */
  date(date, options = {}) {
    const { required = false, notFuture = false, notPast = false } = options;

    if (!date || date.trim() === '') {
      if (required) {
        return { valid: false, message: 'التاريخ مطلوب' };
      }
      return { valid: true, message: '' };
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return { valid: false, message: 'تاريخ غير صالح' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (notFuture && d > today) {
      return { valid: false, message: 'التاريخ لا يمكن أن يكون في المستقبل' };
    }
    if (notPast && d < today) {
      return { valid: false, message: 'التاريخ لا يمكن أن يكون في الماضي' };
    }

    return { valid: true, message: '' };
  },

  /**
   * التحقق من الكمية
   * @param {number|string} qty - الكمية
   * @param {Object} options - خيارات {min, max, required, integer}
   * @returns {{valid: boolean, message: string}}
   */
  quantity(qty, options = {}) {
    const { min = 1, max = Infinity, required = true, integer = true } = options;

    if (qty === '' || qty === null || qty === undefined) {
      if (required) {
        return { valid: false, message: 'الكمية مطلوبة' };
      }
      return { valid: true, message: '' };
    }

    const num = parseFloat(qty);
    if (isNaN(num)) {
      return { valid: false, message: 'الكمية يجب أن تكون رقماً' };
    }
    if (integer && !Number.isInteger(num)) {
      return { valid: false, message: 'الكمية يجب أن تكون عدد صحيح' };
    }
    if (num < min) {
      return { valid: false, message: `الكمية يجب أن تكون على الأقل ${min}` };
    }
    if (num > max) {
      return { valid: false, message: `الكمية لا يمكن أن تتجاوز ${max}` };
    }
    return { valid: true, message: '' };
  },

  /**
   * التحقق من نموذج كامل
   * @param {Object} rules - قواعد التحقق {fieldName: {type, options, value}}
   * @returns {{valid: boolean, errors: Object}}
   */
  form(rules) {
    const errors = {};
    let valid = true;

    for (const [field, rule] of Object.entries(rules)) {
      const { type, value, options = {} } = rule;
      let result;

      switch (type) {
        case 'imei':
          result = this.imei(value);
          break;
        case 'phone':
          result = this.phone(value);
          break;
        case 'money':
          result = this.money(value, options);
          break;
        case 'text':
          result = this.text(value, options);
          break;
        case 'date':
          result = this.date(value, options);
          break;
        case 'quantity':
          result = this.quantity(value, options);
          break;
        default:
          result = { valid: true, message: '' };
      }

      if (!result.valid) {
        valid = false;
        errors[field] = result.message;
      }
    }

    return { valid, errors };
  },

  /**
   * عرض أخطاء التحقق على الحقول
   * @param {Object} errors - كائن الأخطاء {fieldId: message}
   */
  showErrors(errors) {
    // إزالة الأخطاء السابقة
    document.querySelectorAll('.validation-error').forEach(el => el.remove());
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

    for (const [fieldId, message] of Object.entries(errors)) {
      const field = document.getElementById(fieldId);
      if (field) {
        field.classList.add('input-error');

        const errorDiv = document.createElement('div');
        errorDiv.className = 'validation-error';
        errorDiv.textContent = message;
        errorDiv.style.cssText = 'color: #ef4444; font-size: 12px; margin-top: 4px;';
        field.parentNode.insertBefore(errorDiv, field.nextSibling);
      }
    }
  },

  /**
   * مسح جميع أخطاء التحقق
   */
  clearErrors() {
    document.querySelectorAll('.validation-error').forEach(el => el.remove());
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
  }
};

// إضافة CSS للأخطاء
if (!document.querySelector('#validation-styles')) {
  const style = document.createElement('style');
  style.id = 'validation-styles';
  style.textContent = `
    .input-error {
      border-color: #ef4444 !important;
      box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2) !important;
    }
    .input-error:focus {
      border-color: #ef4444 !important;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.3) !important;
    }
  `;
  document.head.appendChild(style);
}

// ═══════════════════════════════════════════════════════════════
// 🧹 CLEANUP MANAGER - إدارة تنظيف الموارد
// ═══════════════════════════════════════════════════════════════

/**
 * مدير تنظيف الموارد (Event Listeners, Timers, etc.)
 */
window.CleanupManager = {
  _listeners: [],
  _timers: [],
  _intervals: [],

  /**
   * تسجيل event listener لتنظيفه لاحقاً
   */
  addListener(element, event, handler, options) {
    element.addEventListener(event, handler, options);
    this._listeners.push({ element, event, handler, options });
    return handler;
  },

  /**
   * تسجيل setTimeout لتنظيفه لاحقاً
   */
  setTimeout(callback, delay) {
    const id = setTimeout(callback, delay);
    this._timers.push(id);
    return id;
  },

  /**
   * تسجيل setInterval لتنظيفه لاحقاً
   */
  setInterval(callback, delay) {
    const id = setInterval(callback, delay);
    this._intervals.push(id);
    return id;
  },

  /**
   * تنظيف جميع الموارد المسجلة
   */
  cleanup() {
    // تنظيف event listeners
    this._listeners.forEach(({ element, event, handler, options }) => {
      try {
        element.removeEventListener(event, handler, options);
      } catch (e) {
        // تجاهل الأخطاء
      }
    });
    this._listeners = [];

    // تنظيف timeouts
    this._timers.forEach(id => clearTimeout(id));
    this._timers = [];

    // تنظيف intervals
    this._intervals.forEach(id => clearInterval(id));
    this._intervals = [];

    Logger.log('[CleanupManager] Resources cleaned up');
  }
};

// تنظيف تلقائي عند مغادرة الصفحة
window.addEventListener('beforeunload', () => {
  window.CleanupManager.cleanup();
});
