// main.js — Electron (Windows-friendly fullscreen = maximize without covering taskbar)
const { app, BrowserWindow, Menu, protocol, globalShortcut, screen, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const os = require('os');

// ═══════════════════════════════════════════════════════════════════
// 🌐 Network Mode Configuration - إعدادات وضع الشبكة
// ═══════════════════════════════════════════════════════════════════
const NETWORK_MODE = process.env.ELOS_SERVER_MODE === 'network';
// دائماً نستمع على 0.0.0.0 للسماح بالاتصال من أجهزة أخرى على الشبكة
const SERVER_HOST = '0.0.0.0';
const SERVER_PORT = parseInt(process.env.ELOS_SERVER_PORT) || 48572;

// الحصول على عناوين IP المحلية
function getLocalIPAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ name, address: iface.address });
      }
    }
  }
  return addresses;
}

// ═══════════════════════════════════════════════════════════════════
// 🔒 Single Instance Lock - منع تشغيل أكثر من نسخة
// ═══════════════════════════════════════════════════════════════════
const gotTheLock = app.requestSingleInstanceLock();

// نافذة تنبيه موحدة بتصميم البرنامج (تُستخدم عند المحاولة فتح نسخة ثانية أو عند Port مستخدم)
function showElosAlreadyRunningDialog(options = {}) {
  const title = options.title || 'البرنامج مفتوح بالفعل';
  const body = options.body || 'البرنامج يعمل بالفعل على هذا الجهاز.\n\nإذا لم تجد نافذة البرنامج:\n• تحقق من شريط المهام\n• أو أغلق البرنامج من Task Manager\n• أو أعد تشغيل الكمبيوتر';

  app.whenReady().then(() => {
    const errWin = new BrowserWindow({
      width: 460,
      height: 380,
      resizable: false,
      frame: true,
      title: title,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload-dialog.js')
      }
    });
    errWin.setMenuBarVisibility(false);
    const theme = require('electron').nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    errWin.loadFile(path.join(__dirname, 'renderer', 'already-running.html'), {
      query: { theme, title, body }
    });
    errWin.on('closed', () => {
      if (options.onClose) options.onClose();
    });
  });
}

// معالج إغلاق نافذة التنبيه (زر موافق أو إغلاق)
ipcMain.on('already-running-dialog-closed', () => {
  app.quit();
});

// flag لمنع تشغيل باقي البرنامج لو فيه نسخة تانية شغالة
let isSecondInstance = false;

if (!gotTheLock) {
  console.log('[MAIN] ⚠️ Another instance is already running. Quitting...');
  isSecondInstance = true;
  showElosAlreadyRunningDialog({
    title: 'البرنامج مفتوح بالفعل',
    body: '⚠️ البرنامج يعمل بالفعل!\n\nلا يمكن فتح أكثر من نسخة من البرنامج في نفس الوقت.\n\nإذا لم تجد نافذة البرنامج:\n• تحقق من شريط المهام\n• أو أغلق البرنامج من Task Manager\n• أو أعد تشغيل الكمبيوتر',
    onClose: () => app.quit()
  });
} else {
  console.log('[MAIN] ✅ Single instance lock acquired');
}

// تحميل الإعدادات أولاً
const config = require('./config');

const { initDb } = require('./db');
const { LicenseManager } = require('./license');

// ═══════════════════════════════════════════════════════════════════
// 🔗 CLIENT MODE SUPPORT - دعم وضع العميل
// ═══════════════════════════════════════════════════════════════════
let clientModeConfig = null;

/**
 * قراءة إعدادات وضع العميل من ملف محلي
 */
function loadClientModeConfig() {
  try {
    const configPath = path.join(app.getPath('userData'), 'client-config.json');
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      clientModeConfig = JSON.parse(data);
      console.log('[CLIENT] ✅ Client mode config loaded:', clientModeConfig.serverIP);
      return clientModeConfig;
    }
  } catch (e) {
    console.warn('[CLIENT] Could not load client config:', e.message);
  }
  return null;
}

/**
 * حفظ إعدادات وضع العميل
 */
function saveClientModeConfig(config) {
  try {
    const configPath = path.join(app.getPath('userData'), 'client-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    clientModeConfig = config;
    console.log('[CLIENT] ✅ Client mode config saved');
    return true;
  } catch (e) {
    console.error('[CLIENT] Failed to save client config:', e.message);
    return false;
  }
}

/**
 * التحقق مما إذا كان التطبيق في وضع العميل
 */
function isClientMode() {
  if (!clientModeConfig) {
    loadClientModeConfig();
  }
  return clientModeConfig && clientModeConfig.mode === 'client' && clientModeConfig.serverIP;
}

/**
 * تسجيل الدخول عبر السيرفر البعيد
 */
async function remoteLogin(username, password) {
  if (!clientModeConfig || !clientModeConfig.serverIP) {
    throw new Error('Client mode not configured');
  }

  const serverIP = clientModeConfig.serverIP;
  const serverPort = clientModeConfig.serverPort || 48572;
  const url = `http://${serverIP}:${serverPort}/auth/login`;

  console.log(`[CLIENT] 🔗 Attempting remote login to ${serverIP}:${serverPort}`);

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ username, password });

    const req = http.request({
      hostname: serverIP,
      port: serverPort,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.success && response.sessionId) {
            console.log('[CLIENT] ✅ Remote login successful');
            resolve(response);
          } else {
            console.log('[CLIENT] ❌ Remote login failed:', response.error);
            reject(new Error(response.error || 'فشل تسجيل الدخول'));
          }
        } catch (e) {
          reject(new Error('استجابة غير صالحة من السيرفر'));
        }
      });
    });

    req.on('error', (e) => {
      console.error('[CLIENT] ❌ Remote login error:', e.message);
      reject(new Error('فشل الاتصال بالسيرفر: ' + e.message));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('انتهت مهلة الاتصال بالسيرفر'));
    });

    req.write(postData);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════════
// Safe Console - Prevent EPIPE errors on startup
// ═══════════════════════════════════════════════════════════════════
const safeLog = (...args) => {
  try {
    if (process.stdout && process.stdout.writable) {
      console.log(...args);
    }
  } catch (e) { /* Ignore EPIPE */ }
};

const safeError = (...args) => {
  try {
    if (process.stderr && process.stderr.writable) {
      console.error(...args);
    }
  } catch (e) { /* Ignore EPIPE */ }
};

// Prevent EPIPE crashes globally
process.stdout?.on?.('error', (err) => {
  if (err.code === 'EPIPE') return;
  throw err;
});
process.stderr?.on?.('error', (err) => {
  if (err.code === 'EPIPE') return;
  throw err;
});

let virtualServer = null;
let db;
let activeSessions;
let licenseManager;
let licenseWindow;
let dbReady = false; // ✅ Flag to track DB readiness

