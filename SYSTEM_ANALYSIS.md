# 🎯 ElAhmed Retail Suite - System Architecture Analysis

## 📊 Executive Summary

This document provides a comprehensive analysis of the connections between all components in the ElAhmed Retail Suite system. The application follows a **Clean Architecture** pattern with clear separation between layers.

---

## 🏗️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + TypeScript)                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Pages (23 routes)  →  Components  →  Hooks  →  Services/Domain        │
│                                              ↓                          │
│                              Repositories  ←  LocalStorage/IndexedDB    │
│                                              ↓                          │
│                                      API Client (optional)               │
└─────────────────────────────────────────────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Node.js + Express)                    │
├─────────────────────────────────────────────────────────────────────────┤
│  Routes  →  Controllers  →  Services  →  Repositories (Prisma ORM)    │
│                                              ↓                          │
│                                      PostgreSQL Database                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔗 1. Domain Layer Connections (src/domain/)

The domain layer contains pure business logic with **NO external dependencies**.

### File Dependency Map:

```
types.ts (Core Types)
    ↑
    ├── sale.ts ──────────→ uses types.CartItem, Sale, SaleItem
    ├── stock.ts ─────────→ uses types.StockMovement, Product
    ├── discount.ts ──────→ uses types.DiscountRule, CartItem
    ├── batchLogic.ts ────→ uses types.ProductBatch, BatchSaleResult
    ├── returns.ts ───────→ uses types.ReturnRecord, ReturnItem
    ├── audit.ts ─────────→ uses types.AuditEntry, AuditAction
    └── product.ts ───────→ uses types.Product
```

### Key Connections:

| File | Exports | Depends On |
|------|---------|------------|
| [`types.ts`](src/domain/types.ts) | All core TypeScript interfaces | - |
| [`sale.ts`](src/domain/sale.ts) | `buildSaleRecord`, `calcLineTotal`, `calcCartTotals` | types.CartItem, Sale |
| [`stock.ts`](src/domain/stock.ts) | `validateStock`, `calculateNewQuantity`, `createStockMovement` | types.StockMovement |
| [`discount.ts`](src/domain/discount.ts) | `validateLineDiscount`, `validateInvoiceDiscount` | types.DiscountRule |
| [`batchLogic.ts`](src/domain/batchLogic.ts) | `calculateFIFOSale`, `bulkCommitFIFOSales` | types.ProductBatch |
| [`returns.ts`](src/domain/returns.ts) | `processReturn` | types.ReturnRecord |
| [`audit.ts`](src/domain/audit.ts) | `createAuditEntry` | types.AuditEntry |
| [`product.ts`](src/domain/product.ts) | `validateProduct`, `filterProducts` | types.Product |

---

## 🔗 2. Services Layer Connections (src/services/)

Services orchestrate domain logic and handle persistence.

### File Dependency Map:

```
saleService.ts
    ├── domain/sale.ts (buildSaleRecord, calcCartTotals)
    ├── domain/stock.ts (validateStock, createStockMovement)
    ├── domain/batchLogic.ts (calculateFIFOSale, bulkCommitFIFOSales)
    ├── domain/audit.ts (createAuditEntry)
    ├── config/STORAGE_KEYS (INVOICE_COUNTER)
    └── repositories/saleRepository.ts (saveSale, voidSale)
          ↓
          repositories/index.ts → auditRepository, stockRepository

productService.ts
    ├── domain/product.ts (validatePricing, calcMarginPct)
    ├── domain/audit.ts (createAuditEntry)
    └── repositories/productRepository.ts

invoicePrinter.ts (standalone)
    └── No service dependencies - direct DOM/thermal printer
```

### Service Orchestration Flow:

```
[Cart] → saleService.processSale()
              │
              ├─→ domain/validateStock() ──────────────┐
              ├─→ domain/calculateFIFOSale() ────────┤
              ├─→ domain/buildSaleRecord() ───────────┤
              ├─→ domain/bulkCommitFIFOSales() ──────┤
              ├─→ domain/createStockMovement() ──────┤
              ├─→ domain/createAuditEntry() ─────────┤
              │
              └─→ repositories/saveSale() (localStorage)
                  repositories/addStockMovement()
                  repositories/addAuditEntry()
```

---

## 🔗 3. Repositories Layer Connections (src/repositories/)

Repositories handle data persistence - currently using localStorage.

### File Dependency Map:

```
index.ts (barrel export)
    │
    ├── saleRepository.ts
    │     └── localStorage: 'elahmed_sales', 'gx_returns_v2'
    │
    ├── productRepository.ts
    │     └── localStorage: 'elahmed-products', 'gx_mobiles_v2', etc.
    │
    ├── auditRepository.ts
    │     └── localStorage: 'elahmed_audit_logs'
    │
    └── stockRepository.ts
          └── localStorage: 'gx_stock_movements' (implied)
```

