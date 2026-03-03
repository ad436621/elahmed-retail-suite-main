// license.js — نظام الترخيص للبرنامج
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// تحميل الإعدادات
const config = require('./config');

// مفتاح التشفير من الإعدادات
const LICENSE_SECRET = config.secrets.license;

// أنواع التراخيص وحدود المستخدمين
const LICENSE_TYPES = {
  'BASIC': { maxUsers: 2, name: 'Basic', features: ['pos', 'inventory', 'sales'] },
  'PRO': { maxUsers: 5, name: 'Pro', features: ['pos', 'inventory', 'sales', 'reports', 'suppliers', 'purchases'] },
  'ENTERPRISE': { maxUsers: 999, name: 'Enterprise', features: ['all'] }
};

class LicenseManager {
  constructor(dataPath) {
    this.dataPath = dataPath;
    this.licensePath = path.join(dataPath, 'license.enc');
    this.machineIdCachePath = path.join(dataPath, 'machine.id');
    this.licenseData = null;
    this._cachedMachineId = null;
  }

  // توليد Machine ID فريد للجهاز (مع Cache للسرعة)
  getMachineId() {
    // 1. إرجاع من الذاكرة إذا موجود
    if (this._cachedMachineId) {
      return this._cachedMachineId;
    }

    // 2. قراءة من الملف إذا موجود (فوري!)
    try {
      if (fs.existsSync(this.machineIdCachePath)) {
        const cached = fs.readFileSync(this.machineIdCachePath, 'utf8').trim();
        if (cached && cached.length === 32) {
          this._cachedMachineId = cached;
          return cached;
        }
      }
    } catch (e) {
      // تجاهل أخطاء القراءة
    }

    // 3. توليد Machine ID جديد (بطيء - مرة واحدة فقط)
    try {
      let machineInfo = '';

      if (process.platform === 'win32') {
        try {
          const cpuId = execSync(
            'powershell -NoProfile -Command "(Get-CimInstance -ClassName Win32_Processor).ProcessorId"',
            { encoding: 'utf8', windowsHide: true, timeout: 5000 }
          );
          machineInfo += cpuId.replace(/\s+/g, '');
        } catch (e) {
          machineInfo += 'CPU-UNKNOWN';
        }

        try {
          const mbSerial = execSync(
            'powershell -NoProfile -Command "(Get-CimInstance -ClassName Win32_BaseBoard).SerialNumber"',
            { encoding: 'utf8', windowsHide: true, timeout: 5000 }
          );
          machineInfo += mbSerial.replace(/\s+/g, '');
        } catch (e) {
          machineInfo += 'MB-UNKNOWN';
        }

        try {
          const diskSerial = execSync(
            'powershell -NoProfile -Command "(Get-CimInstance -ClassName Win32_DiskDrive | Select-Object -First 1).SerialNumber"',
            { encoding: 'utf8', windowsHide: true, timeout: 5000 }
          );
          machineInfo += diskSerial.replace(/\s+/g, '');
        } catch (e) {
          machineInfo += 'DISK-UNKNOWN';
        }
      } else {
        machineInfo = require('os').hostname() + require('os').cpus()[0].model;
      }

      const hash = crypto.createHash('sha256')
        .update(machineInfo + LICENSE_SECRET)
        .digest('hex');

      const machineId = hash.substring(0, 32).toUpperCase();

      // 4. حفظ في الملف للمرات القادمة (التشغيلات الجاية هتكون فورية!)
      try {
        if (!fs.existsSync(this.dataPath)) {
          fs.mkdirSync(this.dataPath, { recursive: true });
        }
        fs.writeFileSync(this.machineIdCachePath, machineId, 'utf8');
      } catch (e) {
        // تجاهل أخطاء الكتابة
      }

      this._cachedMachineId = machineId;
      return machineId;
    } catch (error) {
      console.error('[LICENSE] Error getting machine ID:', error.message);
      const fallback = crypto.createHash('sha256')
        .update(require('os').hostname() + LICENSE_SECRET)
        .digest('hex');
      return fallback.substring(0, 32).toUpperCase();
    }
  }

  // التحقق من صحة الترخيص
  validateLicense(licenseKey) {
    try {
      // فك تشفير مفتاح الترخيص
      const decoded = this.decodeLicenseKey(licenseKey);
      if (!decoded) {
        return { valid: false, error: 'مفتاح الترخيص غير صالح' };
      }

      // التحقق من Machine ID
      const currentMachineId = this.getMachineId();
      if (decoded.machineId !== currentMachineId) {
        return {
          valid: false,
          error: 'هذا الترخيص مخصص لجهاز آخر',
          expectedMachine: decoded.machineId,
          currentMachine: currentMachineId
        };
      }

      // التحقق من تاريخ الانتهاء (LIFETIME = مدى الحياة)
      const isLifetime = decoded.expiryDate === 'LIFETIME';
      let daysRemaining = 0;

      if (!isLifetime) {
        const expiryDate = new Date(decoded.expiryDate);
        const now = new Date();
        if (now > expiryDate) {
          return {
            valid: false,
            error: 'انتهت صلاحية الترخيص',
            expiryDate: decoded.expiryDate
          };
        }
        daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
      }

      // التحقق من نوع الترخيص
      if (!LICENSE_TYPES[decoded.licenseType]) {
        return { valid: false, error: 'نوع الترخيص غير معروف' };
      }

      // الترخيص صالح
      return {
        valid: true,
        licenseType: decoded.licenseType,
        typeName: LICENSE_TYPES[decoded.licenseType].name,
        maxUsers: LICENSE_TYPES[decoded.licenseType].maxUsers,
        features: LICENSE_TYPES[decoded.licenseType].features,
        expiryDate: decoded.expiryDate,
        customerName: decoded.customerName,
        isLifetime: isLifetime,
        daysRemaining: isLifetime ? Infinity : daysRemaining
      };
    } catch (error) {
      console.error('[LICENSE] Validation error:', error.message);
      return { valid: false, error: 'خطأ في التحقق من الترخيص' };
    }
  }

