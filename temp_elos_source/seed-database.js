// seed-database.js
// سكريبت ملء قاعدة البيانات بالبيانات التجريبية
// تشغيل: node seed-database.js

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

// مسار قاعدة البيانات
const dbPath = path.join(__dirname, 'Database', 'elos.db');
const db = new Database(dbPath);

// تفعيل WAL mode للأداء
db.pragma('journal_mode = WAL');

// تعطيل الـ Foreign Keys مؤقتاً للسماح بحذف البيانات
db.pragma('foreign_keys = OFF');

// حذف جميع البيانات القديمة بالترتيب الصحيح
console.log('🗑️ تنظيف البيانات القديمة...');
const tablesToClear = [
  'repair_invoices',
  'repair_invoice_items',
  'repair_payments',
  'repair_events',
  'repair_status_history',
  'repair_ticket_parts',
  'repair_parts_movements',
  'accessory_movements',
  'warehouse_movements',
  'warehouse_transfers',
  'purchase_invoice_items',
  'purchase_invoices',
  'purchase_returns',
  'supplier_transactions',
  'partner_transactions',
  'safe_transactions',
  'shift_closings',
  'employee_salaries',
  'employee_attendance',
  'attendance_sessions',
  'audit_log',
  'cash_ledger',
  'sales',
  'purchases',
  'repair_tickets',
  'repair_parts',
  'accessories',
  'warehouse_items',
  'devices',
  'device_blacklist',
  'reminders',
  'clients',
  'suppliers',
  'partners',
  'employees',
  'warehouses'
];

for (const table of tablesToClear) {
  try {
    db.prepare(`DELETE FROM ${table}`).run();
  } catch (e) {
    // تجاهل الأخطاء إذا الجدول غير موجود
  }
}

// إعادة تفعيل الـ Foreign Keys
db.pragma('foreign_keys = ON');
console.log('✅ تم تنظيف البيانات القديمة');

// دالة تشفير كلمة المرور
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// دالة توليد تاريخ عشوائي في الشهر الماضي
function randomDateLastMonth(daysAgo = 30) {
  const now = new Date();
  const past = new Date(now.getTime() - Math.random() * daysAgo * 24 * 60 * 60 * 1000);
  return past.toISOString().replace('T', ' ').substring(0, 19);
}

// دالة توليد تاريخ عشوائي بين تاريخين
function randomDateBetween(startDaysAgo, endDaysAgo) {
  const now = new Date();
  const start = now.getTime() - startDaysAgo * 24 * 60 * 60 * 1000;
  const end = now.getTime() - endDaysAgo * 24 * 60 * 60 * 1000;
  const randomTime = start + Math.random() * (end - start);
  return new Date(randomTime).toISOString().replace('T', ' ').substring(0, 19);
}

// دالة توليد رقم عشوائي
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// دالة اختيار عنصر عشوائي من مصفوفة
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// دالة توليد IMEI عشوائي
function generateIMEI() {
  let imei = '';
  for (let i = 0; i < 15; i++) {
    imei += Math.floor(Math.random() * 10);
  }
  return imei;
}

// دالة توليد رقم هاتف مصري
function generateEgyptianPhone() {
  const prefixes = ['010', '011', '012', '015'];
  return prefixes[Math.floor(Math.random() * prefixes.length)] +
         Math.floor(10000000 + Math.random() * 90000000);
}

console.log('='.repeat(60));
console.log('🚀 بدء ملء قاعدة البيانات بالبيانات التجريبية');
console.log('='.repeat(60));

// ═══════════════════════════════════════════════════════════════
// 1. إضافة المستخدم admin
// ═══════════════════════════════════════════════════════════════
console.log('\n📌 1. إضافة المستخدم admin...');

const existingAdmin = db.prepare(`SELECT id FROM users WHERE username = 'admin'`).get();
if (existingAdmin) {
  db.prepare(`DELETE FROM users WHERE username = 'admin'`).run();
}

const adminPasswordHash = hashPassword('1234');
db.prepare(`
  INSERT INTO users (username, password_hash, display_name, role, is_active)
  VALUES ('admin', ?, 'المدير', 'admin', 1)
`).run(adminPasswordHash);

console.log('✅ تم إضافة المستخدم admin بكلمة مرور 1234');

// ═══════════════════════════════════════════════════════════════
// 2. إنشاء المخازن
// ═══════════════════════════════════════════════════════════════
console.log('\n📌 2. إنشاء المخازن...');

// المخازن الرئيسية
const mainWarehouses = [
  { name: 'الأجهزة', type: 'devices', icon: '📱', description: 'مخزن الموبايلات والأجهزة الإلكترونية', color: '#10b981', target_page: 'inventory.html', is_storage_only: 0 },
  { name: 'الإكسسوارات', type: 'accessories', icon: '🎧', description: 'مخزن إكسسوارات الموبايل', color: '#8b5cf6', target_page: 'warehouse-inventory.html?warehouse_id=2', is_storage_only: 0 },
  { name: 'قطع غيار الصيانة', type: 'repair_parts', icon: '🔧', description: 'مخزن قطع غيار الصيانة', color: '#f59e0b', target_page: 'repairs.html', is_storage_only: 0 }
];

// المخازن التخزينية
const storageWarehouses = [
  { name: 'مخزن الأجهزة الاحتياطي', type: 'custom', icon: '📦', description: 'مخزن تخزيني للأجهزة', color: '#06b6d4', target_page: null, is_storage_only: 1, storage_type: 'devices' },
  { name: 'مخزن الإكسسوارات الاحتياطي', type: 'custom', icon: '📦', description: 'مخزن تخزيني للإكسسوارات', color: '#ec4899', target_page: null, is_storage_only: 1, storage_type: 'accessories' },
  { name: 'مخزن قطع الغيار الاحتياطي', type: 'custom', icon: '📦', description: 'مخزن تخزيني لقطع الصيانة', color: '#84cc16', target_page: null, is_storage_only: 1, storage_type: 'spare_parts' }
];

const insertWarehouse = db.prepare(`
  INSERT INTO warehouses (name, type, icon, description, color, target_page, is_storage_only, storage_type, is_active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
`);

mainWarehouses.forEach(w => {
  insertWarehouse.run(w.name, w.type, w.icon, w.description, w.color, w.target_page, w.is_storage_only, null);
});

