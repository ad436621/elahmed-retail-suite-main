// ============================================================
// Storage Migration — توحيد مفاتيح التخزين القديمة
// NEW FILE: Step 1 — Run once on app startup
// ============================================================

const MIGRATION_FLAG = 'gx_migration_v1_done';

const KEY_MAP: [string, string][] = [
  ['elahmed_sales', 'gx_sales_v1'],
  ['elahmed_audit_logs', 'gx_audit_logs'],
];

export function runStorageMigration(): void {
  try {
    const done = localStorage.getItem(MIGRATION_FLAG);
    if (done) return;

    for (const [oldKey, newKey] of KEY_MAP) {
      const oldData = localStorage.getItem(oldKey);
      if (oldData) {
        const existing = localStorage.getItem(newKey);
        if (!existing) {
          localStorage.setItem(newKey, oldData);
        }
        localStorage.removeItem(oldKey);
      }
    }

    localStorage.setItem(MIGRATION_FLAG, new Date().toISOString());
    console.log('[Migration] Storage migration v1 completed');
  } catch (e) {
    console.error('[Migration] Storage migration v1 failed:', e);
  }
}