// ═══════════════════════════════════════════════════════════════════
// 📁 Safe Data Path - حفظ البيانات على partition غير الويندوز
// ═══════════════════════════════════════════════════════════════════
function getSafeDataPath() {
  // الحصول على drive الويندوز (عادة C:)
  const systemDrive = (process.env.SystemDrive || 'C:').charAt(0).toUpperCase();

  // البحث عن كل الـ drives المتاحة (من D إلى Z)
  const allDrives = 'DEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  for (const drive of allDrives) {
    // تخطي drive الويندوز
    if (drive === systemDrive) continue;

    const drivePath = `${drive}:\\`;
    const dataPath = `${drive}:\\ELOS_Data`;

    try {
      // تحقق إذا الـ drive موجود
      if (fs.existsSync(drivePath)) {
        // أنشئ المجلد لو مش موجود
        if (!fs.existsSync(dataPath)) {
          fs.mkdirSync(dataPath, { recursive: true });
        }
        // اختبر الكتابة
        const testFile = path.join(dataPath, '.write_test');
        fs.writeFileSync(testFile, 'test', 'utf8');
        fs.unlinkSync(testFile);

        safeLog(`[DATA] ✅ Safe path: ${dataPath} (not on system drive ${systemDrive}:)`);
        return dataPath;
      }
    } catch (e) {
      // الـ drive غير قابل للكتابة، جرب التالي
      continue;
    }
  }

  // Fallback: لو مفيش partition تاني، استخدم C:\ELOS_Data (برا AppData على الأقل)
  const fallbackPath = `${systemDrive}:\\ELOS_Data`;
  try {
    if (!fs.existsSync(fallbackPath)) {
      fs.mkdirSync(fallbackPath, { recursive: true });
    }
    safeLog(`[DATA] ⚠️ No extra partition found, using: ${fallbackPath}`);
    return fallbackPath;
  } catch (e) {
    // آخر حل: AppData
    const appDataPath = app.getPath('userData');
    safeLog(`[DATA] ⚠️ Fallback to AppData: ${appDataPath}`);
    return appDataPath;
  }
}

// سيتم تعيينه بعد تحميل التطبيق
let SAFE_DATA_PATH = null;

// نقل البيانات القديمة للمسار الجديد (مرة واحدة)
function migrateDataIfNeeded(oldPath, newPath) {
  if (oldPath === newPath) return; // نفس المسار، لا حاجة للنقل

  const filesToMigrate = ['elos.db', 'license.enc', 'machine.id'];

  for (const file of filesToMigrate) {
    const oldFile = path.join(oldPath, file);
    const newFile = path.join(newPath, file);

    try {
      // لو الملف موجود في المسار القديم ومش موجود في الجديد
      if (fs.existsSync(oldFile) && !fs.existsSync(newFile)) {
        fs.copyFileSync(oldFile, newFile);
        safeLog(`[MIGRATE] ✅ Migrated ${file} to safe location`);
      }
    } catch (e) {
      safeError(`[MIGRATE] ❌ Failed to migrate ${file}:`, e.message);
    }
  }
}

const sessionPath = path.join(app.getPath('userData'), 'session.enc');

// مفتاح التشفير - يُستخدم scrypt لتوليد مفتاح أكثر أماناً
// المفتاح يُقرأ من config.js الذي يحمّل من .env
const ENCRYPTION_KEY = crypto.scryptSync(
  config.secrets.session,
  app.getPath('userData'), // استخدام مسار المستخدم كـ salt
  32 // طول المفتاح 256-bit
);

// ✅ Rate Limiting - منع Brute Force من جهة السيرفر
const loginAttempts = new Map(); // username -> [timestamps]
const MAX_ATTEMPTS = config.security.maxLoginAttempts;
const LOCKOUT_TIME = config.security.lockoutDuration;

function checkRateLimit(username) {
  const now = Date.now();
  const attempts = loginAttempts.get(username) || [];
  
  // مسح المحاولات القديمة (أكبر من 15 دقيقة)
  const recent = attempts.filter(t => now - t < LOCKOUT_TIME);
  
  if (recent.length >= MAX_ATTEMPTS) {
    const waitTime = LOCKOUT_TIME - (now - recent[0]);
    if (waitTime > 0) {
      return { 
        allowed: false, 
        waitTime: waitTime,
        message: `محاولات دخول كثيرة. يرجى الانتظار ${Math.ceil(waitTime / 60000)} دقيقة`
      };
    }
  }
  
  recent.push(now);
  loginAttempts.set(username, recent);
  return { allowed: true };
}

function clearRateLimit(username) {
  loginAttempts.delete(username);
}

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function getSession() {
  try {
    if (fs.existsSync(sessionPath)) {
      const encryptedData = fs.readFileSync(sessionPath, 'utf8');
      const decryptedData = decrypt(encryptedData);
      return JSON.parse(decryptedData);
    }
  } catch (e) {
    console.log('[Session] Error reading session:', e.message);
    clearSession();
  }
  return null;
}

function saveSession(userData) {
  try {
    const encryptedData = encrypt(JSON.stringify(userData));
    fs.writeFileSync(sessionPath, encryptedData, 'utf8');
    console.log('[Session] Session saved (encrypted)');
  } catch (e) {
    console.log('[Session] Error saving session:', e.message);
  }
}

function clearSession() {
  try {
    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath);
      console.log('[Session] Session cleared');
    }
  } catch (e) {
    console.log('[Session] Error clearing session:', e.message);
  }
}

protocol.registerSchemesAsPrivileged([{
  scheme: 'elos-db',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    bypassCSP: true
  }
}]);

let mainWindow;
let splashWindow;
let loginWindow;
let setupWindow;

// ═══════════════════════════════════════════════════════════════════
// 🔒 Second Instance Handler - عند محاولة تشغيل نسخة ثانية
// ═══════════════════════════════════════════════════════════════════
app.on('second-instance', (event, commandLine, workingDirectory) => {
  console.log('[MAIN] 🔔 Second instance attempted, focusing existing window...');

  // إظهار النافذة الموجودة
  const windowToFocus = mainWindow || loginWindow || licenseWindow || setupWindow;

  if (windowToFocus) {
    // إذا كانت مصغرة، أعدها للحجم الطبيعي
    if (windowToFocus.isMinimized()) {
      windowToFocus.restore();
    }
    // أظهرها وركز عليها
    windowToFocus.show();
    windowToFocus.focus();
  }

  // لا نعرض رسالة هنا - النسخة التانية بتعرض رسالتها الخاصة already-running
  // والنسخة الأولى بس بتعمل focus على النافذة المفتوحة
  console.log('[MAIN] ✅ Focused existing window instead of showing duplicate dialog');
});

