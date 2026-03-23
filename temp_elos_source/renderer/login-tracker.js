// login-tracker.js - تتبع آخر دخول للمستخدمين
// ═══════════════════════════════════════════════════════════════════
// ضع هذا الكود في صفحة تسجيل الدخول بعد نجاح Login
// ═══════════════════════════════════════════════════════════════════

// Fallbacks if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
var Logger = window.Logger;

async function updateLastLogin(userId) {
  try {
    const now = new Date().toISOString();
    
    const response = await fetch(`elos-db://users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': localStorage.getItem('sessionId')
      },
      body: JSON.stringify({
        last_login: now
      })
    });
    
    if (response.ok) {
      Logger.log('[LOGIN-TRACKER] ✅ Last login updated:', now);
      
      // تحديث بيانات المستخدم في localStorage
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        user.last_login = now;
        localStorage.setItem('user', JSON.stringify(user));
      }
    } else {
      Logger.error('[LOGIN-TRACKER] ❌ Failed to update last login');
    }
  } catch (error) {
    Logger.error('[LOGIN-TRACKER] ❌ Error updating last login:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════
// استخدم هذا الكود في صفحة تسجيل الدخول:
// ═══════════════════════════════════════════════════════════════════
/*

// بعد نجاح تسجيل الدخول:
async function handleLoginSuccess(userData, sessionId) {
  // حفظ البيانات
  localStorage.setItem('sessionId', sessionId);
  localStorage.setItem('user', JSON.stringify(userData));
  
  // ✨ تحديث آخر دخول
  await updateLastLogin(userData.id);
  
  // الانتقال للصفحة الرئيسية
  window.location.href = 'index.html';
}

*/

// ═══════════════════════════════════════════════════════════════════
// أو استخدم Auto-Tracker في index.html
// ═══════════════════════════════════════════════════════════════════

(function autoTrackLogin() {
  // تشغيل مرة واحدة فقط عند فتح الصفحة
  const userStr = localStorage.getItem('user');
  const sessionId = localStorage.getItem('sessionId');
  
  if (userStr && sessionId) {
    const user = JSON.parse(userStr);
    
    // التحقق من آخر تحديث
    const lastTracked = sessionStorage.getItem('lastLoginTracked');
    const now = Date.now();
    
    // تحديث كل 5 دقائق على الأقل
    if (!lastTracked || (now - parseInt(lastTracked)) > 5 * 60 * 1000) {
      updateLastLogin(user.id);
      sessionStorage.setItem('lastLoginTracked', now.toString());
      Logger.log('[LOGIN-TRACKER] 🕒 Auto-tracked login time');
    }
  }
})();