---

## 🔗 4. Configuration Connections (src/config/)

### Storage Keys Mapping (src/config/storageKeys.ts):

The system uses **dual storage keys** - some legacy, some new:

| Category | New Key (gx_*) | Legacy Key | Status |
|----------|---------------|------------|--------|
| Auth | `gx_auth_token` | - | ✅ Active |
| Users | `gx_users` | - | ✅ Active |
| Mobiles | `gx_mobiles_v2` | `elahmed-products` | 🔄 Migrated |
| Devices | `gx_devices_v2` | `elahmed-products` | 🔄 Migrated |
| Computers | `gx_computers_v2` | `elahmed-products` | 🔄 Migrated |
| Batches | `gx_product_batches_v1` | - | ✅ Active |
| Sales | - | `elahmed_sales` | ⚠️ Legacy |
| Audit | - | `elahmed_audit_logs` | ⚠️ Legacy |
| Settings | `app_settings` | - | ✅ Active |
| Backup | `gx_backup_settings` | - | ✅ Active |

### Config Dependencies:

```
STORAGE_KEYS
    │
    ├── Used by: Services, Repositories, Hooks, Contexts
    │
    └── Used in:
        ├── services/saleService.ts (INVOICE_COUNTER)
        ├── contexts/SettingsContext.tsx (APP_SETTINGS)
        ├── data/*Data.ts files
        └── repositories/*Repository.ts files
```

---

## 🔗 5. Context Layer Connections (src/contexts/)

### Provider Hierarchy:

```
App.tsx
    │
    ├── QueryClientProvider (React Query)
    │     │
    ├── ErrorBoundary
    │     │
    ├── SettingsProvider
    │     └── SettingsContext → localStorage (app_settings)
    │           ↓
    ├── ThemeProvider
    │     └── ThemeContext → localStorage (elahmed-theme)
    │           ↓
    ├── LanguageProvider
    │     └── LanguageContext → localStorage (elahmed-lang)
    │           ↓
    ├── AuthProvider
    │     └── AuthContext → localStorage (gx_auth_user, gx_auth_token)
    │           ↓
    ├── TooltipProvider (UI)
    │     │
    ├── Toaster (UI)
    │     │
    ├── Sonner (UI)
    │     │
    ├── BrowserRouter
    │     │
    ├── AutoBackupRunner
    │     └── data/backupData.ts
    │           ↓
    ├── DataMigrationRunner
    │     ├── domain/batchMigration.ts
    │     └── domain/migrationUsedMerge.ts
    │           ↓
    └── Routes
```

---

## 🔗 6. Hooks Layer Connections (src/hooks/)

### Hooks Dependencies:

```
index.ts (barrel export)
    │
    ├── useFastData.ts
    │     ├── data/mobilesData.ts
    │     ├── data/computersData.ts
    │     ├── data/devicesData.ts
    │     └── data/salesData.ts (implied)
    │
    ├── useInventoryData.ts
    │     ├── data/*Data.ts (all category files)
    │     └── domain/batchLogic.ts
    │
    ├── useBarcodeScanner.ts
    │     └── No domain deps - hardware interaction
    │
    ├── useDebounce.ts
    │     └── No external deps - utility hook
    │
    ├── useToast.ts
    │     └── No external deps - UI state
    │
    └── use-mobile.ts
          └── No external deps - responsive detection
```

---

## 🔗 7. Data Layer Connections (src/data/)

### Category Data Files:

Each category has its own data file with CRUD operations:

| Data File | Storage Key | Used By |
|-----------|-------------|---------|
| [`mobilesData.ts`](src/data/mobilesData.ts) | `gx_mobiles_v2` | MobilesInventory, POS |
| [`computersData.ts`](src/data/computersData.ts) | `gx_computers_v2` | ComputersInventory, POS |
| [`devicesData.ts`](src/data/devicesData.ts) | `gx_devices_v2` | DevicesInventory, POS |
| [`carsData.ts`](src/data/carsData.ts) | `gx_cars` | CarsInventory |
| [`customersData.ts`](src/data/customersData.ts) | `gx_customers` | CustomersPage |
| [`employeesData.ts`](src/data/employeesData.ts) | `gx_employees` | EmployeesPage |
| [`walletsData.ts`](src/data/walletsData.ts) | `gx_wallets` | WalletsPage |
| [`categoriesData.ts`](src/data/categoriesData.ts) | `gx_categories_v1` | All inventory pages |
| [`batchesData.ts`](src/data/batchesData.ts) | `gx_product_batches_v1` | domain/batchLogic.ts |
| [`backupData.ts`](src/data/backupData.ts) | `gx_backup_db` | Settings/Backup |

