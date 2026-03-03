# 🤖 AI Project Guide — ElAhmed Retail Suite (GX GLEAMEX)

> **للذكاء الاصطناعي:** اقرأ هذا الملف أولاً قبل أي تعديل على المشروع.  
> **For AI:** Read this file FIRST before making any changes to this project.

---

## 📋 Project Overview

**ElAhmed Retail Suite** is a **desktop-first, offline-only POS system** (Point of Sale) for an electronics retail store.

- **Stack:** Vite + React + TypeScript + TailwindCSS + ShadCN UI (front-end only for now)
- **Storage:** 100% `localStorage` — no database server required for normal use
- **Backend:** Express + Prisma exists but is **optional** (`VITE_USE_BACKEND=true` to enable)
- **Language:** TypeScript **only** — no Python, C++, Java, etc.
- **Target:** Windows desktop (used offline in-store)

---

## 🗂️ Centralized Configuration — CRITICAL RULE

### ⚠️ THE #1 RULE: Never hardcode strings

All `localStorage` keys and app-wide constants are centralized. **Always import from `@/config`**, never hardcode strings.

```typescript
// ✅ CORRECT
import { STORAGE_KEYS, APP_CONFIG } from '@/config';
const data = localStorage.getItem(STORAGE_KEYS.MOBILES);

// ❌ WRONG — never do this
const data = localStorage.getItem('gx_mobiles_v2');
```

### Config Files

| File | Purpose |
|------|---------|
| `src/config/storageKeys.ts` | All localStorage key strings |
| `src/config/appConfig.ts` | Business rules, defaults, feature flags |
| `src/config/index.ts` | Barrel export — import from here |

### Key Groups in `STORAGE_KEYS`

| Group | Keys |
|-------|------|
| Auth | `AUTH_TOKEN`, `AUTH_USER`, `SESSION`, `RECOVERY_CODE` |
| Users | `USERS` |
| Inventory | `MOBILES`, `MOBILE_ACCESSORIES`, `DEVICES`, `DEVICE_ACCESSORIES`, `COMPUTERS`, `COMPUTER_ACCESSORIES`, `USED_DEVICES`, `CARS`, `WAREHOUSE` |
| FIFO Batches | `BATCHES` |
| Categories | `CATEGORIES`, `LEGACY_CATEGORIES` |
| Legacy | `PRODUCTS`, `SALES_LEGACY`, `AUDIT_LOGS` |
| Finance | `INVOICE_COUNTER`, `RETURNS`, `EXPENSES`, `OTHER_REVENUE`, `INSTALLMENTS` |
| Wallets | `WALLETS`, `WALLET_TRANSACTIONS` |
| People | `CUSTOMERS`, `EMPLOYEES`, `SALARY_RECORDS`, `ADVANCES` |
| Operations | `DAMAGED_ITEMS`, `MAINTENANCE` |
| Settings | `APP_SETTINGS`, `BACKUP_SETTINGS`, `MONTHLY_RESET_SETTINGS`, `MONTHLY_ARCHIVE` |
| POS/Settings | `HELD_INVOICES`, `TRANSFERS`, `INVOICE_SETTINGS`, etc. |
| Migrations | `MIGRATION_BATCHES_DONE`, `MIGRATION_USED_MERGE_DONE` |

### Key Constants in `APP_CONFIG`

```typescript
APP_CONFIG.APP_NAME           // 'GLEAMEX'
APP_CONFIG.API_BASE_URL       // from VITE_API_URL env var
APP_CONFIG.DEFAULT_CURRENCY   // 'جنيه'
APP_CONFIG.LOW_STOCK_THRESHOLD // 3
APP_CONFIG.MAX_DISCOUNT_PCT   // 50
APP_CONFIG.SYNC_ENABLED       // false (future online sync)
```

---

## 🏗️ Architecture & Layer Map

```
src/
├── config/          ← 🔑 Centralized constants (ALWAYS import from here)
│   ├── storageKeys.ts
│   ├── appConfig.ts
│   └── index.ts     ← barrel export
│
├── domain/          ← Pure business logic — no React, no storage
│   ├── types.ts     ← All TypeScript interfaces/types
│   ├── sale.ts      ← Sale building logic
│   ├── stock.ts     ← Stock validation
│   ├── product.ts   ← Barcode generation
│   ├── batchLogic.ts  ← FIFO logic
│   ├── batchMigration.ts ← One-time migration
│   └── migrationUsedMerge.ts
│
├── data/            ← localStorage CRUD — one file per entity
│   ├── mobilesData.ts
│   ├── devicesData.ts
│   ├── computersData.ts
│   ├── usedDevicesData.ts
│   ├── carsData.ts
│   ├── warehouseData.ts
│   ├── batchesData.ts
│   ├── categoriesData.ts
│   ├── customersData.ts
│   ├── usersData.ts
│   ├── employeesData.ts
│   ├── walletsData.ts
│   ├── expensesData.ts
│   ├── otherRevenueData.ts
│   ├── installmentsData.ts
│   ├── maintenanceData.ts
│   ├── damagedData.ts
│   ├── monthlyResetData.ts
│   ├── backupData.ts
│   └── returnsPage.tsx
│
├── repositories/    ← Data access for legacy products, sales, audit
│   ├── productRepository.ts
│   ├── saleRepository.ts
│   └── auditRepository.ts
│
├── services/        ← Orchestration layer (uses domain + repositories)
│   └── saleService.ts
│
├── contexts/        ← React global state
│   ├── AuthContext.tsx   ← Login, permissions
│   └── SettingsContext.tsx ← Company settings, printer, etc.
│
├── pages/           ← Large route-level components
│   ├── POS.tsx
│   ├── SettingsPage.tsx
│   └── ... (many pages per inventory section)
│
├── components/      ← Shared UI components
│   └── ui/          ← ShadCN UI primitives
│
└── lib/
    ├── api.ts           ← Backend API client (optional backend mode)
    ├── apiClient.ts     ← Alternative API client
    └── localStorageHelper.ts ← getStorageItem / setStorageItem helpers
```