// ✨ فحص وعرض Setup بعد Login
async function checkAndShowSetup(userData) {
  try {
    // ═══════════════════════════════════════════════════════════════════
    // 🔗 CLIENT MODE - تخطي الإعداد الأولي (الإعدادات على السيرفر)
    // ═══════════════════════════════════════════════════════════════════
    if (isClientMode()) {
      console.log('[MAIN] 🔗 Client mode - skipping local setup, using remote server settings');
      showMainWindow(userData);
      return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // 🖥️ LOCAL/SERVER MODE - فحص الإعداد الأولي
    // ═══════════════════════════════════════════════════════════════════
    const response = await fetch('http://127.0.0.1:48572/settings/check-setup');
    if (!response.ok) {
      console.log('[MAIN] Could not check setup status, showing main window');
      showMainWindow(userData);
      return;
    }

    const data = await response.json();

    if (!data.setupCompleted) {
      console.log('[MAIN] 🎯 First setup required after login...');

      // فتح setup window بحجم مناسب
      const setupPath = path.join(__dirname, 'renderer', 'first-setup.html');

      if (fs.existsSync(setupPath)) {
        setupWindow = new BrowserWindow({
          width: 1280,
          height: 800,
          resizable: true,
          frame: true,
          center: true,
          backgroundColor: '#0a0e14',
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, 'preload.js'),
            partition: 'persist:login'
          },
        });

        setupWindow.loadFile(setupPath);

        // تكبير النافذة لملء الشاشة
        setupWindow.maximize();

        setupWindow.once('ready-to-show', () => {
          setupWindow.show();
          setupWindow.focus();
        });

        if (!app.isPackaged) setupWindow.webContents.openDevTools({ mode: 'detach' });

        // عند إغلاق setup window → فتح main window
        setupWindow.on('closed', () => {
          setupWindow = null;
          console.log('[MAIN] ✅ Setup completed, showing main window');
          showMainWindow(userData);
        });

      } else {
        console.log('[MAIN] ⚠️ first-setup.html not found, showing main window');
        showMainWindow(userData);
      }
    } else {
      console.log('[MAIN] ✅ Setup already completed, showing main window');
      showMainWindow(userData);
    }
  } catch (error) {
    console.log('[MAIN] ⚠️ Error checking setup:', error.message);
    showMainWindow(userData);
  }
}

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 560,
    height: 720,
    resizable: false,
    maximizable: false,
    frame: false,
    center: true,
    transparent: false,
    backgroundColor: '#0a0e14',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
      partition: 'persist:login'
    },
  });

  const loginPath = path.join(__dirname, 'renderer', 'login.html');
  loginWindow.loadFile(loginPath);

  loginWindow.once('ready-to-show', () => {
    loginWindow.show();
    loginWindow.focus();
  });

  if (!app.isPackaged) loginWindow.webContents.openDevTools({ mode: 'detach' });

  loginWindow.webContents.on('console-message', async (event, level, message) => {
    if (message.includes('login-attempt:')) {
      const match = message.match(/login-attempt:(.+)/);
      if (match) {
        try {
          const { username, password } = JSON.parse(match[1]);

          // ✅ فحص Rate Limiting أولاً
          const rateLimitCheck = checkRateLimit(username);
          if (!rateLimitCheck.allowed) {
            loginWindow.webContents.executeJavaScript(`
              window.dispatchEvent(new MessageEvent('message', {
                data: { type: 'login-error', error: '${rateLimitCheck.message}' }
              }));
            `);
            return;
          }

          // ✅ انتظار جاهزية قاعدة البيانات (أقصى 5 ثواني)
          if (!dbReady || !db) {
            console.log('[Login] ⏳ Waiting for database...');
            let waited = 0;
            while ((!dbReady || !db) && waited < 5000) {
              await new Promise(resolve => setTimeout(resolve, 100));
              waited += 100;
            }
          }

          if (!db) {
            console.error('[Login] DB not initialized after waiting');
            loginWindow.webContents.executeJavaScript(`
              window.dispatchEvent(new MessageEvent('message', {
                data: { type: 'login-error', error: 'جاري تحميل النظام، حاول مرة أخرى' }
              }));
            `);
            return;
          }
          
          const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
          
          if (!user) {
            loginWindow.webContents.executeJavaScript(`
              window.dispatchEvent(new MessageEvent('message', {
                data: { type: 'login-error', error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }
              }));
            `);
            return;
          }
          
          if (!user.is_active) {
            loginWindow.webContents.executeJavaScript(`
              window.dispatchEvent(new MessageEvent('message', {
                data: { type: 'login-error', error: 'الحساب غير نشط' }
              }));
            `);
            return;
          }
          
          if (!user.password_hash) {
            console.error('[Login] password_hash is missing for user:', username);
            loginWindow.webContents.executeJavaScript(`
              window.dispatchEvent(new MessageEvent('message', {
                data: { type: 'login-error', error: 'خطأ في بيانات المستخدم' }
              }));
            `);
            return;
          }
          
          let isMatch = false;
          const stored = user.password_hash || '';

          // PBKDF2
          if (stored.includes(':')) {
            try {
              const [salt, hash] = stored.split(':');
              const verify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
              isMatch = (verify === hash);
            } catch (_) {
              isMatch = false;
            }
          // SHA-256
          } else if (/^[0-9a-f]{64}$/i.test(stored)) {
            try {
              const sha = crypto.createHash('sha256').update(password).digest('hex');
              isMatch = (sha === stored);
            } catch (_) {
              isMatch = false;
            }
          // Plain Text
          } else {
            isMatch = (password === stored);
          }
          
          if (!isMatch) {
            loginWindow.webContents.executeJavaScript(`
              window.dispatchEvent(new MessageEvent('message', {
                data: { type: 'login-error', error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }
              }));
            `);
            return;
          }
          
          // ✅ نجاح - مسح Rate Limit
          clearRateLimit(username);
          
          const sessionId = crypto.randomBytes(32).toString('hex');
          const userData = {
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            role: user.role,
            sessionId: sessionId
          };
          
          activeSessions.set(sessionId, {
            userId: user.id,
            username: user.username,
            role: user.role,
            loginTime: Date.now()
          });
          
          loginWindow.webContents.executeJavaScript(`
            localStorage.setItem('sessionId', '${sessionId}');
            localStorage.setItem('currentUser', '${JSON.stringify(userData).replace(/'/g, "\\'")}');
            window.dispatchEvent(new MessageEvent('message', {
              data: { type: 'login-success' }
            }));
          `);
          
          setTimeout(async () => {
            if (loginWindow && !loginWindow.isDestroyed()) {
              loginWindow.close();
              loginWindow = null;
            }
            
            // ✨ فحص الإعداد الأولي بعد Login
            await checkAndShowSetup(userData);
          }, 500);
          
        } catch (e) {
          console.error('[Login] Error:', e);
          loginWindow.webContents.executeJavaScript(`
            window.dispatchEvent(new MessageEvent('message', {
              data: { type: 'login-error', error: 'حدث خطأ في تسجيل الدخول' }
            }));
          `);
        }
      }
    }
    
    // تبديل الوظائف: الأحمر للتصغير، الأصفر للإغلاق
    if (message === 'window-close') {
      app.quit();
    }
    
    if (message === 'window-minimize') {
      loginWindow.minimize();
    }
  });

  loginWindow.webContents.on('did-finish-load', () => {
    loginWindow.webContents.executeJavaScript(`
      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'login-success') {
          console.log('login-success');
        }
      });
    `);
  });

  loginWindow.on('closed', () => {
    loginWindow = null;
  });
}