### Data File Pattern:

```
mobilesData.ts example:
    │
    ├── STORAGE_KEYS.MOBILES
    ├── localStorage CRUD operations
    ├── Domain validation (optional)
    └── Export functions:
        ├── getAllMobiles()
        ├── getMobileById(id)
        ├── saveMobile(mobile)
        ├── deleteMobile(id)
        └── getMobilesByCategory(category)
```

---

## 🔗 8. Frontend-Backend API Connections (src/lib/api.ts)

### API Client Endpoints:

```
ApiClient class
    │
    ├── Auth
    │     ├── POST /auth/login
    │     ├── POST /auth/register
    │     ├── GET /auth/verify
    │     └── POST /auth/change-password
    │
    ├── Users (CRUD)
    │     ├── GET /users
    │     ├── GET /users/:id
    │     ├── POST /users
    │     ├── PUT /users/:id
    │     └── DELETE /users/:id
    │
    ├── Products (CRUD + Batches)
    │     ├── GET /products
    │     ├── GET /products/:id
    │     ├── POST /products
    │     ├── PUT /products/:id
    │     ├── DELETE /products/:id
    │     ├── GET /products/:id/batches
    │     └── POST /products/:id/batches
    │
    ├── Sales
    │     ├── GET /sales
    │     ├── GET /sales/:id
    │     ├── POST /sales
    │     └── POST /sales/:id/void
    │
    ├── Inventory
    │     ├── GET /inventory/summary
    │     ├── GET /inventory/movements
    │     ├── POST /inventory/adjust
    │     └── GET /inventory/audit
    │
    ├── Customers
    │     ├── GET /customers
    │     ├── GET /customers/:id
    │     ├── POST /customers
    │     ├── PUT /customers/:id
    │     ├── DELETE /customers/:id
    │     └── GET /customers/stats/summary
    │
    ├── Suppliers
    │     ├── GET /suppliers
    │     ├── GET /suppliers/:id
    │     ├── POST /suppliers
    │     ├── PUT /suppliers/:id
    │     ├── DELETE /suppliers/:id
    │     ├── GET /suppliers/orders
    │     ├── POST /suppliers/orders
    │     └── PUT /suppliers/orders/:id/status
    │
    └── Settings
          ├── GET /settings/tax
          ├── PUT /settings/tax
          ├── POST /settings/tax/calculate
          ├── GET /settings/branches
          ├── POST /settings/branches
          ├── PUT /settings/branches/:id
          ├── GET /settings
          └── PUT /settings
```

---

## 🔗 9. Database Schema Connections (server/prisma/schema.prisma)

### Entity Relationship Diagram:

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    User     │       │    Sale     │       │   Product   │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id          │       │ id          │       │ id          │
│ username    │◄──────│ employeeId  │       │ barcode     │
│ fullName    │       │ invoiceNum  │       │ category    │
│ role        │       │ total       │◄──────│ quantity    │
└─────────────┘       │ paymentMethod       └──────┬──────┘
                      └─────────────┘              │
                             │                     │
                             ▼                     ▼
                      ┌─────────────┐       ┌─────────────┐
                      │  SaleItem   │       │ProductBatch │
                      ├─────────────┤       ├─────────────┤
                      │ saleId      │       │ productId   │
                      │ productId   │       │ costPrice   │
                      │ qty         │       │ quantity    │
                      │ price       │       │ remainingQty│
                      └─────────────┘       └─────────────┘
                             │
                             ▼
                      ┌─────────────┐       ┌─────────────┐
                      │StockMovement│       │  AuditLog   │
                      ├─────────────┤       ├─────────────┤
                      │ productId   │       │ userId      │
                      │ userId      │       │ action      │
                      │ type        │       │ entityType  │
                      │ quantityChange     │ entityId    │
                      └─────────────┘       └─────────────┘
