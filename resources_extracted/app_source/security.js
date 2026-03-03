/**
 * security.js - طبقة أمان إضافية للتطبيق
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * هذا الملف يوفر:
 * 1. توليد مفاتيح ديناميكية بناءً على الجهاز
 * 2. التحقق من سلامة التطبيق
 * 3. حماية ضد التلاعب
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * توليد مفتاح فريد للجهاز (لا يُخزن في الكود)
 * يعتمد على معلومات الجهاز + مفتاح البيئة
 */
function generateMachineKey(baseSalt = '') {
  try {
    let machineInfo = '';

    if (process.platform === 'win32') {
      // جمع معلومات الجهاز
      try {
        const cpuId = execSync(
          'powershell -NoProfile -Command "(Get-CimInstance -ClassName Win32_Processor).ProcessorId"',
          { encoding: 'utf8', windowsHide: true, timeout: 5000 }
        ).trim();
        machineInfo += cpuId;
      } catch (e) {
        machineInfo += 'CPU' + require('os').cpus()[0].model;
      }

      try {
        const biosSerial = execSync(
          'powershell -NoProfile -Command "(Get-CimInstance -ClassName Win32_BIOS).SerialNumber"',
          { encoding: 'utf8', windowsHide: true, timeout: 5000 }
        ).trim();
        machineInfo += biosSerial;
      } catch (e) {
        machineInfo += require('os').hostname();
      }
    } else {
      machineInfo = require('os').hostname() + require('os').cpus()[0].model;
    }

    // دمج مع الـ salt
    const combined = machineInfo + baseSalt + process.env.USERNAME;

    // توليد المفتاح
    return crypto.createHash('sha256').update(combined).digest();
  } catch (error) {
    // Fallback آمن
    return crypto.createHash('sha256')
      .update(require('os').hostname() + baseSalt)
      .digest();
  }
}

/**
 * تشفير نص باستخدام مفتاح الجهاز
 */
function encryptWithMachineKey(text, additionalSalt = '') {
  const key = generateMachineKey(additionalSalt);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return iv.toString('hex') + ':' + encrypted;
}

/**
 * فك تشفير نص باستخدام مفتاح الجهاز
 */
function decryptWithMachineKey(encryptedText, additionalSalt = '') {
  try {
    const key = generateMachineKey(additionalSalt);
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    return null;
  }
}

/**
 * التحقق من سلامة ملفات التطبيق الأساسية
 */
function verifyAppIntegrity(appPath) {
  const criticalFiles = [
    'main.js',
    'license.js',
    'db.js',
    'config.js',
    'preload.js'
  ];

  const results = {
    valid: true,
    errors: [],
    checksums: {}
  };

  for (const file of criticalFiles) {
    const filePath = path.join(appPath, file);

    if (!fs.existsSync(filePath)) {
      results.valid = false;
      results.errors.push(`ملف مفقود: ${file}`);
      continue;
    }

    try {
      const content = fs.readFileSync(filePath);
      const checksum = crypto.createHash('sha256').update(content).digest('hex');
      results.checksums[file] = checksum;
    } catch (error) {
      results.valid = false;
      results.errors.push(`خطأ في قراءة: ${file}`);
    }
  }

  return results;
}

/**
 * توليد توقيع للترخيص مع ربطه بالجهاز
 */
function generateLicenseSignature(licenseData, machineId) {
  const payload = JSON.stringify({
    ...licenseData,
    machineId,
    timestamp: Date.now()
  });

  const machineKey = generateMachineKey(machineId);

  return crypto.createHmac('sha512', machineKey)
    .update(payload)
    .digest('hex');
}

/**
 * التحقق من توقيع الترخيص
 */
function verifyLicenseSignature(licenseData, machineId, signature) {
  const expectedSignature = generateLicenseSignature(licenseData, machineId);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * توليد مفتاح التشفير الآمن
 * يدمج بين مفتاح البيئة ومعلومات الجهاز
 */
function deriveSecureKey(envSecret, purpose = 'general') {
  const machineKey = generateMachineKey(purpose);
  const envKey = crypto.createHash('sha256').update(envSecret || '').digest();

  // دمج المفتاحين باستخدام XOR
  const combinedKey = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    combinedKey[i] = machineKey[i] ^ envKey[i];
  }

  // استخدام scrypt لتقوية المفتاح
  return crypto.scryptSync(combinedKey, purpose, 32);
}

/**
 * كشف محاولات التلاعب
 */
function detectTampering() {
  const warnings = [];

  // التحقق من وجود DevTools مفتوحة (في renderer process)
  if (typeof window !== 'undefined' && window.devtools) {
    warnings.push('DevTools detected');
  }

  // التحقق من تعديل الـ prototype
  if (Object.prototype.hasOwnProperty.call(Object.prototype, 'watch')) {
    warnings.push('Object.prototype modified');
  }

  // التحقق من debugger
  try {
    const start = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    const end = performance.now();
    if (end - start > 100) {
      warnings.push('Debugger detected');
    }
  } catch (e) {
    // تجاهل
  }

  return warnings;
}

/**
 * حماية المتغيرات الحساسة من القراءة
 */
function protectSensitiveData(obj) {
  return new Proxy(obj, {
    get(target, prop) {
      // منع الوصول للخصائص الحساسة من console
      if (typeof prop === 'string' && prop.toLowerCase().includes('secret')) {
        console.warn('[SECURITY] محاولة وصول غير مصرح بها');
        return '[PROTECTED]';
      }
      return target[prop];
    },
    set(target, prop, value) {
      // منع تعديل الخصائص الحساسة
      if (typeof prop === 'string' && prop.toLowerCase().includes('secret')) {
        console.warn('[SECURITY] محاولة تعديل غير مصرح بها');
        return false;
      }
      target[prop] = value;
      return true;
    }
  });
}

/**
 * تسجيل أحداث الأمان
 */
const securityLog = [];

function logSecurityEvent(event, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    details,
    machineInfo: {
      hostname: require('os').hostname(),
      platform: process.platform,
      username: process.env.USERNAME || process.env.USER
    }
  };

  securityLog.push(entry);

  // الاحتفاظ بآخر 1000 حدث فقط
  if (securityLog.length > 1000) {
    securityLog.shift();
  }

  // تسجيل الأحداث الخطيرة
  if (event.includes('CRITICAL') || event.includes('TAMPER')) {
    console.error('[SECURITY]', event, details);
  }
}

module.exports = {
  generateMachineKey,
  encryptWithMachineKey,
  decryptWithMachineKey,
  verifyAppIntegrity,
  generateLicenseSignature,
  verifyLicenseSignature,
  deriveSecureKey,
  detectTampering,
  protectSensitiveData,
  logSecurityEvent,
  getSecurityLog: () => [...securityLog]
};
