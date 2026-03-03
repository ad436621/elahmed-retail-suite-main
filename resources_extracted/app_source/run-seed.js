// run-seed.js - تشغيل السكريبت عبر Electron
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  try {
    const Database = require('better-sqlite3');
    const dbPath = path.join(__dirname, 'ELOS_Data', 'elos.db');
    console.log('📂 Database path:', dbPath);

    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    // قراءة ملف SQL
    const sqlPath = path.join(__dirname, 'seed-data.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🚀 بدء تنفيذ SQL...');

    // تنفيذ SQL
    db.exec(sql);

    console.log('✅ تم ملء الداتابيز بنجاح!');
    console.log('\n📊 ملخص البيانات المضافة:');

    // عرض الإحصائيات
    const devices = db.prepare('SELECT COUNT(*) as count FROM devices').get();
    const accessories = db.prepare('SELECT COUNT(*) as count FROM accessories').get();
    const accessoryQty = db.prepare('SELECT SUM(quantity) as total FROM accessories').get();
    const clients = db.prepare('SELECT COUNT(*) as count FROM clients').get();
    const suppliers = db.prepare('SELECT COUNT(*) as count FROM suppliers').get();
    const partners = db.prepare('SELECT COUNT(*) as count FROM partners').get();
    const safeBalance = db.prepare("SELECT SUM(CASE WHEN type='deposit' THEN amount ELSE -amount END) as balance FROM safe_transactions").get();

    console.log(`   • ${devices.count} جهاز`);
    console.log(`   • ${accessories.count} صنف إكسسوار (${accessoryQty.total} قطعة)`);
    console.log(`   • ${clients.count} عميل`);
    console.log(`   • ${suppliers.count} مورد`);
    console.log(`   • ${partners.count} شريك`);
    console.log(`   • ${safeBalance.balance} ج.م في الخزينة`);

    db.close();

  } catch (error) {
    console.error('❌ خطأ:', error.message);
  }

  app.quit();
});