// ✨ نافذة التفعيل (الترخيص)
function createLicenseWindow() {
  licenseWindow = new BrowserWindow({
    width: 550,
    height: 700,
    resizable: false,
    frame: false,
    center: true,
    transparent: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
      partition: 'persist:login'
    },
  });

  const licensePath = path.join(__dirname, 'renderer', 'license.html');
  licenseWindow.loadFile(licensePath);

  // ═══════════════════════════════════════════════════════════════════
  // 🔒 Prevent new windows from opening (handle external links via shell.openExternal)
  // ═══════════════════════════════════════════════════════════════════
  licenseWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open external URLs using shell.openExternal instead of creating new window
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      shell.openExternal(url).catch(err => {
        console.error('[LICENSE] Failed to open external URL:', err);
      });
    }
    // Deny creating new Electron windows
    return { action: 'deny' };
  });

  licenseWindow.once('ready-to-show', () => {
    licenseWindow.show();
    licenseWindow.focus();
  });

  if (!app.isPackaged) licenseWindow.webContents.openDevTools({ mode: 'detach' });

  licenseWindow.webContents.on('console-message', async (event, level, message) => {
    if (message === 'license-activated') {
      console.log('[LICENSE] ✅ License activated');
      setTimeout(async () => {
        if (licenseWindow && !licenseWindow.isDestroyed()) {
          licenseWindow.close();
          licenseWindow = null;
        }

        // ✅ فحص الإعداد الأولي بعد التفعيل - إذا لم يكتمل، افتح شاشة الإعداد
        try {
          const response = await fetch('http://127.0.0.1:48572/settings/check-setup');
          const data = await response.json();

          if (!data.setupCompleted) {
            console.log('[LICENSE] 🎯 First setup required after activation...');
            // فتح شاشة الإعداد الأولي
            setupWindow = new BrowserWindow({
              width: 1280,
              height: 800,
              resizable: true,
              frame: true,
              center: true,
              backgroundColor: '#0a0e14',
              webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                preload: path.join(__dirname, 'preload.js'),
                partition: 'persist:login'
              },
            });

            const setupPath = path.join(__dirname, 'renderer', 'first-setup.html');
            setupWindow.loadFile(setupPath);
            setupWindow.maximize();

            setupWindow.once('ready-to-show', () => {
              setupWindow.show();
              setupWindow.focus();
            });

            if (!app.isPackaged) setupWindow.webContents.openDevTools({ mode: 'detach' });

            // عند إغلاق setup window → فتح login window
            setupWindow.on('closed', () => {
              setupWindow = null;
              console.log('[LICENSE] ✅ Setup completed after activation, showing login window');
              createLoginWindow();
            });
          } else {
            console.log('[LICENSE] ✅ Setup already completed, showing login window');
            createLoginWindow();
          }
        } catch (e) {
          console.log('[LICENSE] ⚠️ Error checking setup, showing login window:', e.message);
          createLoginWindow();
        }
      }, 500);
    }

    if (message === 'window-close') {
      app.quit();
    }

    if (message === 'window-minimize') {
      licenseWindow.minimize();
    }

    // ✅ Restart البرنامج بعد التفعيل الأول
    if (message === 'restart-after-activation') {
      console.log('[LICENSE] 🔄 Restarting app after first activation...');
      app.relaunch();
      app.exit(0);
    }
  });

  licenseWindow.on('closed', () => {
    licenseWindow = null;
  });
}

// ✨ فحص الترخيص عند بدء التشغيل
function checkLicenseAndStart() {
  const license = licenseManager.loadLicense();

  if (license.valid) {
    console.log('[LICENSE] ✅ Valid license found:', license.typeName);
    console.log('[LICENSE] 📅 Expires:', license.expiryDate, `(${license.daysRemaining} days remaining)`);
    createLoginWindow();
  } else {
    console.log('[LICENSE] ⚠️ No valid license:', license.error);
    createLicenseWindow();
  }
}

function showMainWindow(userData) {
  const { workArea } = screen.getPrimaryDisplay();
  mainWindow.setBounds(workArea);
  if (!mainWindow.isMaximized()) mainWindow.maximize();
  mainWindow.show();
  mainWindow.focus();

  // ═══════════════════════════════════════════════════════════════════
  // 🔧 Fix: إصلاح مشكلة الـ Rendering بعد التصغير/التكبير
  // ═══════════════════════════════════════════════════════════════════
  const fixZoomOnRestore = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const defaultZoom = mainWindow.customZoomFactor || 1.0;
    // إعادة تطبيق الـ zoom بعد delay صغير للتأكد من اكتمال الـ render
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.setZoomFactor(defaultZoom);
      // Force re-render عبر invalidate
      mainWindow.webContents.invalidate();
      console.log(`[RESTORE] ✅ Zoom fixed to ${(defaultZoom * 100).toFixed(0)}%`);
    }, 100);
  };

  // إزالة أي listeners قديمة لتجنب التكرار
  mainWindow.removeAllListeners('restore');
  mainWindow.removeAllListeners('maximize');
  mainWindow.removeAllListeners('unmaximize');

  // إضافة listeners جديدة
  mainWindow.on('restore', fixZoomOnRestore);
  mainWindow.on('maximize', fixZoomOnRestore);
  mainWindow.on('unmaximize', fixZoomOnRestore);

  // ✅ التحقق من السلة عند محاولة إغلاق البرنامج
  mainWindow.on('close', (e) => {
    if (mainWindow._forceClose) return; // السماح بالإغلاق بعد التأكيد

    try {
      // سؤال الـ renderer عن حالة السلة
      const cartCount = mainWindow.webContents.executeJavaScript(`
        (function() {
          // البحث في window مباشرة
          if (window.cart && window.cart.length > 0) return window.cart.length;
          // البحث في iframe
          var iframe = document.getElementById('page-iframe');
          if (iframe && iframe.contentWindow && iframe.contentWindow.cart && iframe.contentWindow.cart.length > 0) {
            return iframe.contentWindow.cart.length;
          }
          return 0;
        })();
      `);

      // executeJavaScript returns a Promise, we need synchronous check
      // Use dialog to block until we know
      e.preventDefault();

      cartCount.then((count) => {
        if (count > 0) {
          const result = dialog.showMessageBoxSync(mainWindow, {
            type: 'warning',
            title: 'تنبيه - منتجات في السلة',
            message: `يوجد ${count} منتج في سلة المشتريات!`,
            detail: 'هل تريد إغلاق البرنامج؟ سيتم فقدان المنتجات الموجودة في السلة.',
            buttons: ['إلغاء - الرجوع للبرنامج', 'إغلاق البرنامج'],
            defaultId: 0,
            cancelId: 0,
            noLink: true
          });

          if (result === 1) {
            mainWindow._forceClose = true;
            mainWindow.close();
          }
        } else {
          mainWindow._forceClose = true;
          mainWindow.close();
        }
      }).catch(() => {
        mainWindow._forceClose = true;
        mainWindow.close();
      });
    } catch (err) {
      // لو حصل أي خطأ، اسمح بالإغلاق
      console.error('[MAIN] Error checking cart on close:', err);
    }
  });

  // ✅ SPA Mode: تحميل app.html مع تحديد الصفحة الافتراضية حسب الدور
  let defaultRoute = 'home';
  if (userData && userData.role) {
    switch (userData.role) {
      case 'cashier':
        defaultRoute = 'pos';
        break;
      case 'viewer':
        defaultRoute = 'inventory';
        break;
      default:
        defaultRoute = 'home';
    }
  }

  // تحميل الـ SPA الجديد
  const appPath = path.join(__dirname, 'renderer', 'app.html');
  mainWindow.loadFile(appPath, { hash: defaultRoute });

  mainWindow.webContents.on('did-finish-load', () => {
    if (userData) {
      // ✅ CRITICAL: نقل sessionId و userData للـ main window
      mainWindow.webContents.executeJavaScript(`
        localStorage.setItem('sessionId', '${userData.sessionId}');
        localStorage.setItem('currentUser', '${JSON.stringify(userData).replace(/'/g, "\\'")}');
        window.currentUser = ${JSON.stringify(userData)};
        console.log('[MAIN] ✅ Session & User data injected:', window.currentUser.username);
      `);
    }
  });
  
  mainWindow.webContents.on('console-message', (event, level, message) => {
    if (message === 'logout-request') {
      clearSession();
      mainWindow.hide();
      createLoginWindow();
    }
  });
  
  if (!app.isPackaged) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 500,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    center: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const splashContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          background: transparent;
          overflow: hidden;
        }
        .splash-container {
          background: #0f172a;
          width: 380px;
          height: 380px;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          animation: scaleIn 0.4s ease-out;
          border: 3px solid #1e293b;
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.7); }
          to { opacity: 1; transform: scale(1); }
        }
        .logo-section {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .chart-icon svg {
          width: 48px;
          height: 48px;
        }
        .logo-text {
          font-size: 58px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: 1px;
        }
        .subtitle {
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
          letter-spacing: 4px;
          text-transform: uppercase;
          text-align: center;
          line-height: 1.8;
        }
        .loader {
          width: 120px;
          height: 3px;
          background: #1e293b;
          border-radius: 3px;
          margin-top: 20px;
          overflow: hidden;
        }
        .loader-bar {
          width: 0%;
          height: 100%;
          background: #3b82f6;
          border-radius: 3px;
          animation: loading 0.8s ease-out forwards;
        }
        @keyframes loading {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      </style>
    </head>
    <body>
      <div class="splash-container">
        <div class="logo-section">
          <div class="chart-icon">
            <svg viewBox="0 0 48 48" fill="none">
              <rect x="4" y="28" width="8" height="16" rx="2" fill="#3b82f6"/>
              <rect x="16" y="18" width="8" height="26" rx="2" fill="#3b82f6"/>
              <rect x="28" y="8" width="8" height="36" rx="2" fill="#3b82f6"/>
              <path d="M8 20L20 12L32 6L44 2" stroke="#3b82f6" stroke-width="3" stroke-linecap="round"/>
              <path d="M38 2H44V8" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="logo-text">ElOs</div>
        </div>
        <div class="subtitle">ACCOUNTING SYSTEM<br><span style="font-size:13px;color:#3b82f6;letter-spacing:3px;font-weight:700;">V2</span></div>
        <div class="loader">
          <div class="loader-bar" style="animation-duration: 1.8s;"></div>
        </div>
      </div>
    </body>
    </html>
  `;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashContent)}`);
  
  return splashWindow;
}

