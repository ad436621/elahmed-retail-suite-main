/**
 * config.js - إدارة إعدادات التطبيق ومتغيرات البيئة
 * ═══════════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * تحميل متغيرات البيئة من ملف .env
 */
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');

  if (!fs.existsSync(envPath)) {
    console.warn('[CONFIG] ملف .env غير موجود، سيتم استخدام القيم الافتراضية');
    return;
  }

  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    for (const line of lines) {
      // تجاهل التعليقات والأسطر الفارغة
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // البحث عن أول علامة = فقط
      const equalsIndex = trimmedLine.indexOf('=');
      if (equalsIndex === -1) {
        continue;
      }

      const key = trimmedLine.substring(0, equalsIndex).trim();
      let value = trimmedLine.substring(equalsIndex + 1).trim();

      // إزالة علامات الاقتباس إذا وجدت
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // تعيين متغير البيئة فقط إذا لم يكن موجوداً
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }

    console.log('[CONFIG] تم تحميل متغيرات البيئة من .env');
  } catch (error) {
    console.error('[CONFIG] خطأ في قراءة ملف .env:', error.message);
  }
}

// تحميل متغيرات البيئة عند استيراد الملف
loadEnvFile();

/**
 * توليد مفتاح مشتق من معلومات الجهاز (للجلسات فقط)
 * هذا يجعل المفتاح فريداً لكل جهاز
 */
function deriveMachineBasedKey(baseKey, purpose) {
  const os = require('os');
  const machineInfo = os.hostname() + os.platform() + os.arch() + (process.env.USERNAME || '');
  const salt = crypto.createHash('md5').update(machineInfo).digest('hex');
  return crypto.scryptSync(baseKey + salt, purpose, 32).toString('hex');
}

/**
 * التحقق من قوة المفتاح
 */
function isStrongKey(key) {
  if (!key || key.length < 32) return false;
  // التحقق من أنه ليس مفتاح افتراضي معروف
  const weakPatterns = ['test', 'demo', 'default', '123', 'password', 'secret'];
  const lowerKey = key.toLowerCase();
  return !weakPatterns.some(p => lowerKey.includes(p));
}

/**
 * الإعدادات الرئيسية للتطبيق
 */
const config = {
  // بيئة التشغيل
  env: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',

  // مفاتيح التشفير
  secrets: {
    // مفتاح الترخيص - يجب أن يكون ثابتاً (نفسه في أداة التوليد والبرنامج)
    // لأن التراخيص يتم توليدها خارجياً
    get license() {
      const key = process.env.ELOS_LICENSE_SECRET;
      if (!key) {
        console.error('[CONFIG] خطأ حرج: ELOS_LICENSE_SECRET غير معين!');
        console.error('[CONFIG] يجب تعيين المفتاح في ملف .env');
        // في الإنتاج، لا نستخدم مفتاح افتراضي
        if (process.env.NODE_ENV === 'production') {
          throw new Error('ELOS_LICENSE_SECRET is required in production');
        }
        // للتطوير فقط
        return 'ELOS-DEV-LICENSE-KEY-NOT-FOR-PRODUCTION';
      }
      return key;
    },

    // مفتاح الجلسة - يمكن أن يكون مشتقاً من الجهاز (أكثر أماناً)
    get session() {
      const key = process.env.ELOS_SESSION_SECRET;
      if (!key) {
        console.warn('[CONFIG] تحذير: ELOS_SESSION_SECRET غير معين');
        // توليد مفتاح مؤقت للجلسات
        return deriveMachineBasedKey('ELOS-SESSION-FALLBACK', 'session');
      }
      // دمج المفتاح مع معلومات الجهاز لمزيد من الأمان
      return deriveMachineBasedKey(key, 'session');
    },

    // للتحقق من أن المفاتيح معينة بشكل صحيح
    get isConfigured() {
      return !!(process.env.ELOS_LICENSE_SECRET && process.env.ELOS_SESSION_SECRET);
    },

    // للتحقق من قوة المفاتيح
    get isSecure() {
      return isStrongKey(process.env.ELOS_LICENSE_SECRET) &&
             isStrongKey(process.env.ELOS_SESSION_SECRET);
    }
  },

  // إعدادات التسجيل
  logging: {
    debug: process.env.ELOS_DEBUG === 'true',
    level: process.env.LOG_LEVEL || 'error',
  },

  // إعدادات الأمان
  security: {
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    lockoutDuration: (parseInt(process.env.LOCKOUT_DURATION_MINUTES) || 15) * 60 * 1000,
  },

  // إعدادات النسخ الاحتياطي
  backup: {
    enabled: process.env.AUTO_BACKUP !== 'false',
    maxBackups: parseInt(process.env.MAX_BACKUPS) || 10,
    path: process.env.BACKUP_PATH || null,
  },

  // إعدادات قاعدة البيانات
  database: {
    path: process.env.DB_PATH || null,
  },

  // 🌐 إعدادات الشبكة - Network Settings
  network: {
    // وضع السيرفر: 'local' (محلي فقط) أو 'network' (عبر الشبكة)
    mode: process.env.ELOS_SERVER_MODE || 'local',
    isNetworkMode: process.env.ELOS_SERVER_MODE === 'network',

    // المنفذ والعنوان
    port: parseInt(process.env.ELOS_SERVER_PORT) || 48572,
    host: process.env.ELOS_SERVER_MODE === 'network' ? '0.0.0.0' : '127.0.0.1',

    // نطاق IPs المسموح بها (للأمان)
    allowedIPs: process.env.ELOS_ALLOWED_IPS || null,

    // إعدادات العميل (إذا كان الجهاز client)
    clientMode: process.env.ELOS_CLIENT_MODE === 'true',
    serverIP: process.env.ELOS_SERVER_IP || null,
  },
};

/**
 * التحقق من صحة الإعدادات
 */
function validateConfig() {
  const warnings = [];
  const errors = [];

  // التحقق من وجود المفاتيح
  if (!config.secrets.isConfigured) {
    errors.push('المفاتيح السرية غير معينة في ملف .env');
  }

  // التحقق من قوة المفاتيح
  if (!config.secrets.isSecure) {
    warnings.push('المفاتيح السرية ضعيفة - يُنصح باستخدام مفاتيح أقوى (32 حرف على الأقل)');
  }

  // طباعة الأخطاء
  if (errors.length > 0) {
    console.error('[CONFIG] أخطاء حرجة في الإعدادات:');
    errors.forEach(e => console.error(`  ❌ ${e}`));

    if (config.isProduction) {
      console.error('[CONFIG] لا يمكن تشغيل التطبيق في بيئة الإنتاج بدون إعدادات صحيحة');
    }
  }

  // طباعة التحذيرات
  if (warnings.length > 0) {
    console.warn('[CONFIG] تحذيرات الأمان:');
    warnings.forEach(w => console.warn(`  ⚠️ ${w}`));
  }

  // رسالة نجاح
  if (errors.length === 0 && warnings.length === 0) {
    console.log('[CONFIG] ✅ جميع الإعدادات صحيحة وآمنة');
  }

  return { warnings, errors };
}

// التحقق من الإعدادات
const validationResult = validateConfig();

// تصدير الإعدادات مع نتيجة التحقق
config.validation = validationResult;

module.exports = config;