storageWarehouses.forEach(w => {
  insertWarehouse.run(w.name, w.type, w.icon, w.description, w.color, w.target_page, w.is_storage_only, w.storage_type);
});

const warehouses = db.prepare(`SELECT * FROM warehouses`).all();
console.log(`✅ تم إنشاء ${warehouses.length} مخازن`);

const devicesWarehouseId = warehouses.find(w => w.type === 'devices')?.id;
const accessoriesWarehouseId = warehouses.find(w => w.type === 'accessories')?.id;
const repairPartsWarehouseId = warehouses.find(w => w.type === 'repair_parts')?.id;
const storageDevicesWarehouseId = warehouses.find(w => w.storage_type === 'devices')?.id;
const storageAccessoriesWarehouseId = warehouses.find(w => w.storage_type === 'accessories')?.id;
const storageSparePartsWarehouseId = warehouses.find(w => w.storage_type === 'spare_parts')?.id;

// ═══════════════════════════════════════════════════════════════
// 3. إضافة الموردين (20 مورد)
// ═══════════════════════════════════════════════════════════════
console.log('\n📌 3. إضافة الموردين...');

const supplierNames = [
  'شركة النيل للموبايلات', 'مؤسسة الفرعون للإكسسوارات', 'شركة الهرم للتقنية',
  'مؤسسة القاهرة للأجهزة', 'شركة الإسكندرية للموبايل', 'مؤسسة طيبة للإلكترونيات',
  'شركة الدلتا للاتصالات', 'مؤسسة الصعيد للتقنية', 'شركة السويس للموبايلات',
  'مؤسسة بورسعيد للإكسسوارات', 'شركة المنصورة للأجهزة', 'مؤسسة طنطا للإلكترونيات',
  'شركة الزقازيق للموبايلات', 'مؤسسة أسيوط للتقنية', 'شركة الفيوم للاتصالات',
  'مؤسسة المنيا للأجهزة', 'شركة سوهاج للموبايلات', 'مؤسسة قنا للإلكترونيات',
  'شركة الأقصر للتقنية', 'مؤسسة أسوان للاتصالات'
];