```

### Prisma Model Dependencies:

| Model | Relations | Used By Routes |
|-------|-----------|----------------|
| `User` | sales[], auditLogs[], stockMovements[] | /auth, /users, /sales |
| `Product` | batches[], saleItems[], stockMovements[] | /products, /inventory |
| `ProductBatch` | product→ | /products/:id/batches |
| `Sale` | employee, items[] | /sales |
| `SaleItem` | sale, product | /sales |
| `StockMovement` | product, user | /inventory |
| `AuditLog` | user | /inventory/audit |
| `Customer` | sales[] | /customers |
| `Supplier` | products[], purchaseOrders[] | /suppliers |
| `PurchaseOrder` | supplier, items[] | /suppliers/orders |
| `Role` | permissions[], users[] | /rbac |
| `Permission` | roles[] | /rbac |
| `Setting` | - | /settings |
| `Branch` | sales, products, users | /settings/branches |
| `BackgroundJob` | - | /system/jobs |

---

## 🔗 10. Page Routes Connections (src/App.tsx)

### Route Mapping:

```
/ (Dashboard)        → Dashboard         → useFastData, useInventoryData
/pos                 → POS                → saleService, mobilesData
/inventory           → Inventory          → useInventoryData
/sales               → Sales              → salesRepository
/returns             → ReturnsPage        → returns domain
/mobiles             → MobilesInventory   → mobilesData
/computers           → ComputersInventory → computersData
/devices             → DevicesInventory   → devicesData
/cars                → CarsInventory      → carsData
/warehouse           → WarehousePage      → warehouseData
/used-inventory      → UsedInventory      → usedDevicesData
/maintenance         → Maintenance        → maintenanceData
/installments        → Installments       → installmentsData
/expenses            → Expenses           → expensesData
/damaged             → DamagedItemsPage   → damagedData
/other-revenue       → OtherRevenuePage   → otherRevenueData
/settings            → SettingsPage       → SettingsContext, backupData
/users               → UsersManagement    → usersData, RBAC
/barcodes            → BarcodePrintPage   → InventoryProductCard
/customers           → CustomersPage      → customersData
/wallets             → WalletsPage        → walletsData
/employees           → EmployeesPage      → employeesData
/help                → HelpPage           → static
/login               → LoginPage          → AuthContext
```

---

## ⚠️ Issues Found & Missing Connections

### 1. **Dual Storage Keys Issue**
- Some data uses new `gx_*` keys, others use legacy keys
- Migrations exist but may not be complete
- **Impact**: Data fragmentation between categories

### 2. **API Client Not Fully Integrated**
- Frontend has API client but currently uses localStorage primarily
- Backend routes exist but may not be connected on frontend
- **Impact**: Can't use cloud sync features

### 3. **Missing Data Connections**
- `serverData.ts` - referenced but not found in data layer
- `expensesData.ts` - exists but not connected to schema
- `maintenanceData.ts` - exists but not connected to schema  
- `installmentsData.ts` - exists but not connected to schema

### 4. **Repository Inconsistencies**
- Sale repository uses `elahmed_sales` (legacy)
- Product uses new structure but with mixed keys
- **Impact**: Some operations may fail or have inconsistent behavior

### 5. **Missing Batch Connections**
- Batch data (`batchesData.ts`) exists but not fully connected to all inventory operations
- **Impact**: FIFO may not work correctly for all categories

### 6. **Context Gaps**
- No global cart context (cart managed in POS component)
- No global notification context beyond UI toasts
- **Impact**: Hard to share cart state across components

---

## ✅ Recommendations

### Priority 1 (Critical):
1. **Unify storage keys** - Migrate all legacy keys to new `gx_*` format
2. **Connect API client** - Enable cloud sync by connecting services to API
3. **Fix batch integration** - Ensure all inventory operations use batches

### Priority 2 (Important):
4. **Add global CartContext** - Share cart between POS and other components
5. **Connect missing data files** - Link expenses, maintenance, installments to database
6. **Complete RBAC integration** - Connect frontend permissions to backend

### Priority 3 (Nice to have):
7. **Add real-time sync** - Use WebSocket for multi-device updates
8. **Implement offline mode** - Service worker for offline POS
9. **Add analytics pipeline** - Connect metrics to Grafana/Prometheus

---

## 📈 Data Flow Summary

```
User Action (POS Sale)
    │
    ▼
Component (POS.tsx)
    │
    ├── useCart() [local state]
    │
    ├── saleService.processSale(cart, discount, payment)
    │     │
    │     ├── domain/validateStock()
    │     ├── domain/calculateFIFOSale()
    │     ├── domain/buildSaleRecord()
    │     ├── domain/bulkCommitFIFOSales()
    │     ├── domain/createStockMovement()
    │     ├── domain/createAuditEntry()
    │     │
    │     └── repositories/saveSale()
    │           │
    │           └── localStorage.setItem('elahmed_sales', ...)
    │
    └── invoicePrinter.print(invoice)
          │
          └── Direct thermal printer API
```

---

*Generated on: 2026-03-02*
*Project: ElAhmed Retail Suite*
*Architecture: Clean Architecture (Domain-Driven Design)*
