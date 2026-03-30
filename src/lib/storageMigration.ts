import { STORAGE_KEYS } from '../config/storageKeys';

// ======================================================
// GX GLEAMEX — Storage Migration
// ترحيل البيانات من المفاتيح القديمة للجديدة
// يُشغَّل مرة واحدة عند بدء التطبيق
// ======================================================

interface MigrationStep {
  oldKey: string;
  newKey: string;
  version: string;
}

const MIGRATIONS: MigrationStep[] = [
  { oldKey: 'elahmed_sales',       newKey: STORAGE_KEYS.SALES,         version: 'v2' },
  { oldKey: 'gx_returns_v2',       newKey: STORAGE_KEYS.RETURNS,       version: 'v2' },
  { oldKey: 'elahmed_audit_logs',  newKey: STORAGE_KEYS.AUDIT_LOGS,    version: 'v2' },
  { oldKey: 'gx_stock_movements',  newKey: STORAGE_KEYS.STOCK_MOVEMENTS, version: 'v2' },
  { oldKey: 'elos_held_invoices',  newKey: STORAGE_KEYS.HELD_INVOICES, version: 'v1' },
  { oldKey: 'elos_transfers',      newKey: STORAGE_KEYS.TRANSFERS,     version: 'v2' },
  { oldKey: 'elos_pos_transfers',  newKey: STORAGE_KEYS.TRANSFERS,     version: 'v2' }, // POS fix
];

function mergeArrayData(existing: unknown[], migrating: unknown[]): unknown[] {
  if (!Array.isArray(existing)) return migrating;
  if (!Array.isArray(migrating)) return existing;

  // دمج بدون تكرار — بناءً على id
  const ids = new Set((existing as { id: string }[]).map(item => item.id));
  const unique = (migrating as { id: string }[]).filter(item => !ids.has(item.id));
  return [...existing, ...unique];
}

export function runStorageMigrations(): void {
  const migrationFlag = STORAGE_KEYS.MIGRATION_V2;
  if (localStorage.getItem(migrationFlag) === 'done') return;

  let migratedCount = 0;

  for (const { oldKey, newKey } of MIGRATIONS) {
    if (oldKey === newKey) continue;

    const oldData = localStorage.getItem(oldKey);
    if (!oldData) continue;

    try {
      const parsed = JSON.parse(oldData);
      const existingData = localStorage.getItem(newKey);

      if (existingData) {
        // دمج البيانات القديمة مع الجديدة
        const existing = JSON.parse(existingData);
        if (Array.isArray(parsed) && Array.isArray(existing)) {
          const merged = mergeArrayData(existing, parsed);
          localStorage.setItem(newKey, JSON.stringify(merged));
        }
      } else {
        // نقل مباشر
        localStorage.setItem(newKey, oldData);
      }

      // احتفظ بالقديم كـ backup لمدة شهر ثم احذفه
      localStorage.setItem(oldKey + '_backup_migrated', oldData);
      localStorage.removeItem(oldKey);
      migratedCount++;
    } catch (e) {
      console.error(`Migration failed for key: ${oldKey}`, e);
    }
  }

  localStorage.setItem(migrationFlag, 'done');

  if (migratedCount > 0) {
    console.log(`✅ تمت هجرة ${migratedCount} مفاتيح تخزين بنجاح`);
  }
}