const insertSupplier = db.prepare(`
  INSERT INTO suppliers (name, phone, address, balance, notes, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

supplierNames.forEach((name, i) => {
  const balance = randomInt(0, 50000);
  insertSupplier.run(
    name,
    generateEgyptianPhone(),
    `${randomChoice(['القاهرة', 'الجيزة', 'الإسكندرية', 'المنصورة', 'طنطا'])} - شارع ${randomInt(1, 100)}`,
    balance,
    `مورد ${randomChoice(['أجهزة', 'إكسسوارات', 'قطع غيار', 'متنوع'])}`,
    randomDateLastMonth(60)
  );
});

const suppliers = db.prepare(`SELECT * FROM suppliers`).all();
console.log(`✅ تم إضافة ${suppliers.length} مورد`);

// ═══════════════════════════════════════════════════════════════
// 4. إضافة العملاء (20 عميل)
// ═══════════════════════════════════════════════════════════════
console.log('\n📌 4. إضافة العملاء...');

const clientNames = [
  'أحمد محمد علي', 'محمود حسن إبراهيم', 'خالد عبدالله سعيد', 'عمر طارق محمد',
  'ياسر أحمد حسين', 'سامي محمد عبدالرحمن', 'هاني علي محمود', 'طارق حسام الدين',
  'مصطفى أحمد كمال', 'كريم محمد نبيل', 'رامي إبراهيم سيد', 'بلال عمر فتحي',
  'إسلام خالد حسن', 'معتز أحمد علي', 'شريف محمود سامي', 'وليد حسن إبراهيم',
  'فادي طارق محمد', 'باسم أحمد عبدالله', 'نادر محمد حسين', 'زياد علي أحمد'
];

const insertClient = db.prepare(`
  INSERT INTO clients (name, phone, address, balance, notes, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

clientNames.forEach((name, i) => {
  insertClient.run(
    name,
    generateEgyptianPhone(),
    `${randomChoice(['القاهرة', 'الجيزة', 'الإسكندرية', 'المنصورة', 'طنطا', 'الزقازيق'])} - شارع ${randomInt(1, 100)}`,
    0, // الرصيد يُحسب ديناميكياً
    randomChoice(['عميل مميز', 'عميل جديد', 'عميل دائم', '']),
    randomDateLastMonth(60)
  );
});

const clients = db.prepare(`SELECT * FROM clients`).all();
console.log(`✅ تم إضافة ${clients.length} عميل`);

// ═══════════════════════════════════════════════════════════════
// 5. إضافة الموظفين (3 موظفين)
// ═══════════════════════════════════════════════════════════════
console.log('\n📌 5. إضافة الموظفين...');

const employees = [
  { name: 'محمد أحمد السيد', job_title: 'كاشير', salary: 6000 },
  { name: 'علي حسن محمود', job_title: 'فني صيانة', salary: 7500 },
  { name: 'عمرو خالد إبراهيم', job_title: 'مندوب مبيعات', salary: 5500 }
];

const insertEmployee = db.prepare(`
  INSERT INTO employees (name, phone, email, national_id, job_title, department, salary, salary_type, hire_date, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'monthly', ?, 'active')
`);

employees.forEach(emp => {
  insertEmployee.run(
    emp.name,
    generateEgyptianPhone(),
    `${emp.name.split(' ')[0].toLowerCase()}@elos.com`,
    `2${randomInt(80, 99)}${randomInt(1, 12).toString().padStart(2, '0')}${randomInt(1, 28).toString().padStart(2, '0')}${randomInt(10000, 99999)}`,
    emp.job_title,
    randomChoice(['المبيعات', 'الصيانة', 'المخازن']),
    emp.salary,
    randomDateLastMonth(180)
  );
});

console.log(`✅ تم إضافة ${employees.length} موظفين`);

// ═══════════════════════════════════════════════════════════════
// 6. إضافة الأجهزة (100 + 20 تخزيني)
// ═══════════════════════════════════════════════════════════════
console.log('\n📌 6. إضافة الأجهزة...');

const deviceBrands = {
  'iPhone': ['iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15', 'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14', 'iPhone 13 Pro Max', 'iPhone 13', 'iPhone 12', 'iPhone 11'],
  'Samsung': ['Galaxy S24 Ultra', 'Galaxy S24+', 'Galaxy S24', 'Galaxy S23 Ultra', 'Galaxy S23', 'Galaxy A54', 'Galaxy A34', 'Galaxy A14', 'Galaxy Z Fold5', 'Galaxy Z Flip5'],
  'Xiaomi': ['Xiaomi 14 Pro', 'Xiaomi 14', 'Redmi Note 13 Pro', 'Redmi Note 13', 'Redmi 13C', 'POCO X6 Pro', 'POCO F5', 'Xiaomi 13T'],
  'OPPO': ['OPPO Find X7', 'OPPO Reno 11', 'OPPO Reno 10', 'OPPO A98', 'OPPO A78', 'OPPO A58'],
  'Vivo': ['Vivo X100', 'Vivo V29', 'Vivo V27', 'Vivo Y100', 'Vivo Y36'],
  'Realme': ['Realme GT5', 'Realme 11 Pro', 'Realme 11', 'Realme C55', 'Realme C53'],
  'Huawei': ['Huawei Mate 60 Pro', 'Huawei P60 Pro', 'Huawei Nova 11', 'Huawei Nova Y90'],
  'Honor': ['Honor Magic6 Pro', 'Honor 90', 'Honor X9b', 'Honor X8'],
  'Infinix': ['Infinix Zero 30', 'Infinix Note 30', 'Infinix Hot 40 Pro', 'Infinix Smart 8'],
  'Tecno': ['Tecno Phantom V Fold', 'Tecno Camon 20 Pro', 'Tecno Spark 20 Pro', 'Tecno Pop 8']
};

const storages = ['64GB', '128GB', '256GB', '512GB', '1TB'];
const colors = ['أسود', 'أبيض', 'ذهبي', 'فضي', 'أزرق', 'أحمر', 'أخضر', 'بنفسجي'];
const conditions = ['new', 'like_new', 'used'];

const insertDevice = db.prepare(`
  INSERT INTO devices (type, model, storage, condition, color, imei1, imei2, purchase_cost, expected_price, status, battery_health, has_box, warehouse_id, source, notes, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let deviceCount = 0;

// 100 جهاز للمخزن الرئيسي
for (let i = 0; i < 100; i++) {
  const brand = randomChoice(Object.keys(deviceBrands));
  const model = randomChoice(deviceBrands[brand]);
  const condition = randomChoice(conditions);

  let purchaseCost, expectedPrice;
  if (brand === 'iPhone') {
    purchaseCost = randomInt(15000, 60000);
  } else if (brand === 'Samsung') {
    purchaseCost = randomInt(8000, 45000);
  } else {
    purchaseCost = randomInt(3000, 20000);
  }

  expectedPrice = Math.round(purchaseCost * (1 + randomInt(10, 25) / 100));

  insertDevice.run(
    brand,
    model,
    randomChoice(storages),
    condition,
    randomChoice(colors),
    generateIMEI(),
    Math.random() > 0.3 ? generateIMEI() : null,
    purchaseCost,
    expectedPrice,
    'in_stock',
    condition === 'new' ? 100 : randomInt(75, 99),
    condition === 'new' ? 1 : (Math.random() > 0.5 ? 1 : 0),
    devicesWarehouseId,
    randomChoice(['توريد', 'شراء من عميل', 'استبدال']),
    '',
    randomDateLastMonth(45)
  );
  deviceCount++;
}

// 20 جهاز للمخزن التخزيني
for (let i = 0; i < 20; i++) {
  const brand = randomChoice(Object.keys(deviceBrands));
  const model = randomChoice(deviceBrands[brand]);
  const condition = randomChoice(conditions);

  let purchaseCost;
  if (brand === 'iPhone') {
    purchaseCost = randomInt(15000, 60000);
  } else if (brand === 'Samsung') {
    purchaseCost = randomInt(8000, 45000);
  } else {
    purchaseCost = randomInt(3000, 20000);
  }

  const expectedPrice = Math.round(purchaseCost * (1 + randomInt(10, 25) / 100));

  insertDevice.run(
    brand,
    model,
    randomChoice(storages),
    condition,
    randomChoice(colors),
    generateIMEI(),
    Math.random() > 0.3 ? generateIMEI() : null,
    purchaseCost,
    expectedPrice,
    'in_stock',
    condition === 'new' ? 100 : randomInt(75, 99),
    condition === 'new' ? 1 : (Math.random() > 0.5 ? 1 : 0),
    storageDevicesWarehouseId,
    'توريد احتياطي',
    'مخزن احتياطي',
    randomDateLastMonth(45)
  );
  deviceCount++;
}

console.log(`✅ تم إضافة ${deviceCount} جهاز`);

// ═══════════════════════════════════════════════════════════════
// 7. إضافة الإكسسوارات (2000 + 200 تخزيني)
// ═══════════════════════════════════════════════════════════════
console.log('\n📌 7. إضافة الإكسسوارات...');

const accessoryCategories = {
  'جرابات': ['جراب سيليكون', 'جراب جلد', 'جراب شفاف', 'جراب ضد الصدمات', 'جراب مغناطيسي'],
  'شواحن': ['شاحن سريع 20W', 'شاحن سريع 33W', 'شاحن سريع 65W', 'شاحن لاسلكي', 'شاحن سيارة'],
  'كابلات': ['كابل USB-C', 'كابل Lightning', 'كابل Micro USB', 'كابل Type-C to Lightning'],
  'سماعات': ['سماعات سلكية', 'سماعات بلوتوث', 'سماعات AirPods', 'سماعات TWS'],
  'واقي شاشة': ['واقي زجاج عادي', 'واقي زجاج 9D', 'واقي زجاج Privacy', 'واقي بلاستيك'],
  'باور بانك': ['باور بانك 10000mAh', 'باور بانك 20000mAh', 'باور بانك 30000mAh'],
  'حوامل': ['حامل سيارة', 'حامل مكتب', 'حامل رينج', 'حامل مغناطيسي'],
  'ساعات ذكية': ['ساعة ذكية T500', 'ساعة ذكية W26', 'ساعة ذكية HW22'],
  'كاميرات': ['عدسة كاميرا', 'فلاش خارجي', 'ترايبود'],
  'متنوعات': ['قلم ستايلس', 'محول OTG', 'قارئ بطاقات', 'فلاشة USB']
};

const accessoryBrands = ['Generic', 'Baseus', 'Anker', 'Ugreen', 'Hoco', 'Remax', 'Joyroom', 'Rock', 'Nillkin'];

const insertAccessory = db.prepare(`
  INSERT INTO accessories (warehouse_id, name, category, brand, barcode, sku, purchase_price, sale_price, sell_price, quantity, min_stock, max_stock, supplier_id, notes, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let accessoryCount = 0;
let totalAccessoryQty = 0;
let barcodeCounter = 10000;

// إنشاء أصناف الإكسسوارات (حوالي 100 صنف بكميات مختلفة للوصول لـ 2000 قطعة)
const accessoryItems = [];
for (const [category, items] of Object.entries(accessoryCategories)) {
  for (const item of items) {
    for (const brand of accessoryBrands.slice(0, 3)) {
      accessoryItems.push({ category, item, brand });
    }
  }
}

// 2000 قطعة للمخزن الرئيسي
const targetMainQty = 2000;
let mainQty = 0;
let itemIndex = 0;

while (mainQty < targetMainQty && itemIndex < accessoryItems.length) {
  const acc = accessoryItems[itemIndex];
  const qty = randomInt(10, 50);
  const purchasePrice = randomInt(10, 500);
  const salePrice = Math.round(purchasePrice * (1 + randomInt(30, 80) / 100));

  insertAccessory.run(
    accessoriesWarehouseId,
    `${acc.item} ${acc.brand}`,
    acc.category,
    acc.brand,
    String(barcodeCounter++),
    `ACC-${String(itemIndex + 1).padStart(4, '0')}`,
    purchasePrice,
    salePrice,
    salePrice,
    qty,
    5,
    100,
    suppliers[randomInt(0, suppliers.length - 1)].id,
    '',
    randomDateLastMonth(45)
  );

  mainQty += qty;
  accessoryCount++;
  itemIndex++;
}

// إكمال للوصول لـ 2000 بالضبط
while (mainQty < targetMainQty) {
  const acc = randomChoice(accessoryItems);
  const qty = Math.min(targetMainQty - mainQty, randomInt(5, 30));
  const purchasePrice = randomInt(10, 500);
  const salePrice = Math.round(purchasePrice * (1 + randomInt(30, 80) / 100));

  insertAccessory.run(
    accessoriesWarehouseId,
    `${acc.item} ${acc.brand} - ${randomInt(1, 99)}`,
    acc.category,
    acc.brand,
    String(barcodeCounter++),
    `ACC-${String(accessoryCount + 1).padStart(4, '0')}`,
    purchasePrice,
    salePrice,
    salePrice,
    qty,
    5,
    100,
    suppliers[randomInt(0, suppliers.length - 1)].id,
    '',
    randomDateLastMonth(45)
  );

  mainQty += qty;
  accessoryCount++;
}

totalAccessoryQty = mainQty;

// 200 قطعة للمخزن التخزيني
const targetStorageQty = 200;
let storageQty = 0;

while (storageQty < targetStorageQty) {
  const acc = randomChoice(accessoryItems);
  const qty = Math.min(targetStorageQty - storageQty, randomInt(10, 30));
  const purchasePrice = randomInt(10, 500);
  const salePrice = Math.round(purchasePrice * (1 + randomInt(30, 80) / 100));

  insertAccessory.run(
    storageAccessoriesWarehouseId,
    `${acc.item} ${acc.brand} - احتياطي`,
    acc.category,
    acc.brand,
    String(barcodeCounter++),
    `ACC-S-${String(storageQty + 1).padStart(4, '0')}`,
    purchasePrice,
    salePrice,
    salePrice,
    qty,
    5,
    100,
    suppliers[randomInt(0, suppliers.length - 1)].id,
    'مخزن احتياطي',
    randomDateLastMonth(45)
  );

  storageQty += qty;
  accessoryCount++;
}

totalAccessoryQty += storageQty;

console.log(`✅ تم إضافة ${accessoryCount} صنف إكسسوار بإجمالي ${totalAccessoryQty} قطعة`);

// ═══════════════════════════════════════════════════════════════
// 8. إضافة قطع غيار الصيانة (200 + 100 تخزيني)
// ═══════════════════════════════════════════════════════════════
console.log('\n📌 8. إضافة قطع غيار الصيانة...');

const repairPartCategories = {
  'شاشات': ['شاشة iPhone 15', 'شاشة iPhone 14', 'شاشة iPhone 13', 'شاشة iPhone 12', 'شاشة iPhone 11', 'شاشة Samsung S24', 'شاشة Samsung S23', 'شاشة Samsung A54', 'شاشة Xiaomi 14', 'شاشة OPPO Reno'],
  'بطاريات': ['بطارية iPhone 15', 'بطارية iPhone 14', 'بطارية iPhone 13', 'بطارية Samsung S24', 'بطارية Samsung A54', 'بطارية Xiaomi', 'بطارية OPPO', 'بطارية Huawei'],
  'سماعات داخلية': ['سماعة iPhone', 'سماعة Samsung', 'سماعة Xiaomi', 'سماعة OPPO'],
  'كاميرات': ['كاميرا خلفية iPhone 15', 'كاميرا أمامية iPhone', 'كاميرا Samsung', 'كاميرا Xiaomi'],
  'شرائح شحن': ['شريحة شحن iPhone', 'شريحة شحن Samsung', 'شريحة شحن Type-C'],
  'أزرار': ['زر هوم', 'زر باور', 'أزرار صوت', 'زر صامت iPhone'],
  'فليكسات': ['فليكس Face ID', 'فليكس Touch ID', 'فليكس شاشة', 'فليكس شحن'],
  'IC وشرائح': ['IC شحن', 'IC صوت', 'IC واي فاي', 'IC تاتش'],
  'متنوعات': ['لاصق بطارية', 'لاصق شاشة', 'مسامير iPhone', 'إطار وسط']
};

const insertRepairPart = db.prepare(`
  INSERT INTO repair_parts (name, category, sku, unit_cost, sell_price, qty, min_qty, notes, warehouse_id, barcode, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let repairPartCount = 0;
let totalRepairPartQty = 0;
let repairBarcodeCounter = 90000;

// إنشاء قائمة قطع الغيار
const repairPartItems = [];
for (const [category, items] of Object.entries(repairPartCategories)) {
  for (const item of items) {
    repairPartItems.push({ category, item });
  }
}

// 200 قطعة للمخزن الرئيسي
const targetMainRepairQty = 200;
let mainRepairQty = 0;

while (mainRepairQty < targetMainRepairQty && repairPartCount < repairPartItems.length) {
  const part = repairPartItems[repairPartCount];
  const qty = randomInt(3, 15);
  let unitCost, sellPrice;

  if (part.category === 'شاشات') {
    unitCost = randomInt(500, 3000);
  } else if (part.category === 'بطاريات') {
    unitCost = randomInt(100, 500);
  } else if (part.category === 'كاميرات') {
    unitCost = randomInt(200, 1500);
  } else if (part.category === 'IC وشرائح') {
    unitCost = randomInt(50, 300);
  } else {
    unitCost = randomInt(30, 200);
  }

  sellPrice = Math.round(unitCost * (1 + randomInt(50, 100) / 100));

  insertRepairPart.run(
    part.item,
    part.category,
    `RP-${String(repairPartCount + 1).padStart(4, '0')}`,
    unitCost,
    sellPrice,
    qty,
    2,
    '',
    repairPartsWarehouseId,
    String(repairBarcodeCounter++),
    randomDateLastMonth(45)
  );

  mainRepairQty += qty;
  repairPartCount++;
}

// إكمال للوصول لـ 200
while (mainRepairQty < targetMainRepairQty) {
  const part = randomChoice(repairPartItems);
  const qty = Math.min(targetMainRepairQty - mainRepairQty, randomInt(2, 10));
  const unitCost = randomInt(50, 500);
  const sellPrice = Math.round(unitCost * (1 + randomInt(50, 100) / 100));

  insertRepairPart.run(
    `${part.item} - ${randomInt(1, 99)}`,
    part.category,
    `RP-${String(repairPartCount + 1).padStart(4, '0')}`,
    unitCost,
    sellPrice,
    qty,
    2,
    '',
    repairPartsWarehouseId,
    String(repairBarcodeCounter++),
    randomDateLastMonth(45)
  );

  mainRepairQty += qty;
  repairPartCount++;
}

totalRepairPartQty = mainRepairQty;

// 100 قطعة للمخزن التخزيني
const targetStorageRepairQty = 100;
let storageRepairQty = 0;

while (storageRepairQty < targetStorageRepairQty) {
  const part = randomChoice(repairPartItems);
  const qty = Math.min(targetStorageRepairQty - storageRepairQty, randomInt(3, 15));
  const unitCost = randomInt(50, 500);
  const sellPrice = Math.round(unitCost * (1 + randomInt(50, 100) / 100));

  insertRepairPart.run(
    `${part.item} - احتياطي`,
    part.category,
    `RP-S-${String(storageRepairQty + 1).padStart(4, '0')}`,
    unitCost,
    sellPrice,
    qty,
    2,
    'مخزن احتياطي',
    storageSparePartsWarehouseId,
    String(repairBarcodeCounter++),
    randomDateLastMonth(45)
  );

  storageRepairQty += qty;
  repairPartCount++;
}

totalRepairPartQty += storageRepairQty;

console.log(`✅ تم إضافة ${repairPartCount} صنف قطع غيار بإجمالي ${totalRepairPartQty} قطعة`);

// ═══════════════════════════════════════════════════════════════
// 9. إضافة البلاك ليست (20 جهاز)
// ═══════════════════════════════════════════════════════════════
console.log('\n📌 9. إضافة البلاك ليست...');

const blacklistReasons = [
  'جهاز مسروق - بلاغ شرطة',
  'جهاز مفقود - بلاغ صاحبه',
  'جهاز مشتبه به',
  'جهاز مسروق من المحل',
  'جهاز عليه حظر'
];

const insertBlacklist = db.prepare(`
  INSERT INTO device_blacklist (imei, device_name, owner_name, owner_phone, reason, notes, reported_date, status, created_by, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'admin', ?)
`);

for (let i = 0; i < 20; i++) {
  const brand = randomChoice(Object.keys(deviceBrands));
  const model = randomChoice(deviceBrands[brand]);
  const reportDate = randomDateLastMonth(60);

  insertBlacklist.run(
    generateIMEI(),
    `${brand} ${model}`,
    randomChoice(clientNames),
    generateEgyptianPhone(),
    randomChoice(blacklistReasons),
    `تم الإبلاغ بتاريخ ${reportDate.split(' ')[0]}`,
    reportDate.split(' ')[0],
    reportDate
  );
}

console.log('✅ تم إضافة 20 جهاز للبلاك ليست');

// ═══════════════════════════════════════════════════════════════
// 10. إنشاء عمليات شهر كامل
// ═══════════════════════════════════════════════════════════════
console.log('\n📌 10. إنشاء عمليات شهر كامل...');

// الحصول على الأجهزة المتاحة
const availableDevices = db.prepare(`SELECT * FROM devices WHERE status = 'in_stock' AND warehouse_id = ?`).all(devicesWarehouseId);
const allClients = db.prepare(`SELECT * FROM clients`).all();
const allSuppliers = db.prepare(`SELECT * FROM suppliers`).all();
const allAccessories = db.prepare(`SELECT * FROM accessories WHERE warehouse_id = ?`).all(accessoriesWarehouseId);
const allRepairParts = db.prepare(`SELECT * FROM repair_parts WHERE warehouse_id = ?`).all(repairPartsWarehouseId);

// ═══════════════════════════════════════════════════════════════
// 10.1 عمليات البيع (40 عملية بيع على مدار الشهر)
// ═══════════════════════════════════════════════════════════════
console.log('   📦 إنشاء عمليات البيع...');

const insertSale = db.prepare(`
  INSERT INTO sales (device_id, sell_price, discount, customer_name, customer_phone, client_id, paid_now, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?)
`);

const updateDeviceStatus = db.prepare(`UPDATE devices SET status = 'sold' WHERE id = ?`);

const insertCashLedger = db.prepare(`
  INSERT INTO cash_ledger (kind, amount, ref, note, created_at)
  VALUES (?, ?, ?, ?, ?)
`);

let salesCount = 0;
const soldDeviceIds = new Set();

for (let i = 0; i < 40 && salesCount < availableDevices.length; i++) {
  const device = availableDevices[salesCount];
  if (soldDeviceIds.has(device.id)) continue;

  const client = randomChoice(allClients);
  const discount = Math.random() > 0.7 ? randomInt(100, 500) : 0;
  const sellPrice = device.expected_price;
  const paidNow = Math.random() > 0.3 ? sellPrice - discount : randomInt(Math.floor((sellPrice - discount) * 0.5), sellPrice - discount);
  const saleDate = randomDateBetween(30, 1);

  insertSale.run(
    device.id,
    sellPrice,
    discount,
    client.name,
    client.phone,
    client.id,
    paidNow,
    saleDate
  );

  updateDeviceStatus.run(device.id);
  soldDeviceIds.add(device.id);

  // إضافة للكاش
  if (paidNow > 0) {
    insertCashLedger.run('in', paidNow, 'sale', `بيع ${device.type} ${device.model}`, saleDate);
  }

  salesCount++;
}

console.log(`   ✅ تم إنشاء ${salesCount} عملية بيع`);

// ═══════════════════════════════════════════════════════════════
// 10.2 عمليات الشراء (15 عملية شراء)
// ═══════════════════════════════════════════════════════════════
console.log('   📦 إنشاء عمليات الشراء...');

const insertPurchase = db.prepare(`
  INSERT INTO purchases (device_id, source_type, party_name, party_phone, supplier_id, total_cost, paid_now, payment_method, notes, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// شراء أجهزة من موردين
for (let i = 0; i < 10; i++) {
  const supplier = randomChoice(allSuppliers);
  const brand = randomChoice(Object.keys(deviceBrands));
  const model = randomChoice(deviceBrands[brand]);
  const purchaseCost = randomInt(5000, 30000);
  const paidNow = Math.random() > 0.3 ? purchaseCost : randomInt(Math.floor(purchaseCost * 0.5), purchaseCost);
  const purchaseDate = randomDateBetween(30, 1);

  // إضافة جهاز جديد
  const newDevice = db.prepare(`
    INSERT INTO devices (type, model, storage, condition, color, imei1, purchase_cost, expected_price, status, battery_health, has_box, warehouse_id, source, created_at)
    VALUES (?, ?, ?, 'new', ?, ?, ?, ?, 'in_stock', 100, 1, ?, ?, ?)
  `).run(
    brand,
    model,
    randomChoice(storages),
    randomChoice(colors),
    generateIMEI(),
    purchaseCost,
    Math.round(purchaseCost * 1.15),
    devicesWarehouseId,
    `توريد من ${supplier.name}`,
    purchaseDate
  );

  insertPurchase.run(
    newDevice.lastInsertRowid,
    'vendor',
    supplier.name,
    supplier.phone,
    supplier.id,
    purchaseCost,
    paidNow,
    'cash',
    `فاتورة توريد`,
    purchaseDate
  );

  if (paidNow > 0) {
    insertCashLedger.run('out', paidNow, 'purchase', `شراء ${brand} ${model} من ${supplier.name}`, purchaseDate);
  }
}

// شراء من عملاء (أجهزة مستعملة)
for (let i = 0; i < 5; i++) {
  const client = randomChoice(allClients);
  const brand = randomChoice(Object.keys(deviceBrands));
  const model = randomChoice(deviceBrands[brand]);
  const purchaseCost = randomInt(2000, 15000);
  const purchaseDate = randomDateBetween(30, 1);

  const newDevice = db.prepare(`
    INSERT INTO devices (type, model, storage, condition, color, imei1, purchase_cost, expected_price, status, battery_health, has_box, warehouse_id, source, created_at)
    VALUES (?, ?, ?, 'used', ?, ?, ?, ?, 'in_stock', ?, 0, ?, ?, ?)
  `).run(
    brand,
    model,
    randomChoice(storages),
    randomChoice(colors),
    generateIMEI(),
    purchaseCost,
    Math.round(purchaseCost * 1.2),
    randomInt(70, 95),
    devicesWarehouseId,
    `شراء من عميل ${client.name}`,
    purchaseDate
  );

  insertPurchase.run(
    newDevice.lastInsertRowid,
    'customer',
    client.name,
    client.phone,
    null,
    purchaseCost,
    purchaseCost,
    'cash',
    'شراء جهاز مستعمل',
    purchaseDate
  );

  insertCashLedger.run('out', purchaseCost, 'purchase', `شراء ${brand} ${model} من ${client.name}`, purchaseDate);
}

console.log('   ✅ تم إنشاء 15 عملية شراء');

// ═══════════════════════════════════════════════════════════════
// 10.3 مبيعات الإكسسوارات (100 عملية)
// ═══════════════════════════════════════════════════════════════
console.log('   📦 إنشاء مبيعات الإكسسوارات...');

const insertAccessoryMovement = db.prepare(`
  INSERT INTO accessory_movements (accessory_id, type, quantity, quantity_before, quantity_after, unit_price, total_price, paid_amount, payment_method, reference_type, client_id, notes, created_at)
  VALUES (?, 'out', ?, ?, ?, ?, ?, ?, 'cash', 'sale', ?, ?, ?)
`);

const updateAccessoryQty = db.prepare(`UPDATE accessories SET quantity = quantity - ? WHERE id = ? AND quantity >= ?`);

let accessorySalesCount = 0;

for (let i = 0; i < 100 && allAccessories.length > 0; i++) {
  const accessory = randomChoice(allAccessories);
  const client = randomChoice(allClients);
  const qty = randomInt(1, 3);
  const saleDate = randomDateBetween(30, 1);

  // التحقق من الكمية
  const currentAccessory = db.prepare(`SELECT quantity FROM accessories WHERE id = ?`).get(accessory.id);
  if (!currentAccessory || currentAccessory.quantity < qty) continue;

  const totalPrice = qty * accessory.sale_price;
  const quantityBefore = currentAccessory.quantity;
  const quantityAfter = quantityBefore - qty;

  const result = updateAccessoryQty.run(qty, accessory.id, qty);
  if (result.changes > 0) {
    insertAccessoryMovement.run(
      accessory.id,
      qty,
      quantityBefore,
      quantityAfter,
      accessory.sale_price,
      totalPrice,
      totalPrice,
      client.id,
      `بيع ${accessory.name}`,
      saleDate
    );

    insertCashLedger.run('in', totalPrice, 'accessory_sale', `بيع ${qty} × ${accessory.name}`, saleDate);
    accessorySalesCount++;
  }
}

console.log(`   ✅ تم إنشاء ${accessorySalesCount} عملية بيع إكسسوار`);

// ═══════════════════════════════════════════════════════════════
// 10.4 تذاكر الصيانة (30 تذكرة)
// ═══════════════════════════════════════════════════════════════
console.log('   📦 إنشاء تذاكر الصيانة...');

const repairStatuses = ['received', 'diagnosing', 'waiting_approval', 'in_repair', 'ready', 'delivered'];
const repairIssues = [
  'الشاشة مكسورة', 'الشاشة لا تعمل', 'مشكلة في البطارية', 'الجهاز لا يشحن',
  'مشكلة في الصوت', 'الكاميرا لا تعمل', 'مشكلة في الزرار', 'الجهاز لا يعمل',
  'مشكلة في اللمس', 'Face ID لا يعمل', 'مشكلة في الواي فاي', 'الميكروفون لا يعمل'
];

const insertRepairTicket = db.prepare(`
  INSERT INTO repair_tickets (ticket_no, client_id, customer_name, customer_phone, device_category, device_brand, device_model, imei_or_serial, issue_description, status, package_price, total_cost, warranty_days, created_by, created_at, delivered_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?)
`);

const deviceCategories = ['هاتف ذكي', 'تابلت', 'لابتوب', 'ساعة ذكية', 'سماعات'];

const insertRepairPayment = db.prepare(`
  INSERT INTO repair_payments (ticket_id, kind, amount, wallet_type, note, created_at, created_by)
  VALUES (?, ?, ?, 'cash', ?, ?, 'admin')
`);

const insertRepairEvent = db.prepare(`
  INSERT INTO repair_events (ticket_id, event_type, from_status, to_status, note, created_by, created_at)
  VALUES (?, 'status_change', ?, ?, ?, 'admin', ?)
`);

let repairCount = 0;

for (let i = 0; i < 30; i++) {
  const client = randomChoice(allClients);
  const brand = randomChoice(Object.keys(deviceBrands));
  const model = randomChoice(deviceBrands[brand]);
  const issue = randomChoice(repairIssues);
  const status = randomChoice(repairStatuses);
  const packagePrice = randomInt(200, 2000);
  const ticketDate = randomDateBetween(30, 1);
  const ticketNo = `R-${new Date(ticketDate).getFullYear()}${String(new Date(ticketDate).getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(4, '0')}`;

  const deliveredAt = status === 'delivered' ? randomDateBetween(new Date(ticketDate).getTime() / (24 * 60 * 60 * 1000) - Date.now() / (24 * 60 * 60 * 1000) + 30, 1) : null;

  const deviceCategory = randomChoice(deviceCategories);

  const ticket = insertRepairTicket.run(
    ticketNo,
    client.id,
    client.name,
    client.phone,
    deviceCategory,
    brand,
    model,
    generateIMEI(),
    issue,
    status,
    packagePrice,
    packagePrice,
    30,
    ticketDate,
    deliveredAt
  );

  const ticketId = ticket.lastInsertRowid;

  // إضافة دفعة عربون
  if (Math.random() > 0.3) {
    const deposit = randomInt(50, Math.floor(packagePrice * 0.5));
    insertRepairPayment.run(ticketId, 'deposit', deposit, 'عربون', ticketDate);
    insertCashLedger.run('in', deposit, `repair_deposit_${ticketId}`, `عربون صيانة - تذكرة ${ticketNo}`, ticketDate);
  }

  // إذا تم التسليم، إضافة الدفعة النهائية
  if (status === 'delivered' && deliveredAt) {
    const existingPayments = db.prepare(`SELECT SUM(amount) as total FROM repair_payments WHERE ticket_id = ?`).get(ticketId);
    const remaining = packagePrice - (existingPayments?.total || 0);
    if (remaining > 0) {
      insertRepairPayment.run(ticketId, 'final', remaining, 'دفعة نهائية', deliveredAt);
      insertCashLedger.run('in', remaining, `repair_final_${ticketId}`, `دفعة نهائية صيانة - تذكرة ${ticketNo}`, deliveredAt);
    }
  }

  // إضافة سجل الأحداث
  insertRepairEvent.run(ticketId, null, 'received', 'استلام الجهاز', ticketDate);

  repairCount++;
}

console.log(`   ✅ تم إنشاء ${repairCount} تذكرة صيانة`);

// ═══════════════════════════════════════════════════════════════
// 10.5 معاملات الخزنة والمصاريف
// ═══════════════════════════════════════════════════════════════
console.log('   📦 إنشاء معاملات الخزنة والمصاريف...');

// مصاريف متنوعة
const expenseTypes = [
  { category: 'إيجار', amount: [5000, 10000] },
  { category: 'كهرباء', amount: [500, 1500] },
  { category: 'مياه', amount: [100, 300] },
  { category: 'إنترنت', amount: [300, 600] },
  { category: 'صيانة محل', amount: [200, 1000] },
  { category: 'مستلزمات', amount: [100, 500] },
  { category: 'نظافة', amount: [200, 500] },
  { category: 'متنوعات', amount: [50, 300] }
];

for (let i = 0; i < 20; i++) {
  const expense = randomChoice(expenseTypes);
  const amount = randomInt(expense.amount[0], expense.amount[1]);
  const expenseDate = randomDateBetween(30, 1);

  insertCashLedger.run('out', amount, 'manual', `مصاريف ${expense.category}`, expenseDate);
}

console.log('   ✅ تم إنشاء معاملات الخزنة والمصاريف');

// ═══════════════════════════════════════════════════════════════
// 10.6 دفعات العملاء
// ═══════════════════════════════════════════════════════════════
console.log('   📦 إنشاء دفعات العملاء...');

// البحث عن العملاء الذين لديهم ديون
const clientsWithDebt = db.prepare(`
  SELECT c.id, c.name,
         COALESCE(SUM(s.sell_price - s.discount - s.paid_now), 0) as debt
  FROM clients c
  LEFT JOIN sales s ON s.client_id = c.id AND s.status = 'completed'
  GROUP BY c.id
  HAVING debt > 0
`).all();

for (const client of clientsWithDebt) {
  if (Math.random() > 0.5 && client.debt > 0) {
    const paymentAmount = randomInt(Math.floor(client.debt * 0.3), client.debt);
    const paymentDate = randomDateBetween(25, 1);

    insertCashLedger.run('in', paymentAmount, `client_payment_${client.id}`, `سداد من العميل ${client.name}`, paymentDate);
  }
}

console.log('   ✅ تم إنشاء دفعات العملاء');

// ═══════════════════════════════════════════════════════════════
// 10.7 التذكيرات
// ═══════════════════════════════════════════════════════════════
console.log('   📦 إنشاء التذكيرات...');

const reminderCategories = ['payment', 'meeting', 'followup', 'maintenance', 'other'];
const reminderTitles = [
  'متابعة عميل', 'سداد مستحقات', 'اجتماع مع مورد', 'صيانة دورية',
  'تجديد اشتراك', 'مراجعة مخزون', 'تحصيل ديون', 'عرض سعر'
];

const insertReminder = db.prepare(`
  INSERT INTO reminders (title, description, reminder_date, reminder_time, category, priority, status, related_type, related_id, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (let i = 0; i < 15; i++) {
  const reminderDate = new Date(Date.now() + randomInt(-5, 10) * 24 * 60 * 60 * 1000);
  const status = reminderDate < new Date() ? (Math.random() > 0.5 ? 'completed' : 'pending') : 'pending';
  const relatedType = randomChoice(['client', 'supplier', 'none']);
  let relatedId = null;

  if (relatedType === 'client') {
    relatedId = randomChoice(allClients).id;
  } else if (relatedType === 'supplier') {
    relatedId = randomChoice(allSuppliers).id;
  }

  insertReminder.run(
    randomChoice(reminderTitles),
    `ملاحظة تذكير رقم ${i + 1}`,
    reminderDate.toISOString().split('T')[0],
    `${randomInt(9, 17)}:${randomChoice(['00', '30'])}`,
    randomChoice(reminderCategories),
    randomChoice(['low', 'medium', 'high']),
    status,
    relatedType,
    relatedId,
    randomDateLastMonth(30)
  );
}

console.log('   ✅ تم إنشاء 15 تذكير');

// ═══════════════════════════════════════════════════════════════
// 10.8 تقفيلات الشفت
// ═══════════════════════════════════════════════════════════════
console.log('   📦 إنشاء تقفيلات الشفت...');

const insertShiftClosing = db.prepare(`
  INSERT INTO shift_closings (shift_date, closed_at, closed_by, sales_count, sales_cash, sales_total, deposits_total, withdraws_total, expected_cash, actual_cash, cash_difference, total_to_safe, status)
  VALUES (?, ?, 'admin', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
`);

// إنشاء تقفيلات للأسبوعين الماضيين
for (let i = 14; i >= 1; i--) {
  const shiftDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
  const dateStr = shiftDate.toISOString().split('T')[0];

  const salesCount = randomInt(3, 10);
  const salesCash = randomInt(5000, 30000);
  const depositsTotal = randomInt(1000, 5000);
  const withdrawsTotal = randomInt(500, 3000);
  const expectedCash = salesCash + depositsTotal - withdrawsTotal;
  const actualCash = expectedCash + randomInt(-100, 100);
  const cashDifference = actualCash - expectedCash;

  insertShiftClosing.run(
    dateStr,
    `${dateStr} 22:00:00`,
    salesCount,
    salesCash,
    salesCash,
    depositsTotal,
    withdrawsTotal,
    expectedCash,
    actualCash,
    cashDifference,
    actualCash
  );
}

console.log('   ✅ تم إنشاء تقفيلات الشفت');

// ═══════════════════════════════════════════════════════════════
// الخلاصة
// ═══════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(60));
console.log('✅ تم ملء قاعدة البيانات بنجاح!');
console.log('='.repeat(60));

// إحصائيات نهائية
const stats = {
  users: db.prepare(`SELECT COUNT(*) as count FROM users`).get().count,
  warehouses: db.prepare(`SELECT COUNT(*) as count FROM warehouses`).get().count,
  devices: db.prepare(`SELECT COUNT(*) as count FROM devices`).get().count,
  accessories: db.prepare(`SELECT COUNT(*) as count FROM accessories`).get().count,
  accessoriesQty: db.prepare(`SELECT COALESCE(SUM(quantity), 0) as total FROM accessories`).get().total,
  repairParts: db.prepare(`SELECT COUNT(*) as count FROM repair_parts`).get().count,
  repairPartsQty: db.prepare(`SELECT COALESCE(SUM(qty), 0) as total FROM repair_parts`).get().total,
  clients: db.prepare(`SELECT COUNT(*) as count FROM clients`).get().count,
  suppliers: db.prepare(`SELECT COUNT(*) as count FROM suppliers`).get().count,
  employees: db.prepare(`SELECT COUNT(*) as count FROM employees`).get().count,
  blacklist: db.prepare(`SELECT COUNT(*) as count FROM device_blacklist`).get().count,
  sales: db.prepare(`SELECT COUNT(*) as count FROM sales`).get().count,
  purchases: db.prepare(`SELECT COUNT(*) as count FROM purchases`).get().count,
  repairTickets: db.prepare(`SELECT COUNT(*) as count FROM repair_tickets`).get().count,
  reminders: db.prepare(`SELECT COUNT(*) as count FROM reminders`).get().count,
  shiftClosings: db.prepare(`SELECT COUNT(*) as count FROM shift_closings`).get().count
};

console.log('\n📊 إحصائيات قاعدة البيانات:');
console.log('─'.repeat(40));
console.log(`👤 المستخدمين: ${stats.users}`);
console.log(`🏪 المخازن: ${stats.warehouses}`);
console.log(`📱 الأجهزة: ${stats.devices}`);
console.log(`🎧 أصناف الإكسسوارات: ${stats.accessories} (إجمالي الكمية: ${stats.accessoriesQty})`);
console.log(`🔧 أصناف قطع الغيار: ${stats.repairParts} (إجمالي الكمية: ${stats.repairPartsQty})`);
console.log(`👥 العملاء: ${stats.clients}`);
console.log(`🏭 الموردين: ${stats.suppliers}`);
console.log(`👨‍💼 الموظفين: ${stats.employees}`);
console.log(`🚫 البلاك ليست: ${stats.blacklist}`);
console.log(`💰 عمليات البيع: ${stats.sales}`);
console.log(`🛒 عمليات الشراء: ${stats.purchases}`);
console.log(`🔧 تذاكر الصيانة: ${stats.repairTickets}`);
console.log(`⏰ التذكيرات: ${stats.reminders}`);
console.log(`📋 تقفيلات الشفت: ${stats.shiftClosings}`);
console.log('─'.repeat(40));

console.log('\n📝 بيانات الدخول:');
console.log('   اسم المستخدم: admin');
console.log('   كلمة المرور: 1234');

db.close();
console.log('\n✅ تم إغلاق قاعدة البيانات');