async function createWindow() {
  createSplashWindow();

  // ✅ حساب حجم الشاشة وضبط الـ zoom تلقائياً
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // حساب نسبة الـ zoom بناءً على عرض الشاشة
  // الأساس هو شاشة 1920 عرض = 100% zoom
  const baseWidth = 1920;
  let zoomFactor = screenWidth / baseWidth;

  // تحديد نطاق الـ zoom المسموح (من 70% إلى 100%)
  zoomFactor = Math.max(0.7, Math.min(1.0, zoomFactor));

  console.log(`[DISPLAY] Screen: ${screenWidth}x${screenHeight}, Zoom Factor: ${(zoomFactor * 100).toFixed(0)}%`);

  mainWindow = new BrowserWindow({
    width: Math.min(1280, screenWidth - 50),
    height: Math.min(800, screenHeight - 50),
    show: false,
    fullscreen: false,
    fullscreenable: true,
    autoHideMenuBar: true,
    frame: false, // ✅ Custom title bar
    titleBarStyle: 'hidden',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
      partition: 'persist:login',
      zoomFactor: zoomFactor // ✅ تطبيق الـ zoom التلقائي
    },
  });

  // ✅ حفظ zoom factor للاستخدام لاحقاً
  mainWindow.customZoomFactor = zoomFactor;

  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      let opacity = 1;
      const fadeInterval = setInterval(() => {
        opacity -= 0.1;
        if (opacity <= 0) {
          clearInterval(fadeInterval);
          splashWindow.close();
          splashWindow = null;

          // ✨ فحص الترخيص أولاً قبل عرض شاشة تسجيل الدخول
          checkLicenseAndStart();
        } else {
          splashWindow.setOpacity(opacity);
        }
      }, 30);
    } else {
      checkLicenseAndStart();
    }

    globalShortcut.register('F11', () => {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    });

  }, 2000);

  const menu = Menu.buildFromTemplate([
    { label: 'File', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'quit' }] },
    { label: 'View', submenu: [
      {
        label: 'Toggle Maximize',
        accelerator: 'F11',
        click: () => {
          if (mainWindow.isMaximized()) mainWindow.unmaximize();
          else mainWindow.maximize();
        }
      },
      { type: 'separator' },
      {
        label: 'تكبير (Zoom In)',
        accelerator: 'CmdOrCtrl+Plus',
        click: () => adjustZoom(0.1)
      },
      {
        label: 'تصغير (Zoom Out)',
        accelerator: 'CmdOrCtrl+-',
        click: () => adjustZoom(-0.1)
      },
      {
        label: 'إعادة الحجم الافتراضي',
        accelerator: 'CmdOrCtrl+0',
        click: () => resetZoom()
      }
    ] },
  ]);
  Menu.setApplicationMenu(menu);

  // ✅ تسجيل اختصارات الـ Zoom
  globalShortcut.register('CmdOrCtrl+=', () => adjustZoom(0.1));
  globalShortcut.register('CmdOrCtrl+-', () => adjustZoom(-0.1));
  globalShortcut.register('CmdOrCtrl+0', () => resetZoom());
}

// ✅ دالة تعديل الـ Zoom
function adjustZoom(delta) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  mainWindow.webContents.getZoomFactor().then(currentZoom => {
    let newZoom = currentZoom + delta;
    // تحديد نطاق الـ zoom (50% - 150%)
    newZoom = Math.max(0.5, Math.min(1.5, newZoom));
    mainWindow.webContents.setZoomFactor(newZoom);
    console.log(`[ZOOM] Changed to ${(newZoom * 100).toFixed(0)}%`);
  });
}

// ✅ دالة إعادة الـ Zoom للقيمة الافتراضية
function resetZoom() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const defaultZoom = mainWindow.customZoomFactor || 1.0;
  mainWindow.webContents.setZoomFactor(defaultZoom);
  console.log(`[ZOOM] Reset to default: ${(defaultZoom * 100).toFixed(0)}%`);
}

function createVirtualServer(dbInstance) {
  virtualServer = http.createServer(async (req, res) => {
    safeLog('[VIRTUAL-SERVER] ⚡', req.method, req.url);
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      });
      res.end();
      return;
    }
    
    try {
      let bodyData = '';
      for await (const chunk of req) {
        bodyData += chunk.toString();
      }
      
      const request = {
        url: 'elos-db:/' + req.url,
        method: req.method,
        headers: {
          get: (key) => req.headers[key.toLowerCase()]
        },
        text: async () => bodyData || '{}',
        json: async () => {
          try {
            return JSON.parse(bodyData || '{}');
          } catch (e) {
            return {};
          }
        }
      };
      
      const response = await dbInstance.handleProtocolRequest(request);
      
      let result;
      let statusCode = 200;
      
      if (response instanceof Response) {
        statusCode = response.status;
        result = await response.text();
        res.writeHead(statusCode, {
          'Content-Type': response.headers.get('content-type') || 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        });
      } else {
        result = JSON.stringify(response);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        });
      }
      
      res.end(result);
      safeLog('[VIRTUAL-SERVER] ✅ Response sent, status:', statusCode);
      
    } catch (error) {
      safeError('[VIRTUAL-SERVER] ❌ Error:', error.message);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
  
  // معالجة خطأ الـ Port مستخدم
  virtualServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[VIRTUAL-SERVER] ❌ Port ${SERVER_PORT} is already in use!`);
      // لو ده نسخة تانية، الرسالة اتعرضت خلاص من single-instance lock
      if (isSecondInstance) {
        app.quit();
        return;
      }
      showElosAlreadyRunningDialog({
        title: 'البرنامج مفتوح بالفعل',
        body: `⚠️ لا يمكن تشغيل البرنامج!\n\nالبرنامج يعمل بالفعل على هذا الجهاز (Port ${SERVER_PORT}).\n\nإذا لم تجد نافذة البرنامج:\n• تحقق من شريط المهام\n• أو أغلق البرنامج من Task Manager\n• أو أعد تشغيل الكمبيوتر`,
        onClose: () => app.quit()
      });
    } else {
      console.error('[VIRTUAL-SERVER] ❌ Server error:', err);
    }
  });

  virtualServer.listen(SERVER_PORT, SERVER_HOST, () => {
    safeLog(`[VIRTUAL-SERVER] ✅ Listening on http://${SERVER_HOST}:${SERVER_PORT}`);
    safeLog('[VIRTUAL-SERVER] All elos-db:// requests will be handled here');

    // إذا كان وضع الشبكة مفعل، اعرض عناوين IP
    if (NETWORK_MODE) {
      safeLog('[VIRTUAL-SERVER] 🌐 Network mode ENABLED - Accepting remote connections');
      const localIPs = getLocalIPAddresses();
      localIPs.forEach(ip => {
        safeLog(`[VIRTUAL-SERVER]   → http://${ip.address}:${SERVER_PORT} (${ip.name})`);
      });
    }
  });

  return virtualServer;
}