  // فك تشفير مفتاح الترخيص
  decodeLicenseKey(licenseKey) {
    try {
      // إزالة الفواصل والمسافات
      const cleanKey = licenseKey.replace(/[-\s]/g, '');

      // فك التشفير من Base64
      const encrypted = Buffer.from(cleanKey, 'base64').toString('utf8');

      // فصل IV عن البيانات المشفرة
      const [ivHex, encryptedHex, signature] = encrypted.split(':');
      if (!ivHex || !encryptedHex || !signature) {
        return null;
      }

      // التحقق من التوقيع
      const expectedSignature = crypto.createHmac('sha256', LICENSE_SECRET)
        .update(ivHex + ':' + encryptedHex)
        .digest('hex')
        .substring(0, 16);

      if (signature !== expectedSignature) {
        return null;
      }

      // فك التشفير AES
      const iv = Buffer.from(ivHex, 'hex');
      const key = crypto.createHash('sha256').update(LICENSE_SECRET).digest();
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      console.error('[LICENSE] Decode error:', error.message);
      return null;
    }
  }

  // حفظ الترخيص
  saveLicense(licenseKey) {
    try {
      const validation = this.validateLicense(licenseKey);
      if (!validation.valid) {
        return validation;
      }

      // تشفير وحفظ الترخيص
      const iv = crypto.randomBytes(16);
      const key = crypto.createHash('sha256').update(this.dataPath + LICENSE_SECRET).digest();
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

      const data = JSON.stringify({
        licenseKey: licenseKey,
        activatedAt: new Date().toISOString(),
        machineId: this.getMachineId()
      });

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const fileContent = iv.toString('hex') + ':' + encrypted;
      fs.writeFileSync(this.licensePath, fileContent, 'utf8');

      this.licenseData = validation;
      console.log('[LICENSE] License saved successfully');

      return { success: true, ...validation };
    } catch (error) {
      console.error('[LICENSE] Save error:', error.message);
      return { valid: false, error: 'خطأ في حفظ الترخيص' };
    }
  }

  // تحميل الترخيص المحفوظ
  loadLicense() {
    try {
      if (!fs.existsSync(this.licensePath)) {
        return { valid: false, error: 'لا يوجد ترخيص مفعل', needsActivation: true };
      }

      const fileContent = fs.readFileSync(this.licensePath, 'utf8');
      const [ivHex, encryptedHex] = fileContent.split(':');

      const iv = Buffer.from(ivHex, 'hex');
      const key = crypto.createHash('sha256').update(this.dataPath + LICENSE_SECRET).digest();
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      const savedData = JSON.parse(decrypted);

      // التحقق من أن الجهاز هو نفسه
      if (savedData.machineId !== this.getMachineId()) {
        return { valid: false, error: 'الترخيص مخصص لجهاز آخر', needsActivation: true };
      }

      // التحقق من صلاحية الترخيص
      const validation = this.validateLicense(savedData.licenseKey);

      // إضافة تاريخ التفعيل من البيانات المحفوظة
      validation.activatedAt = savedData.activatedAt || null;

      this.licenseData = validation;

      return validation;
    } catch (error) {
      console.error('[LICENSE] Load error:', error.message);
      return { valid: false, error: 'خطأ في قراءة الترخيص', needsActivation: true };
    }
  }

  // الحصول على بيانات الترخيص الحالي
  getCurrentLicense() {
    if (this.licenseData) {
      return this.licenseData;
    }
    return this.loadLicense();
  }

  // التحقق من عدد المستخدمين
  checkUserLimit(currentUserCount) {
    const license = this.getCurrentLicense();
    if (!license.valid) {
      return { allowed: false, error: license.error };
    }

    if (currentUserCount >= license.maxUsers) {
      return {
        allowed: false,
        error: `وصلت للحد الأقصى من المستخدمين (${license.maxUsers}) لنوع الترخيص ${license.typeName}`,
        maxUsers: license.maxUsers,
        currentUsers: currentUserCount
      };
    }

    return { allowed: true, remaining: license.maxUsers - currentUserCount };
  }

  // التحقق من صلاحية ميزة معينة
  hasFeature(featureName) {
    const license = this.getCurrentLicense();
    if (!license.valid) {
      return false;
    }

    if (license.features.includes('all')) {
      return true;
    }

    return license.features.includes(featureName);
  }

  // حذف الترخيص
  removeLicense() {
    try {
      if (fs.existsSync(this.licensePath)) {
        fs.unlinkSync(this.licensePath);
        this.licenseData = null;
        console.log('[LICENSE] License removed');
        return true;
      }
      return false;
    } catch (error) {
      console.error('[LICENSE] Remove error:', error.message);
      return false;
    }
  }
}

module.exports = { LicenseManager, LICENSE_TYPES };