---

## 📦 Data Layer Pattern

Every `src/data/` file follows this exact pattern:

```typescript
import { EntityType } from '@/domain/types';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

const KEY = STORAGE_KEYS.ENTITY_NAME;

export function getEntities(): EntityType[] {
    return getStorageItem<EntityType[]>(KEY, []);
}

export function saveEntities(items: EntityType[]): void {
    setStorageItem(KEY, items);
}

export function addEntity(item: Omit<EntityType, 'id' | 'createdAt'>): EntityType {
    const all = getEntities();
    const newItem: EntityType = {
        ...item,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
    };
    saveEntities([...all, newItem]);
    return newItem;
}

export function updateEntity(id: string, updates: Partial<EntityType>): void {
    saveEntities(getEntities().map(e => e.id === id ? { ...e, ...updates } : e));
}

export function deleteEntity(id: string): void {
    saveEntities(getEntities().filter(e => e.id !== id));
}
```

**Use `getStorageItem` / `setStorageItem` from `@/lib/localStorageHelper`** — they handle JSON parsing and error catching.

---

## 🔐 Auth & Permissions

- Auth is handled by `AuthContext` — `useAuth()` hook
- Roles: `owner` (all permissions) | `user` (specific permissions)
- Permissions list is in `src/data/usersData.ts` → `ALL_PERMISSIONS`
- Protect routes with `<ProtectedRoute>` and `<PermGuard permission="...">` components
- Session stored in `STORAGE_KEYS.SESSION`

---

## 💰 FIFO Batch System (Important!)

The inventory uses **FIFO (First In, First Out)** to track cost per batch:

1. **Every time stock is added** → `addBatch()` in `batchesData.ts` is called automatically
2. **Sales** → `calculateFIFOSale()` in `batchLogic.ts` consumes oldest batches first
3. **Profit** = sale price − weighted FIFO cost
4. **Capital** = sum of all remaining batch quantities × their cost prices

When adding a new inventory type, you MUST call `addBatch()` when adding items.

---

## 🌐 Contexts — How to Read/Write Settings

```typescript
// Read company settings anywhere
const { settings } = useSettings();
console.log(settings.companyName); // 'GLEAMEX'

// Read auth data anywhere
const { user, hasPermission } = useAuth();
if (!hasPermission('pos')) return <Forbidden />;
```

---

## 🛒 POS Sale Flow

```
User adds to cart
    → processSale() in saleService.ts
        → validateStock() (domain/stock.ts)
        → calculateFIFOSale() (domain/batchLogic.ts)
        → buildSaleRecord() (domain/sale.ts)
        → bulkCommitFIFOSales() — updates batch quantities
        → saveSale() (repositories/saleRepository.ts)
        → wallet.deposit() — records payment
```

---

## ⚠️ Pre-existing Issues (Don't Fix Unless Requested)

1. **AuthContext TypeScript errors** — `UserRole` mismatch between `domain/types.ts` and `usersData.ts`. The backend returns a different `User` type. These errors exist before our session and are **intentional technical debt**.
2. **Duplicate API clients** — `src/lib/api.ts` and `src/lib/apiClient.ts` both exist. They can be merged eventually.
3. **Large page files** — `POS.tsx` and `SettingsPage.tsx` are large monoliths. Refactoring them is planned but not done.

---

## 📏 Conventions

| Convention | Rule |
|------------|------|
| Imports | Always use `@/` path aliases, never relative `../../` |
| Config | Import all keys/constants from `@/config` |
| Storage | Use `getStorageItem`/`setStorageItem` helpers, never raw `localStorage.getItem` in data files |
| IDs | Use `crypto.randomUUID()` for new entity IDs |
| Dates | Always ISO strings: `new Date().toISOString()` |
| Arabic | UI text is Arabic (RTL). Back-end keys/code are English |
| Currency | Default is `APP_CONFIG.DEFAULT_CURRENCY` = `'جنيه'` |
| Batch on add | Always call `addBatch()` when adding inventory with quantity > 0 |

---

## 🔄 Future: Online Sync (Not Yet Implemented)

The config has a placeholder: `APP_CONFIG.SYNC_ENABLED = false`.  
When sync is implemented:
1. Set `SYNC_ENABLED = true` in `appConfig.ts`
2. Add sync hooks in a new `src/sync/` layer
3. Data files remain unchanged — sync layer sits on top

---

## 🔧 Adding a New Feature Checklist

1. **New localStorage key?** → Add to `src/config/storageKeys.ts` first
2. **New business constant?** → Add to `src/config/appConfig.ts`
3. **New entity type?** → Define interface in `src/domain/types.ts`
4. **New data layer?** → Create `src/data/entityData.ts` using the pattern above
5. **New page?** → Add route in `src/App.tsx`, wrap with `<PermGuard>`
6. **Involves stock?** → Call `addBatch()` on creation, use FIFO on sale

---

*Last updated: March 2026 — Generated by AI assistant during centralization session.*