// ═══════════════════════════════════════════════════════════════════
// 🚪 IPC Handlers - معالجات الاتصال الآمن
// ═══════════════════════════════════════════════════════════════════
ipcMain.on('app-quit', () => {
  console.log('[MAIN] 🚪 Logout requested, quitting app...');
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow._forceClose = true;
  app.quit();
});

// معالج تصغير النافذة
ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

// معالج تكبير/تصغير النافذة
ipcMain.on('window-maximize-toggle', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

// معالج إغلاق النافذة - يمر عبر mainWindow.on('close') للتحقق من السلة
ipcMain.on('window-close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close(); // سيتم التحقق من السلة في mainWindow.on('close')
  } else {
    app.quit();
  }
});

// معالج إعادة تشغيل التطبيق
ipcMain.on('app:restart', () => {
  console.log('[MAIN] 🔄 Restarting app...');
  app.relaunch();
  app.exit(0);
});

// معالج الانتقال إلى صفحة تسجيل الدخول
ipcMain.on('navigate:login', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.close();
  }
  // After restart, checkLicenseAndStart will route to login if license is valid
  createLoginWindow();
});

// معالج الطباعة المباشرة بدون فتح Print Dialog
ipcMain.on('print:silent', async (event, options = {}) => {
  try {
    // إذا كان المحتوى HTML مرسلاً، أنشئ نافذة جديدة واطبعها
    if (options.htmlContent) {
      const printWin = new BrowserWindow({
        show: false, // نافذة خفية
        width: 800,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(options.htmlContent)}`);
      
      await new Promise(resolve => setTimeout(resolve, 500)); // انتظار تحميل المحتوى

      const printOptions = {
        silent: true, // ✅ الطباعة المباشرة بدون فتح Print Dialog
        printBackground: true,
        deviceName: options.deviceName || undefined,
        ...options
      };

      console.log('[PRINT] Silent print requested with options:', printOptions);
      
      printWin.webContents.print(printOptions, (success, errorType) => {
        if (success) {
          console.log('[PRINT] ✅ Print job sent successfully');
        } else {
          console.error('[PRINT] ❌ Print failed:', errorType);
          event.sender.send('print:error', { error: errorType });
        }
        // إغلاق النافذة بعد الطباعة
        setTimeout(() => {
          if (!printWin.isDestroyed()) {
            printWin.close();
          }
        }, 500);
      });
    } else {
      // استخدام النافذة الحالية
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || win.isDestroyed()) {
        console.error('[PRINT] Window not found or destroyed');
        return;
      }

      const printOptions = {
        silent: true,
        printBackground: true,
        deviceName: options.deviceName || undefined,
        ...options
      };

      win.webContents.print(printOptions, (success, errorType) => {
        if (success) {
          console.log('[PRINT] ✅ Print job sent successfully');
        } else {
          console.error('[PRINT] ❌ Print failed:', errorType);
          event.sender.send('print:error', { error: errorType });
        }
      });
    }
  } catch (error) {
    console.error('[PRINT] Error in print handler:', error);
    event.sender.send('print:error', { error: error.message });
  }
});

// معالج الحصول على قائمة الطابعات المتاحة
ipcMain.handle('print:get-printers', async () => {
  try {
    const printers = await app.getPrinterInfo();
    return printers;
  } catch (error) {
    console.error('[PRINT] Error getting printers:', error);
    return [];
  }
});

// معالج فتح رابط خارجي بأمان (Electron shell.openExternal)
ipcMain.on('app:open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    console.log('[MAIN] ✅ Opened external URL:', url.substring(0, 50) + '...');
  } catch (error) {
    console.error('[MAIN] ❌ Error opening external URL:', error);
  }
});

// معالج الحصول على نسخة التطبيق (بدون auth)
ipcMain.handle('app:get-version', () => {
  return app.getVersion();
});

// ═══════════════════════════════════════════════════════════════════
// 🔗 CLIENT MODE IPC HANDLERS - معالجات وضع العميل
// ═══════════════════════════════════════════════════════════════════

// حفظ إعدادات العميل
ipcMain.handle('client:save-config', async (event, config) => {
  try {
    const result = saveClientModeConfig(config);
    return { success: result };
  } catch (error) {
    console.error('[CLIENT] Error saving config:', error);
    return { success: false, error: error.message };
  }
});

// قراءة إعدادات العميل
ipcMain.handle('client:get-config', async () => {
  try {
    const config = loadClientModeConfig();
    return { success: true, config };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// التحقق من وضع العميل
ipcMain.handle('client:is-client-mode', async () => {
  return isClientMode();
});

// ═══════════════════════════════════════════════════════════════════
// 📦 BACKUP SAVE DIALOG - اختيار مكان حفظ النسخة الاحتياطية
// ═══════════════════════════════════════════════════════════════════
ipcMain.handle('backup:show-save-dialog', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const timestamp = new Date().toISOString().slice(0, 10);
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: 'اختر مكان حفظ النسخة الاحتياطية',
    defaultPath: `elos_backup_${timestamp}.db`,
    filters: [{ name: 'قاعدة بيانات', extensions: ['db'] }],
    buttonLabel: 'حفظ'
  });
  if (canceled || !filePath) return { canceled: true };
  return { canceled: false, filePath };
});

// ═══════════════════════════════════════════════════════════════════
// 📥 BACKUP RESTORE - استعادة نسخة احتياطية (اختيار ملف ثم إعادة تشغيل)
// ═══════════════════════════════════════════════════════════════════
ipcMain.handle('backup:show-restore-dialog', async (event) => {
  if (isClientMode()) {
    return { success: false, error: 'وضع العميل: الاستعادة تتم على الجهاز الرئيسي فقط.' };
  }
  const win = BrowserWindow.fromWebContents(event.sender);
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: 'اختر ملف النسخة الاحتياطية (ملف .db)',
    filters: [{ name: 'قاعدة بيانات', extensions: ['db'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths || filePaths.length === 0) {
    return { success: false, canceled: true };
  }
  const sourcePath = filePaths[0];
  if (!fs.existsSync(sourcePath)) {
    return { success: false, error: 'الملف غير موجود.' };
  }
  const dataPath = getSafeDataPath();
  const restoredMarker = path.join(dataPath, 'elos.db.restored');
  try {
    fs.copyFileSync(sourcePath, restoredMarker);
  } catch (e) {
    return { success: false, error: e.message || 'فشل نسخ الملف.' };
  }
  // لا نعرض نافذة نظام قديمة - الواجهة تعرض رسالة بتصميم البرنامج قبل استدعاء الاستعادة
  app.relaunch();
  app.quit();
  return { success: true };
});

// ═══════════════════════════════════════════════════════════════════
// 🔐 Secure Auth IPC Handler - معالجة تسجيل الدخول بأمان
// ═══════════════════════════════════════════════════════════════════
ipcMain.on('auth:login-attempt', async (event, credentials) => {
  const { username, password } = credentials;
  const sender = event.sender;

  try {
    // ═══════════════════════════════════════════════════════════════════
    // 🔗 CLIENT MODE - تسجيل الدخول عبر السيرفر البعيد
    // ═══════════════════════════════════════════════════════════════════
    if (isClientMode()) {
      console.log('[Auth] 🔗 Client mode detected - forwarding login to remote server');
      try {
        const remoteResponse = await remoteLogin(username, password);

        // حفظ الـ session محلياً
        activeSessions.set(remoteResponse.sessionId, {
          userId: remoteResponse.user?.id,
          username: remoteResponse.user?.username || username,
          role: remoteResponse.user?.role,
          loginTime: Date.now(),
          isRemote: true  // علامة أن هذه جلسة من السيرفر البعيد
        });

        // ✅ CRITICAL: إنشاء userData مع sessionId
        const userData = {
          ...remoteResponse.user,
          sessionId: remoteResponse.sessionId
        };

        // إرسال بيانات النجاح
        sender.send('auth:login-success', {
          sessionId: remoteResponse.sessionId,
          user: remoteResponse.user
        });

        console.log('[Auth] ✅ Remote login successful for:', username);

        // فتح النافذة الرئيسية (نفس الطريقة المستخدمة في تسجيل الدخول المحلي)
        setTimeout(async () => {
          if (loginWindow && !loginWindow.isDestroyed()) {
            loginWindow.close();
            loginWindow = null;
          }
          // ✅ استخدام userData مع sessionId
          await checkAndShowSetup(userData);
        }, 500);

        return;
      } catch (remoteError) {
        console.error('[Auth] ❌ Remote login failed:', remoteError.message);
        sender.send('auth:login-error', { error: remoteError.message });
        return;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 🖥️ LOCAL/SERVER MODE - تسجيل الدخول المحلي
    // ═══════════════════════════════════════════════════════════════════

    // ✅ فحص Rate Limiting أولاً
    const rateLimitCheck = checkRateLimit(username);
    if (!rateLimitCheck.allowed) {
      sender.send('auth:login-error', { error: rateLimitCheck.message });
      return;
    }

    // ✅ انتظار جاهزية قاعدة البيانات
    if (!dbReady || !db) {
      console.log('[Auth] ⏳ Waiting for database...');
      let waited = 0;
      while ((!dbReady || !db) && waited < 5000) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waited += 100;
      }
    }

    if (!db) {
      console.error('[Auth] DB not initialized after waiting');
      sender.send('auth:login-error', { error: 'جاري تحميل النظام، حاول مرة أخرى' });
      return;
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);

    if (!user) {
      sender.send('auth:login-error', { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
      return;
    }

    if (!user.is_active) {
      sender.send('auth:login-error', { error: 'الحساب غير نشط' });
      return;
    }

    if (!user.password_hash) {
      console.error('[Auth] password_hash is missing for user:', username);
      sender.send('auth:login-error', { error: 'خطأ في بيانات المستخدم' });
      return;
    }

    // التحقق من كلمة المرور
    let isMatch = false;
    const stored = user.password_hash || '';

    // PBKDF2
    if (stored.includes(':')) {
      try {
        const [salt, hash] = stored.split(':');
        const verify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
        isMatch = (verify === hash);
      } catch (_) {
        isMatch = false;
      }
    // SHA-256
    } else if (/^[0-9a-f]{64}$/i.test(stored)) {
      try {
        const sha = crypto.createHash('sha256').update(password).digest('hex');
        isMatch = (sha === stored);
      } catch (_) {
        isMatch = false;
      }
    // Plain Text (للتوافق مع البيانات القديمة)
    } else {
      isMatch = (password === stored);
    }

    if (!isMatch) {
      sender.send('auth:login-error', { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
      return;
    }

    // ✅ نجاح - مسح Rate Limit وإنشاء Session
    clearRateLimit(username);

    const sessionId = crypto.randomBytes(32).toString('hex');
    const userData = {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      sessionId: sessionId
    };

    activeSessions.set(sessionId, {
      userId: user.id,
      username: user.username,
      role: user.role,
      loginTime: Date.now()
    });

    // إرسال بيانات النجاح عبر IPC (آمن - لا يوجد template injection)
    sender.send('auth:login-success', {
      sessionId: sessionId,
      user: userData
    });

    console.log('[Auth] ✅ Login successful for:', username);

    // إغلاق نافذة تسجيل الدخول وفتح النافذة الرئيسية
    setTimeout(async () => {
      if (loginWindow && !loginWindow.isDestroyed()) {
        loginWindow.close();
        loginWindow = null;
      }
      await checkAndShowSetup(userData);
    }, 500);

  } catch (e) {
    console.error('[Auth] Error:', e);
    sender.send('auth:login-error', { error: 'حدث خطأ في تسجيل الدخول' });
  }
});

if (gotTheLock) {
  app.whenReady().then(async () => {
  console.log('[MAIN] 🚀 App ready, initializing...');
  console.time('[MAIN] Total initialization time');

  // ✅ تحديد مسار البيانات الآمن (partition غير الويندوز)
  SAFE_DATA_PATH = getSafeDataPath();
  console.log('[MAIN] 📁 Data path:', SAFE_DATA_PATH);

  // ✅ نقل البيانات القديمة للمسار الجديد (لو موجودة)
  const oldDataPath = app.getPath('userData');
  migrateDataIfNeeded(oldDataPath, SAFE_DATA_PATH);

  // ✅ استكمال استعادة نسخة احتياطية من تشغيل سابق (نسخ الملف ثم المتابعة)
  const restoredMarker = path.join(SAFE_DATA_PATH, 'elos.db.restored');
  if (fs.existsSync(restoredMarker)) {
    try {
      const dbPath = path.join(SAFE_DATA_PATH, 'elos.db');
      fs.copyFileSync(restoredMarker, dbPath);
      fs.unlinkSync(restoredMarker);
      console.log('[MAIN] ✅ Restore completed: database replaced from backup.');
    } catch (e) {
      console.error('[MAIN] ❌ Restore failed:', e.message);
    }
  }

  // ✅ تهيئة نظام الترخيص
  console.log('[MAIN] 🔐 Initializing license manager...');
  licenseManager = new LicenseManager(SAFE_DATA_PATH);
  console.log('[MAIN] 📟 Machine ID:', licenseManager.getMachineId());

  // ✅ إرسال dataPath لـ initDb
  console.log('[MAIN] 📦 Initializing database...');
  console.time('[MAIN] Database initialization');
  const dbInstance = initDb(SAFE_DATA_PATH, licenseManager);
  db = dbInstance.db;
  activeSessions = dbInstance.activeSessions;
  console.timeEnd('[MAIN] Database initialization');

  console.log('[MAIN] ✅ Database initialized');
  dbReady = true; // ✅ Mark database as ready
  
  console.log('[MAIN] 🌐 Creating HTTP Server (replacing protocol handler)...');
  console.time('[MAIN] HTTP Server creation');
  
  // ═══════════════════════════════════════════════════════════════════
  // 🔒 HTTP Server Security Configuration
  // ═══════════════════════════════════════════════════════════════════
  const HTTP_CONFIG = {
    MAX_BODY_SIZE: 10 * 1024 * 1024,  // 10MB max body size
    REQUEST_TIMEOUT: 30000,            // 30 seconds timeout
    RATE_LIMIT_WINDOW: 60000,          // 1 minute window
    RATE_LIMIT_MAX: 200                // max 200 requests per minute per endpoint
  };

  // Rate limiting map: endpoint -> { count, timestamp }
  const rateLimitMap = new Map();

  function checkEndpointRateLimit(endpoint) {
    const now = Date.now();
    const key = endpoint.split('?')[0]; // Ignore query params
    const record = rateLimitMap.get(key) || { count: 0, timestamp: now };

    if (now - record.timestamp > HTTP_CONFIG.RATE_LIMIT_WINDOW) {
      // Reset window
      record.count = 1;
      record.timestamp = now;
    } else if (record.count >= HTTP_CONFIG.RATE_LIMIT_MAX) {
      return { allowed: false, retryAfter: HTTP_CONFIG.RATE_LIMIT_WINDOW - (now - record.timestamp) };
    } else {
      record.count++;
    }

    rateLimitMap.set(key, record);
    return { allowed: true };
  }

  virtualServer = http.createServer(async (req, res) => {
    const requestId = crypto.randomBytes(8).toString('hex');
    const startTime = Date.now();

    // ⏱️ Request Timeout
    const timeoutId = setTimeout(() => {
      if (!res.writableEnded) {
        console.warn(`[HTTP-SERVER] ⏱️ Request timeout: ${req.method} ${req.url} (${requestId})`);
        res.writeHead(408, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ error: 'Request timeout', requestId }));
      }
    }, HTTP_CONFIG.REQUEST_TIMEOUT);

    // Ensure timeout is cleared on response finish
    res.on('finish', () => clearTimeout(timeoutId));
    res.on('close', () => clearTimeout(timeoutId));

    if (req.method === 'OPTIONS') {
      clearTimeout(timeoutId);
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      });
      res.end();
      return;
    }

    try {
      // Health check endpoint
      if (req.url === '/health') {
        clearTimeout(timeoutId);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
        return;
      }

      // 🔒 Rate Limiting Check
      const rateLimitCheck = checkEndpointRateLimit(req.url);
      if (!rateLimitCheck.allowed) {
        clearTimeout(timeoutId);
        res.writeHead(429, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Retry-After': Math.ceil(rateLimitCheck.retryAfter / 1000)
        });
        res.end(JSON.stringify({
          error: 'Too many requests',
          retryAfter: Math.ceil(rateLimitCheck.retryAfter / 1000),
          requestId
        }));
        return;
      }

      // 📦 Read body with size limit
      let bodyData = '';
      let totalSize = 0;

      for await (const chunk of req) {
        totalSize += chunk.length;

        // 🔒 Max Body Size Check
        if (totalSize > HTTP_CONFIG.MAX_BODY_SIZE) {
          clearTimeout(timeoutId);
          console.warn(`[HTTP-SERVER] 📦 Payload too large: ${req.url} (${totalSize} bytes)`);
          res.writeHead(413, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({
            error: 'Payload too large',
            maxSize: HTTP_CONFIG.MAX_BODY_SIZE,
            requestId
          }));
          return;
        }

        bodyData += chunk.toString();
      }

      const request = {
        url: 'elos-db:/' + req.url,
        method: req.method,
        headers: {
          get: (key) => req.headers[key.toLowerCase()]
        },
        text: async () => bodyData || '{}',
        json: async () => {
          try {
            return JSON.parse(bodyData || '{}');
          } catch (e) {
            return {};
          }
        }
      };

      const response = await dbInstance.handleProtocolRequest(request);

      let result;
      let statusCode = 200;

      if (response instanceof Response) {
        statusCode = response.status;
        result = await response.text();
        res.writeHead(statusCode, {
          'Content-Type': response.headers.get('content-type') || 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'X-Request-ID': requestId
        });
      } else {
        result = JSON.stringify(response);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'X-Request-ID': requestId
        });
      }

      clearTimeout(timeoutId);
      res.end(result);

      // Log slow requests and errors
      const duration = Date.now() - startTime;
      if (statusCode !== 200 || duration > 1000) {
        console.log(`[HTTP-SERVER] ${statusCode !== 200 ? '⚠️' : '🐢'} ${req.method} ${req.url} - ${statusCode} (${duration}ms)`);
      }

    } catch (error) {
      clearTimeout(timeoutId);
      console.error(`[HTTP-SERVER] ❌ Error (${requestId}):`, error.message);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Request-ID': requestId
      });
      res.end(JSON.stringify({ error: error.message, requestId }));
    }
  });

  // معالجة خطأ الـ Port مستخدم
  virtualServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[HTTP-SERVER] ❌ Port ${SERVER_PORT} is already in use!`);
      if (isSecondInstance) { app.quit(); return; }
      showElosAlreadyRunningDialog({
        title: 'البرنامج مفتوح بالفعل',
        body: `⚠️ لا يمكن تشغيل البرنامج!\n\nالبرنامج يعمل بالفعل على هذا الجهاز (Port ${SERVER_PORT}).\n\nإذا لم تجد نافذة البرنامج:\n• تحقق من شريط المهام\n• أو أغلق البرنامج من Task Manager\n• أو أعد تشغيل الكمبيوتر`,
        onClose: () => app.quit()
      });
    } else {
      console.error('[HTTP-SERVER] ❌ Server error:', err);
    }
  });

  virtualServer.listen(SERVER_PORT, SERVER_HOST, () => {
    console.log(`[HTTP-SERVER] ✅ Listening on http://${SERVER_HOST}:${SERVER_PORT}`);

    // إذا كان وضع الشبكة مفعل، اعرض عناوين IP
    if (NETWORK_MODE) {
      console.log('[HTTP-SERVER] 🌐 Network mode ENABLED - Accepting remote connections');
      const localIPs = getLocalIPAddresses();
      localIPs.forEach(ip => {
        console.log(`[HTTP-SERVER]   → http://${ip.address}:${SERVER_PORT} (${ip.name})`);
      });
      console.log('[HTTP-SERVER] ⚠️  Make sure Windows Firewall allows port', SERVER_PORT);
    }
  });

  console.timeEnd('[MAIN] HTTP Server creation');
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('[MAIN] 🎨 Creating UI...');
  console.time('[MAIN] UI creation');
  
  await createWindow();
  
  console.timeEnd('[MAIN] UI creation');
  console.timeEnd('[MAIN] Total initialization time');
  console.log('[MAIN] 🎉 App fully initialized and ready!');
  });
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (virtualServer) {
    virtualServer.close();
    console.log('[HTTP-SERVER] 🔒 Server closed');
  }
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

process.on('unhandledRejection', (err) => { console.error('Unhandled promise rejection:', err); });